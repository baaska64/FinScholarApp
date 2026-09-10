import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Image, ImageBackground, Platform, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Path } from 'react-native-svg';
import { supabase } from '../../services/supabaseClient';
import { SyncService } from '../../services/SyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Tabs from '@/components/ledger/Tabs';
import TimetableGrid from '@/components/schedule/TimetableGrid';
import ScheduleListView from '@/components/schedule/ScheduleListView';
import AttendanceTracker from '@/components/schedule/AttendanceTracker';
import ScheduleScannerModal from '@/components/schedule/ScheduleScannerModal';
import PremiumPaywallModal from '@/components/PremiumPaywallModal';
import DevMenuModal from '@/components/DevMenuModal';
import { ClassDetailsModal, ClassEditModal } from '@/components/schedule/ClassModals';
import { useColorScheme } from 'nativewind';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { AlertService } from '@/components/CustomAlert';
import { useSemesterContext } from '@/components/SemesterContext';
import { ensureSubjectExists, refreshHasSchedule, getUnscheduledSubjects } from '@/utils/subjectRegistry';
import { normalizeScheduleDays, parseClassHour, parseClassDuration } from '@/utils/scheduleParsing';
import { getTheme, Radius, Shadows } from '@/constants/Theme';
import { ListSkeleton } from '@/components/ui/LoadingSkeleton';
import SpotlightTarget from '@/components/spotlight/SpotlightTarget';
import { useScreenTour } from '@/components/spotlight/useScreenTour';
import { SPOTLIGHT_IDS, TOUR_KEYS, SCHEDULE_TOUR } from '@/constants/tours';
import { useTabBarHeight } from '@/components/CustomTabBar';

const generateId = () => Math.random().toString(36).substr(2, 9);

/** Horizontal page padding. Kept tight so the timetable gets the width. */
const GUTTER = 12;

/** 14.5 -> "2:30PM". Used wherever a class time is shown as a compact label. */
const formatHour = (h: number) => {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    const ampm = hours >= 12 && hours < 24 ? 'PM' : 'AM';
    let dh = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    if (dh > 12) dh -= 12;
    return `${dh}${mins > 0 ? `:${mins.toString().padStart(2, '0')}` : ''}${ampm}`;
};

const parseLocalDate = (dateStr: string) => {
  if (typeof dateStr === 'string' && dateStr.includes('-')) {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
    }
  }
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export default function ScheduleScreen() {
    const { colorScheme, toggleColorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);

    const [data, setData] = useState<any>(null);
    const [user, setUser] = useState<any>(null);
  const { selectedYear: activeYearId, selectedSemester: activeSemId } = useSemesterContext();

    
    const params = useLocalSearchParams();
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'attendance'>('grid');
    const [zoomScale, setZoomScale] = useState(0.5);
    
    // Quick Edit Mode state
    const [isQuickEditMode, setIsQuickEditMode] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [showDevMenu, setShowDevMenu] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'offline' | 'syncing' | 'saved'>('offline');
    const [isPremium, setIsPremium] = useState(false);
    const [quote, setQuote] = useState('');
    const [showAiWarning, setShowAiWarning] = useState(false);
    // The hero, term stats and upcoming items moved off the main canvas so the
    // timetable is the first thing on screen; this sheet is where they live now.
    const [showOverview, setShowOverview] = useState(false);
    /**
     * Bumped when a scan writes classes in. The grid reads it as a cue to
     * replay its staggered entrance, so the timetable visibly fills in
     * chronologically instead of the blocks simply being there.
     */
    const [revealToken, setRevealToken] = useState(0);
    const revealTimers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
    const clearRevealTimers = () => {
        revealTimers.current.forEach(clearTimeout);
        revealTimers.current = [];
    };
    useEffect(() => clearRevealTimers, []);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        setIsPremium(SyncService.getIsPremium());
        const quotes = [
            "Stay organized and conquer your classes today!",
            "Every class brings you closer to your graduation goals!",
            "Consistency is key! Don't miss your lectures today.",
            "Check your schedule early and stay one step ahead!",
            "Learning is a superpower — make today count!"
        ];
        setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
    }, []);

    useEffect(() => {
        if (params.viewMode && typeof params.viewMode === 'string') {
            // 'glass' is the label the segmented control shows for the list view;
            // accept it so older deep links keep landing on the right tab.
            const vm = params.viewMode.toLowerCase() === 'glass' ? 'list' : params.viewMode.toLowerCase();
            if (['grid', 'list', 'attendance'].includes(vm)) {
                setViewMode(vm as any);
            }
        }
    }, [params.viewMode, params.trigger]);
    const [upcomingMilestones, setUpcomingMilestones] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [editingClass, setEditingClass] = useState<any>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const viewShotRef = React.useRef<any>(null);
    const viewShotDarkRef = React.useRef<any>(null);
    const viewShotListRef = React.useRef<any>(null);
    const quickEditSaveTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const [previewUri, setPreviewUri] = useState<string | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [exportDark, setExportDark] = useState(true);

    /**
     * The export renders the timetable at 3084px wide — roughly a 2940x1920
     * offscreen view tree per theme. Mounting those with the screen meant every
     * zoom, quick-edit toggle and attendance tap re-laid them out, which is what
     * made the whole app feel heavy. They now mount only for the capture, and
     * only for the theme being captured.
     */
    const [exportRender, setExportRender] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);

    /** Lets the freshly mounted tree lay out and decode its bitmap. */
    const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const handleExportSchedule = async () => {
        if (isCapturing) return;
        setIsCapturing(true);
        try {
            // Glass view captures what is already on screen — nothing to mount.
            if (viewMode === 'list') {
                if (!viewShotListRef.current) return;
                await settle(500);
                const uri = await viewShotListRef.current.capture();
                setPreviewUri(uri);
                setShowPreviewModal(true);
                return;
            }

            setExportRender(true);
            // Longer than the old delay because this now also covers mounting
            // and laying out the export tree, not just decoding its images.
            await settle(650);
            const ref = exportDark ? viewShotDarkRef : viewShotRef;
            if (!ref.current) {
                setExportRender(false);
                return;
            }
            const uri = await ref.current.capture();
            setPreviewUri(uri);
            setShowPreviewModal(true);
        } catch (e: any) {
            setExportRender(false);
            AlertService.alert('Export Failed', e.message);
        } finally {
            setIsCapturing(false);
        }
    };

    const handleToggleExportTheme = async () => {
        if (isCapturing) return;
        const newDark = !exportDark;
        setExportDark(newDark);
        setIsCapturing(true);
        try {
            // Swapping the theme swaps which tree is mounted, so this waits for
            // the new one rather than an already-present sibling.
            await settle(550);
            const ref = newDark ? viewShotDarkRef : viewShotRef;
            if (!ref.current) return;
            const uri = await ref.current.capture();
            setPreviewUri(uri);
        } catch (e: any) {
            // silent fail - keep current preview
        } finally {
            setIsCapturing(false);
        }
    };

    /** Closing the preview is what drops the export tree again. */
    const closeExportPreview = () => {
        setShowPreviewModal(false);
        setExportRender(false);
        setPreviewUri(null);
    };

    const handleSaveToGallery = async () => {
        if (!previewUri) return;
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync(true);
            if (status !== 'granted') {
                AlertService.alert('Permission Denied', 'We need photo library permissions to save your schedule!');
                return;
            }
            await MediaLibrary.saveToLibraryAsync(previewUri);
            closeExportPreview();
            AlertService.alert('Success!', 'Your schedule has been saved to your photo gallery! 🎉');
        } catch (e: any) {
            AlertService.alert('Export Failed', e.message);
        }
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const loadLocalData = useCallback(async () => {
        let loaded = null;
        try {
            const local = await AsyncStorage.getItem('grade_ledger_v2_data');
            if (local) loaded = JSON.parse(local);
        } catch(e) {}

        if (!loaded) loaded = { years: [] };
        
        loaded.years.forEach((y: any) => y.semesters.forEach((s: any) => {
            if (!s.classes) s.classes = [];
            if (!s.subjects) s.subjects = [];
            // Backfill defaults for subjects added before this feature
            s.subjects.forEach((sub: any) => {
                if (sub.gradeTrackingEnabled === undefined) sub.gradeTrackingEnabled = true;
                if (sub.hasSchedule === undefined) sub.hasSchedule = false;
            });
        }));

        setData(loaded);
        
        let allItems: any[] = [];
        loaded.years?.forEach((y: any) => {
            y.semesters?.forEach((s: any) => {
                if (s.milestones) allItems.push(...s.milestones.map((m:any) => ({ ...m, isMilestone: true })));
                s.subjects?.forEach((sub: any) => {
                    if (sub.requirements) {
                        allItems.push(...sub.requirements
                            .filter((r:any) => r.status !== 'submitted' && r.status !== 'graded')
                            .map((r:any) => ({ ...r, isRequirement: true, subjectName: sub.name }))
                        );
                    }
                });
            });
        });
        const todayMs = new Date().setHours(0,0,0,0);
        const upcoming = allItems
            .filter(item => parseLocalDate(item.date) >= todayMs)
            .sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date))
            .slice(0, 5);
        setUpcomingMilestones(upcoming);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadLocalData();
        }, [loadLocalData])
    );

    useEffect(() => {
        const unsubData = SyncService.subscribeDataChange(() => {
            loadLocalData();
        });
        const unsubState = SyncService.subscribe((state) => {
            setSyncStatus(state === 'conflict' ? 'offline' : state);
        });
        return () => {
            unsubData();
            unsubState();
        };
    }, [loadLocalData]);

    const saveData = async (newData: any) => {
        setData(newData);
        await SyncService.pushLocalChanges(newData);
    };

    // First visit only: point at the scan / add-class row.
    useScreenTour(TOUR_KEYS.schedule, SCHEDULE_TOUR, data !== null);

    if (!data) return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <ListSkeleton count={3} cardHeight={100} />
        </SafeAreaView>
    );

    const currentYear = data.years.find((y: any) => y.id === activeYearId);
    const currentSem = currentYear?.semesters.find((s: any) => s.id === activeSemId);
    
    const onUpdateClass = (clsId: string, updates: any) => {
        const nd = {...data};
        const sem = nd.years.find((y: any) => y.id === activeYearId).semesters.find((s: any) => s.id === activeSemId);
        const idx = sem.classes.findIndex((c: any) => c.id === clsId);
        if (idx !== -1) {
            sem.classes[idx] = { ...sem.classes[idx], ...updates };
            saveData(nd);
        }
    };

    const onUpdateClasses = (updatesList: {id: string, updates: any}[]) => {
        setData((prevData: any) => {
            const nd = { ...prevData };
            const yrIdx = nd.years.findIndex((y: any) => y.id === activeYearId);
            if (yrIdx !== -1) {
                const semIdx = nd.years[yrIdx].semesters.findIndex((s: any) => s.id === activeSemId);
                if (semIdx !== -1) {
                    nd.years[yrIdx].semesters[semIdx].classes = nd.years[yrIdx].semesters[semIdx].classes.map((c: any) => {
                        const update = updatesList.find(u => u.id === c.id);
                        return update ? { ...c, ...update.updates } : c;
                    });
                }
            }

            // Debounce the heavy disk write
            if (quickEditSaveTimeout.current) clearTimeout(quickEditSaveTimeout.current);
            quickEditSaveTimeout.current = setTimeout(() => {
                SyncService.pushLocalChanges(nd);
            }, 350);

            return nd;
        });
    };

    const handleScannedClasses = (scannedClasses: any[]) => {
        let nd = { ...data };
        const sem = nd.years.find((y: any) => y.id === activeYearId)?.semesters.find((s: any) => s.id === activeSemId);
        if (!sem) return;
        

        const safeScanned = scannedClasses || [];
        safeScanned.forEach(sc => {
            const className = sc.name || sc.subject || sc.class || 'Unnamed Class';
            // Register subject in the global registry
            const regResult = ensureSubjectExists(nd, activeYearId, activeSemId, className, { fromSchedule: true });
            nd = regResult.data;
            const subjectId = regResult.subjectId;
            // Mark as having a schedule
            const subjectEntry = nd.years.find((y: any) => y.id === activeYearId)?.semesters.find((s: any) => s.id === activeSemId)?.subjects?.find((s: any) => s.id === subjectId);
            if (subjectEntry) subjectEntry.hasSchedule = true;

            const rawTime = sc.startHour !== undefined ? sc.startHour : (sc.time || sc.startTime || sc.start_time);
            
            // Check if it's a flat format (has day and some time property)
            if (sc.day !== undefined && rawTime !== undefined) {
                const parsedStartHour = parseClassHour(rawTime);
                const rawEndTime = sc.endHour !== undefined ? sc.endHour : (sc.endTime || sc.end_time);
                const dur = parseClassDuration(sc.duration, parsedStartHour, rawEndTime);
                // A study-load row names several days at once ("MWF"), so one
                // row becomes one class per day.
                const colorIdx = sc.colorIdx !== undefined && sc.colorIdx !== null ? Number(sc.colorIdx) : Math.floor(Math.random() * 6);

                normalizeScheduleDays(sc.day).forEach((dayIdx) => {
                    nd.years.find((y: any) => y.id === activeYearId)?.semesters.find((s: any) => s.id === activeSemId)?.classes.push({
                        id: generateId(),
                        name: className,
                        room: sc.room || sc.location || '',
                        instructor: sc.instructor || sc.teacher || '',
                        day: dayIdx,
                        startHour: parsedStartHour,
                        duration: dur,
                        colorIdx,
                        subjectId,
                        absences: 0, lates: 0, cuts: 0
                    });
                });
            } else if (Array.isArray(sc.schedules) && sc.schedules.length > 0) {
                // Nested format
                sc.schedules.forEach((sch: any) => {
                    const schTime = sch.startHour !== undefined ? sch.startHour : (sch.time || sch.startTime || sch.start_time);
                    const parsedStartHour = parseClassHour(schTime);
                    const schEndTime = sch.endHour !== undefined ? sch.endHour : (sch.endTime || sch.end_time);
                    const dur = parseClassDuration(sch.duration, parsedStartHour, schEndTime);
                    const schColorIdx = sch.colorIdx !== undefined && sch.colorIdx !== null ? Number(sch.colorIdx) : (sc.colorIdx !== undefined && sc.colorIdx !== null ? Number(sc.colorIdx) : Math.floor(Math.random() * 6));

                    normalizeScheduleDays(sch.day).forEach((dayIdx) => {
                        nd.years.find((y: any) => y.id === activeYearId)?.semesters.find((s: any) => s.id === activeSemId)?.classes.push({
                            id: generateId(),
                            name: className,
                            room: sch.room || sch.location || sc.room || sc.location || '',
                            instructor: sch.instructor || sch.teacher || sc.instructor || sc.teacher || '',
                            day: dayIdx,
                            startHour: parsedStartHour,
                            duration: dur,
                            colorIdx: schColorIdx,
                            subjectId,
                            absences: 0, lates: 0, cuts: 0
                        });
                    });
                });
            }
        });
        saveData(nd);
        setShowScanner(false);

        // Sequence the hand-off. Firing all three at once meant the scanner
        // sheet was still sliding out while the "check my work" modal slid in
        // over the grid — so the fill-in animation played entirely behind two
        // modals and was never actually seen.
        const revealSem = nd.years?.find((y: any) => y.id === activeYearId)
            ?.semesters?.find((s: any) => s.id === activeSemId);
        const blockCount = revealSem?.classes?.length || 0;
        const revealMs = Math.min(blockCount * 55, 1600) + 320;

        clearRevealTimers();
        // Let the scanner sheet finish closing before the grid starts filling.
        revealTimers.current.push(setTimeout(() => setRevealToken((n) => n + 1), 280));
        // Then hold the prompt until the timetable has finished writing itself.
        revealTimers.current.push(setTimeout(() => setShowAiWarning(true), 280 + revealMs + 400));
    };

    const handleDeleteClasses = (clsIds: string[]) => {
        let nd = {...data};
        const sem = nd.years.find((y: any) => y.id === activeYearId).semesters.find((s: any) => s.id === activeSemId);
        
        const deletedBlocks = sem.classes.filter((c: any) => clsIds.includes(c.id));
        sem.classes = sem.classes.filter((c: any) => !clsIds.includes(c.id));
        
        deletedBlocks.forEach((deletedBlock: any) => {
            if (deletedBlock?.subjectId) {
                const remainingBlocks = sem.classes.filter((c: any) => c.subjectId === deletedBlock.subjectId);
                const subject = sem.subjects?.find((s: any) => s.id === deletedBlock.subjectId);
                
                // If this was the last block for this subject and the subject has no data, auto-delete the subject
                if (subject && remainingBlocks.length === 0) {
                    const hasData = subject.periods && subject.periods.length > 0;
                    if (!hasData) {
                        sem.subjects = sem.subjects.filter((s: any) => s.id !== deletedBlock.subjectId);
                    }
                }
                
                // Refresh hasSchedule for the affected subject
                nd = refreshHasSchedule(nd, activeYearId, activeSemId, deletedBlock.subjectId);
            }
        });
        
        saveData(nd);
        setSelectedClass(null);
    };

    const handleSaveClass = (newClassData: any) => {
        if (!newClassData.name.trim() || !newClassData.schedules || newClassData.schedules.length === 0) return;
        
        let oldSubjectIdToRefresh = null;
        let initialData = JSON.parse(JSON.stringify(data));
        if (editingClass && editingClass.name.trim().toLowerCase() !== newClassData.name.trim().toLowerCase()) {
            const tempSem = initialData.years.find((y: any) => y.id === activeYearId)?.semesters.find((s: any) => s.id === activeSemId);
            if (tempSem && tempSem.subjects) {
                const targetNameExists = tempSem.subjects.some((s: any) => s.name.trim().toLowerCase() === newClassData.name.trim().toLowerCase());
                const oldSub = tempSem.subjects.find((s: any) => s.name.trim().toLowerCase() === editingClass.name.trim().toLowerCase());
                if (!targetNameExists && oldSub) {
                    oldSub.name = newClassData.name.trim();
                } else if (targetNameExists && oldSub) {
                    oldSubjectIdToRefresh = oldSub.id;
                }
            }
        }

        // ── Register subject in the global registry ──────────────────────
        const regResult = ensureSubjectExists(
            initialData, activeYearId, activeSemId, newClassData.name, { fromSchedule: true }
        );
        let nd = regResult.data;
        const subjectId = regResult.subjectId;
        const isNewSubject = regResult.isNew;

        const sem = nd.years.find((y: any) => y.id === activeYearId).semesters.find((s: any) => s.id === activeSemId);
        
        if (editingClass) {
            sem.classes = sem.classes.filter((c: any) => c.name !== editingClass.name);
        }
        
        let colorIdx = newClassData.colorIdx;
        if (!editingClass) {
            const existingClass = sem.classes.find((c: any) => c.name.toLowerCase() === newClassData.name.toLowerCase());
            if (existingClass) colorIdx = existingClass.colorIdx;
            else colorIdx = Math.floor(Math.random() * 6);
        }
        
        const newBlocks = newClassData.schedules.map((sched: any) => ({
            id: String(sched.id).length < 10 ? generateId() : sched.id,
            name: newClassData.name,
            colorIdx: colorIdx,
            instructor: newClassData.instructor,
            room: sched.room,
            day: sched.day,
            startHour: sched.startHour,
            duration: sched.duration,
            subjectId: subjectId, // ← link to global registry
            absences: 0, lates: 0, cuts: 0
        }));
        
        sem.classes = [...sem.classes, ...newBlocks];

        // Mark this subject as having a schedule
        const updatedSem = nd.years.find((y: any) => y.id === activeYearId).semesters.find((s: any) => s.id === activeSemId);
        const subjectEntry = updatedSem.subjects?.find((s: any) => s.id === subjectId);
        if (subjectEntry) subjectEntry.hasSchedule = true;

        if (oldSubjectIdToRefresh) {
            nd = refreshHasSchedule(nd, activeYearId, activeSemId, oldSubjectIdToRefresh);
        }

        saveData(nd);
        setShowEditModal(false);
        setSelectedClass(null);

        // ── Prompt for grade tracking if this is a brand-new subject ─────
        if (isNewSubject) {
            setTimeout(() => {
                AlertService.alert(
                    'Track Grades?',
                    `Do you want to track grades for "${newClassData.name}" in the Grade Tracker?`,
                    [
                        { text: 'Not Now', style: 'cancel' },
                        {
                            text: 'Yes, Track Grades',
                            onPress: async () => {
                                const latest = await (async () => {
                                    const raw = await AsyncStorage.getItem('grade_ledger_v2_data');
                                    return raw ? JSON.parse(raw) : nd;
                                })();
                                const latestSem = latest.years?.find((y: any) => y.id === activeYearId)?.semesters?.find((s: any) => s.id === activeSemId);
                                const sub = latestSem?.subjects?.find((s: any) => s.id === subjectId);
                                if (sub) {
                                    sub.gradeTrackingEnabled = true;
                                    saveData(latest);
                                }
                            }
                        },
                    ]
                );
            }, 350);
        }
    };

    const handleResetSchedule = () => {
        AlertService.alert("Reset Schedule", `Are you sure you want to delete all classes for ${currentSem?.name}?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete All", style: "destructive", onPress: () => {
                let nd = {...data};
                const sem = nd.years.find((y: any) => y.id === activeYearId).semesters.find((s: any) => s.id === activeSemId);
                const classIds = sem.classes.map((c: any) => c.id);
                sem.classes = [];
                
                // Auto-delete subjects with no data that are orphaned
                const subjectsToRemove = new Set();
                sem.subjects?.forEach((subject: any) => {
                    const hasData = subject.periods && subject.periods.length > 0;
                    if (!hasData) {
                        subjectsToRemove.add(subject.id);
                    } else {
                        subject.hasSchedule = false; // They definitely have no schedule anymore
                    }
                });
                if (subjectsToRemove.size > 0) {
                    sem.subjects = sem.subjects.filter((s: any) => !subjectsToRemove.has(s.id));
                }

                saveData(nd);
            }}
        ]);
    };

    let nextClassInfo: any = null;
    let nextClassWaitStr = '';
    let isOngoing = false;
    const currentSemClasses = currentSem?.classes || [];
    if (currentSemClasses.length > 0) {
        const now = new Date();
        const currentDayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon
        const currentHourFloat = now.getHours() + (now.getMinutes() / 60);

        const semStartDate = currentSem.startDate ? new Date(currentSem.startDate) : null;
        if (semStartDate) semStartDate.setHours(0, 0, 0, 0);
        const isFutureSemester = !!(semStartDate && now < semStartDate);

        let minWaitHours = Infinity;
        
        if (!isFutureSemester) {
            currentSemClasses.forEach((cls: any) => {
                if (cls.day === currentDayIdx && currentHourFloat >= cls.startHour && currentHourFloat < cls.startHour + (cls.duration || 1)) {
                    nextClassInfo = cls;
                    isOngoing = true;
                }
            });
        }

        if (!isOngoing) {
            const baseDate = isFutureSemester && semStartDate ? semStartDate : now;
            const baseDayIdx = baseDate.getDay() === 0 ? 6 : baseDate.getDay() - 1;
            const baseHourFloat = isFutureSemester ? 0 : currentHourFloat;

            currentSemClasses.forEach((cls: any) => {
                let daysUntil = cls.day - baseDayIdx;
                if (daysUntil < 0 || (daysUntil === 0 && cls.startHour <= baseHourFloat)) daysUntil += 7;
                
                let waitHours = (daysUntil * 24) + (cls.startHour - baseHourFloat);
                
                if (isFutureSemester && semStartDate) {
                    waitHours += (semStartDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                }
                
                if (waitHours < minWaitHours) {
                    minWaitHours = waitHours;
                    nextClassInfo = cls;
                }
            });

            if (nextClassInfo) {
                const d = Math.floor(minWaitHours / 24);
                const remainingHours = minWaitHours % 24;
                const h = Math.floor(remainingHours);
                const m = Math.round((remainingHours - h) * 60);

                const parts = [];
                if (d > 0) parts.push(`${d} day${d > 1 ? 's' : ''}`);
                if (h > 0) parts.push(`${h} hr${h > 1 ? 's' : ''}`);
                if (m > 0 || (d === 0 && h === 0)) parts.push(`${m} min`);

                nextClassWaitStr = parts.join(' ');
            }
        }
    }
    
    const overallAttendance = currentSem ? (() => {
        if (!currentSem.classes || currentSem.classes.length === 0) return null;
        const startDateStr = currentSem.startDate || new Date().toISOString().split('T')[0];
        const endDateStr = currentSem.endDate || new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString().split('T')[0];
        const attendanceLog = currentSem.attendanceLog || {};
        
        const start = new Date(startDateStr);
        const end = new Date(endDateStr + 'T23:59:59');
        const now = new Date();
        
        const limitDate = now < end ? now : end;
        
        let totalConductedHours = 0;
        let attendedHours = 0;
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        for (let d = new Date(start); d <= limitDate; d.setDate(d.getDate() + 1)) {
            const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
            const dateStr = d.toISOString().split('T')[0];
            
            const dayClasses = currentSem.classes.filter((c: any) => c.day === dayIdx);
            dayClasses.forEach((cls: any) => {
                const key = `${dateStr}_${cls.id}`;
                const logEntry = attendanceLog[key];
                let status = 'pending';
                let isManual = false;
                if (typeof logEntry === 'boolean') {
                    status = logEntry ? 'present' : 'pending';
                } else if (logEntry) {
                    status = logEntry.status || 'pending';
                    isManual = !!logEntry.isManual;
                }
                
                const sessionDate = new Date(d);
                const startHour = cls.startHour || 0;
                sessionDate.setHours(Math.floor(startHour), (startHour % 1) * 60);
                
                const isPast = sessionDate < now;
                if (!isManual && status === 'pending' && sessionDate < oneWeekAgo) {
                    status = 'absent';
                }
                
                if (isPast && status !== 'cancelled') {
                    const duration = cls.duration || 1;
                    totalConductedHours += duration;
                    if (status === 'present') {
                        attendedHours += duration;
                    }
                }
            });
        }
        
        if (totalConductedHours === 0) return null;
        return Math.min(100, Math.max(0, Math.round((attendedHours / totalConductedHours) * 100)));
    })() : null;

    const palette = [
        { bg: isDark ? 'rgba(56, 162, 255, 0.22)' : 'rgba(41, 151, 255, 0.1)', border: isDark ? '#56aaff' : '#2997ff', text: isDark ? '#8ec5ff' : '#1a7fd4' },
        { bg: isDark ? 'rgba(60, 220, 100, 0.2)' : 'rgba(48, 209, 88, 0.1)', border: isDark ? '#4ade80' : '#30d158', text: isDark ? '#7defa0' : '#1da34a' },
        { bg: isDark ? 'rgba(200, 100, 252, 0.2)' : 'rgba(191, 90, 242, 0.1)', border: isDark ? '#c084fc' : '#bf5af2', text: isDark ? '#d8b4fe' : '#a03cd1' },
        { bg: isDark ? 'rgba(110, 220, 255, 0.2)' : 'rgba(100, 210, 255, 0.1)', border: isDark ? '#7dd3fc' : '#64d2ff', text: isDark ? '#a5e1fc' : '#00aae6' },
    ];
    
    // ── Derived view state ────────────────────────────────────────────────────
    const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    const todayClasses = currentSemClasses
        .filter((c: any) => c.day === todayIdx)
        .sort((a: any, b: any) => a.startHour - b.startHour);
    const unscheduledSubjects = currentSem ? getUnscheduledSubjects(currentSem) : [];
    const hasClasses = !!currentSem && currentSem.classes.length > 0;
    const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    // The tab bar floats over the screen, so whatever sits at the bottom of the
    // page pads itself by the bar's height rather than ending above it.
    const tabBarHeight = useTabBarHeight();

    const chipSurface = isDark ? theme.surfaceSecondary : '#ffffff';
    const iconButton = {
        width: 34, height: 34, borderRadius: 17,
        alignItems: 'center' as const, justifyContent: 'center' as const,
        backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
    };
    const toolPill = {
        height: 34, borderRadius: Radius.full,
        overflow: 'hidden' as const,
        flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
        backgroundColor: chipSurface,
        borderWidth: 1, borderColor: theme.cardBorder,
    };

    const summaryStatus = isOngoing
        ? { icon: 'radio' as const, tint: isDark ? '#4ade80' : '#16a34a', bg: isDark ? 'rgba(74,222,128,0.15)' : '#dcfce7' }
        : nextClassInfo
            ? { icon: 'time' as const, tint: isDark ? '#fbbf24' : '#d97706', bg: isDark ? 'rgba(251,191,36,0.15)' : '#fef3c7' }
            : { icon: 'calendar-outline' as const, tint: isDark ? '#818cf8' : '#4f46e5', bg: isDark ? 'rgba(99,102,241,0.18)' : '#e0e7ff' };

    const summarySubtitle = isOngoing
        ? `In progress · ${nextClassInfo.name}`
        : nextClassInfo
            ? `Next: ${nextClassInfo.name} in ${nextClassWaitStr}`
            : 'Nothing coming up';

    const viewModes: { key: 'grid' | 'list' | 'attendance'; label: string; icon: any }[] = [
        { key: 'grid', label: 'Grid', icon: 'grid' },
        { key: 'list', label: 'Glass', icon: 'albums' },
        { key: 'attendance', label: 'Attendance', icon: 'checkbox-outline' },
    ];

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
            {/* ── App bar: identity, term switcher, global actions ──────────── */}
            <View style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 8,
                backgroundColor: theme.surface,
                borderBottomWidth: 1, borderBottomColor: isDark ? theme.cardBorder : '#f1f5f9',
                zIndex: 20,
            }}>
                <View style={{
                    width: 34, height: 34, borderRadius: 17, marginRight: 10,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff',
                }}>
                    <Ionicons name="calendar" size={17} color={isDark ? '#818cf8' : '#4f46e5'} />
                </View>

                <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 17, color: theme.text }}>My Schedule</Text>
                        {isPremium ? (
                            <View style={{ backgroundColor: theme.success, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 }}>
                                <Text style={{ fontSize: 9, fontFamily: 'Nunito_800ExtraBold', color: '#fff' }}>PRO</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => setShowPaywall(true)}
                                accessibilityRole="button"
                                accessibilityLabel="Upgrade to FinScholar Pro"
                                style={{ backgroundColor: theme.primary, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 3 }}
                            >
                                <Ionicons name="diamond" size={9} color="#fff" />
                                <Text style={{ fontSize: 9, fontFamily: 'Nunito_800ExtraBold', color: '#fff' }}>GET PRO</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    {/* Term switcher, reduced to a subtitle chip so it costs no vertical row */}
                    <Tabs
                        years={data.years}
                        activeYearId={activeYearId}
                        activeSemId={activeSemId}
                        compact
                    />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {syncStatus === 'syncing' && <Ionicons name="cloud-upload" size={18} color={theme.textTertiary} />}
                    {syncStatus === 'saved' && <Ionicons name="cloud-done" size={18} color={theme.success} />}
                    {syncStatus === 'offline' && <Ionicons name="cloud-offline" size={18} color={theme.textTertiary} />}

                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/profile')}
                        accessibilityRole="button"
                        accessibilityLabel="Settings"
                        style={iconButton}
                    >
                        <Ionicons name="settings-outline" size={18} color={isDark ? '#cbd5e1' : '#475569'} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── View mode switch ─────────────────────────────────────────── */}
            <View style={{
                paddingHorizontal: GUTTER, paddingVertical: 7,
                backgroundColor: theme.surface,
                borderBottomWidth: 1, borderBottomColor: isDark ? theme.cardBorder : '#f1f5f9',
            }}>
                <View style={{
                    flexDirection: 'row', borderRadius: Radius.full, padding: 3,
                    backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
                    borderWidth: 1, borderColor: theme.cardBorder,
                }}>
                    {viewModes.map((mode) => {
                        const active = viewMode === mode.key;
                        return (
                            <TouchableOpacity
                                key={mode.key}
                                onPress={() => setViewMode(mode.key)}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: active }}
                                style={{
                                    flex: 1, paddingVertical: 6, borderRadius: Radius.full,
                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: active ? '#4f46e5' : 'transparent',
                                    ...(active ? Shadows.sm : {}),
                                }}
                            >
                                <Ionicons name={mode.icon} size={13} color={active ? '#ffffff' : theme.textSecondary} />
                                <Text style={{ marginLeft: 5, fontSize: 12, fontFamily: 'Nunito_700Bold', color: active ? '#ffffff' : theme.textSecondary }}>
                                    {mode.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* ── Body ─────────────────────────────────────────────────────── */}
            <View style={{ flex: 1 }}>
                {!currentSem ? (
                    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: tabBarHeight + 24 }}>
                        <View style={{
                            alignItems: 'center', padding: 28, borderRadius: Radius['4xl'],
                            backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.cardBorder,
                            ...(!isDark ? Shadows.sm : {}),
                        }}>
                            <Ionicons name="calendar-outline" size={44} color={isDark ? '#475569' : '#94a3b8'} style={{ marginBottom: 14 }} />
                            {data?.years?.length === 0 ? (
                                <>
                                    <Text style={{ textAlign: 'center', marginBottom: 18, fontFamily: 'Nunito_700Bold', color: theme.textSecondary }}>
                                        No years added yet.{'\n'}Set up your academic terms to get started!
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => router.push('/academic-manager')}
                                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: '#4f46e5' }}
                                    >
                                        <Ionicons name="add" size={19} color="#fff" />
                                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', color: '#fff', marginLeft: 7 }}>Setup Academic Term</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <Text style={{ textAlign: 'center', fontFamily: 'Nunito_700Bold', color: theme.textSecondary }}>
                                    No semester selected.{'\n'}Pick a term from the header to view your schedule!
                                </Text>
                            )}
                        </View>
                    </ScrollView>
                ) : (
                    <View style={{ flex: 1 }}>
                        {/* ── Primary actions + timetable tools, one slim row ─── */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: GUTTER, marginTop: 10, marginBottom: 8, gap: 6 }}>
                            <SpotlightTarget id={SPOTLIGHT_IDS.scheduleAddClass} style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                                <TouchableOpacity
                                    // Quick Scan runs on-device and costs nothing, so the
                                    // sheet opens for everyone. The paywall now guards the
                                    // AI mode inside it rather than the whole feature.
                                    onPress={() => setShowScanner(true)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Scan a schedule image"
                                    style={{
                                        flex: 1, height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                        borderRadius: Radius.full, backgroundColor: '#4f46e5',
                                        ...(!isDark ? Shadows.sm : {}),
                                    }}
                                >
                                    <Ionicons name="sparkles" size={14} color="#fff" />
                                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: '#fff', marginLeft: 5 }}>Scan</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => { setEditingClass(null); setShowEditModal(true); }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Add a class"
                                    style={{
                                        flex: 1, height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                        borderRadius: Radius.full, backgroundColor: chipSurface,
                                        borderWidth: 1, borderColor: theme.cardBorder,
                                    }}
                                >
                                    <Ionicons name="add" size={16} color={theme.text} />
                                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: theme.text, marginLeft: 3 }}>Add</Text>
                                </TouchableOpacity>
                            </SpotlightTarget>

                            {viewMode === 'grid' && (
                                <>
                                    <TouchableOpacity
                                        onPress={() => setIsQuickEditMode(!isQuickEditMode)}
                                        accessibilityRole="button"
                                        accessibilityLabel={isQuickEditMode ? 'Exit quick edit mode' : 'Enter quick edit mode'}
                                        style={{
                                            ...toolPill,
                                            width: 34,
                                            backgroundColor: isQuickEditMode ? '#4f46e5' : chipSurface,
                                            borderColor: isQuickEditMode ? '#4f46e5' : theme.cardBorder,
                                        }}
                                    >
                                        <Ionicons name={isQuickEditMode ? 'close' : 'flash'} size={16} color={isQuickEditMode ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b')} />
                                    </TouchableOpacity>

                                    <View style={{ ...toolPill, paddingHorizontal: 2 }}>
                                        <TouchableOpacity
                                            onPress={() => setZoomScale(s => Math.max(0.25, s - 0.25))}
                                            accessibilityRole="button"
                                            accessibilityLabel="Zoom out"
                                            style={{ width: 26, height: 30, alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <Ionicons name="remove" size={16} color={isDark ? '#e2e8f0' : '#475569'} />
                                        </TouchableOpacity>
                                        <Text style={{ width: 32, textAlign: 'center', fontFamily: 'Nunito_800ExtraBold', fontSize: 10.5, color: theme.textSecondary }}>
                                            {Math.round(zoomScale * 100)}%
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => setZoomScale(s => Math.min(1.0, s + 0.25))}
                                            accessibilityRole="button"
                                            accessibilityLabel="Zoom in"
                                            style={{ width: 26, height: 30, alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <Ionicons name="add" size={16} color={isDark ? '#e2e8f0' : '#475569'} />
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}

                            {viewMode !== 'attendance' && (
                                <TouchableOpacity
                                    onPress={handleExportSchedule}
                                    disabled={isCapturing}
                                    accessibilityRole="button"
                                    accessibilityState={{ disabled: isCapturing, busy: isCapturing }}
                                    accessibilityLabel={isCapturing ? 'Preparing export' : 'Export schedule as image'}
                                    style={{ ...toolPill, width: 34, opacity: isCapturing ? 0.55 : 1 }}
                                >
                                    {isCapturing
                                        ? <ActivityIndicator size="small" color={isDark ? '#a5b4fc' : '#4f46e5'} />
                                        : <Ionicons name="download-outline" size={16} color={isDark ? '#a5b4fc' : '#4f46e5'} />}
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Today / next class digest — opens the full overview sheet */}
                        <TouchableOpacity
                            onPress={() => setShowOverview(true)}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel={`${todayLabel}, ${todayClasses.length} classes today. ${summarySubtitle}. Open schedule overview.`}
                            style={{
                                flexDirection: 'row', alignItems: 'center',
                                marginHorizontal: GUTTER, marginBottom: 8,
                                paddingHorizontal: 10, paddingVertical: 6,
                                borderRadius: Radius.lg,
                                backgroundColor: theme.surface,
                                borderWidth: 1, borderColor: theme.cardBorder,
                            }}
                        >
                            <View style={{ width: 24, height: 24, borderRadius: 12, marginRight: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: summaryStatus.bg }}>
                                <Ionicons name={summaryStatus.icon} size={13} color={summaryStatus.tint} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: theme.text }}>
                                    {todayLabel} · {todayClasses.length === 0 ? 'No classes' : `${todayClasses.length} class${todayClasses.length > 1 ? 'es' : ''}`}
                                </Text>
                                <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 10.5, color: theme.textSecondary }}>
                                    {summarySubtitle}
                                </Text>
                            </View>
                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 10, color: theme.textTertiary, marginRight: 2 }}>Overview</Text>
                            <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
                        </TouchableOpacity>

                        {/* Subjects that still have no class times — one tappable line */}
                        {unscheduledSubjects.length > 0 && (
                            <TouchableOpacity
                                onPress={() => router.push('/(tabs)/grades')}
                                activeOpacity={0.75}
                                style={{
                                    flexDirection: 'row', alignItems: 'center',
                                    marginHorizontal: GUTTER, marginBottom: 8,
                                    paddingHorizontal: 10, paddingVertical: 6,
                                    borderRadius: Radius.lg,
                                    backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff',
                                    borderWidth: 1, borderColor: isDark ? 'rgba(59,130,246,0.3)' : '#bfdbfe',
                                }}
                            >
                                <Ionicons name="school-outline" size={14} color="#3b82f6" style={{ marginRight: 7 }} />
                                <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 11, color: isDark ? '#93c5fd' : '#1d4ed8' }}>
                                    {unscheduledSubjects.length} subject{unscheduledSubjects.length > 1 ? 's' : ''} without class times
                                </Text>
                                <Ionicons name="chevron-forward" size={13} color="#3b82f6" />
                            </TouchableOpacity>
                        )}

                        {/* ── The schedule itself, filling everything that is left ─ */}
                        {viewMode === 'grid' ? (
                            <View style={{ flex: 1, paddingHorizontal: GUTTER, paddingBottom: tabBarHeight + 8 }}>
                                {!hasClasses ? (
                                    <EmptyScheduleCard isDark={isDark} theme={theme} />
                                ) : (
                                    <TimetableGrid
                                        classes={currentSem.classes}
                                        isDark={isDark}
                                        isQuickEditMode={isQuickEditMode}
                                        zoomScale={zoomScale}
                                        fillHeight
                                        revealToken={revealToken}
                                        onUpdateClass={onUpdateClass}
                                        onUpdateClasses={onUpdateClasses}
                                        onDeleteClasses={handleDeleteClasses}
                                        onPressClass={(cls: any) => {
                                            if (!isQuickEditMode) setSelectedClass(cls);
                                        }}
                                    />
                                )}
                            </View>
                        ) : viewMode === 'list' ? (
                            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: tabBarHeight + 16, flexGrow: 1 }}>
                                {!hasClasses ? (
                                    <EmptyScheduleCard isDark={isDark} theme={theme} />
                                ) : (
                                    <ViewShot ref={viewShotListRef} options={{ format: 'jpg', quality: 1 }}>
                                        <ScheduleListView
                                            classes={currentSem.classes}
                                            isDark={isDark}
                                            currentSem={currentSem}
                                            currentYear={currentYear}
                                        />
                                    </ViewShot>
                                )}
                            </ScrollView>
                        ) : (
                            <View style={{ flex: 1, paddingBottom: tabBarHeight }}>
                                <AttendanceTracker
                                    data={data}
                                    activeYearId={activeYearId}
                                    activeSemId={activeSemId}
                                    saveData={saveData}
                                    targetDate={params.targetDate as string}
                                    trigger={params.trigger as string}
                                />
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Off-screen render target for the image export. Mounted ONLY for the
                duration of a capture — see `exportRender` — and only for the theme
                being captured, so the screen carries none of this while idle. */}
            {currentSem && exportRender && (
                <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, zIndex: -1, opacity: 0 }}>
                    {exportDark ? (
                    <ViewShot ref={viewShotDarkRef} options={{ format: 'jpg', quality: 1 }}>
                        <View style={{ width: 3084, backgroundColor: '#0f172a', borderRadius: 24, overflow: 'hidden' }}>
                            <ImageBackground
                                source={require('../../assets/images/ExportBg.png')}
                                style={{ width: 3084, height: 380 }}
                                imageStyle={{ resizeMode: 'cover', width: 3084, height: 380 }}
                            >
                                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 80, paddingBottom: 40, backgroundColor: 'rgba(15,23,42,0.6)' }}>
                                    <View>
                                        <Text style={{ fontSize: 72, fontWeight: '900', color: '#ffffff', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 12 }}>FinScholar</Text>
                                        <Text style={{ fontSize: 36, fontWeight: '700', color: 'rgba(255,255,255,0.95)', marginTop: 8, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 }}>My Schedule • {currentSem.name}</Text>
                                    </View>
                                    <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }}>
                                        <Text style={{ fontSize: 28, fontWeight: '700', color: '#ffffff' }}>{currentYear?.name || ''}</Text>
                                    </View>
                                </View>
                            </ImageBackground>
                            <View style={{ padding: 16, paddingTop: 12 }}>
                                <View style={{ width: 3052, borderRadius: 20, overflow: 'hidden', borderWidth: 3, borderColor: '#3B82F6', backgroundColor: '#1e293b' }}>
                                    <TimetableGrid
                                        classes={currentSem.classes}
                                        isDark={true}
                                        isQuickEditMode={false}
                                        isExportMode={true}
                                        onUpdateClass={() => {}}
                                        onPressClass={() => {}}
                                    />
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 18, paddingTop: 0 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="school" size={14} color="#6366f1" style={{ marginRight: 6 }} />
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#6366f1' }}>FinScholar</Text>
                                </View>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: '#475569' }}>Generated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                            </View>
                        </View>
                    </ViewShot>
                    ) : (
                    <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 1 }}>
                        <View style={{ width: 3084, backgroundColor: '#f1f5f9', borderRadius: 24, overflow: 'hidden' }}>
                            <ImageBackground
                                source={require('../../assets/images/ExportBg.png')}
                                style={{ width: 3084, height: 380 }}
                                imageStyle={{ resizeMode: 'cover', width: 3084, height: 380 }}
                            >
                                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 80, paddingBottom: 40, backgroundColor: 'rgba(15,23,42,0.4)' }}>
                                    <View>
                                        <Text style={{ fontSize: 72, fontWeight: '900', color: '#ffffff', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 12 }}>FinScholar</Text>
                                        <Text style={{ fontSize: 36, fontWeight: '700', color: '#ffffff', marginTop: 8, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 }}>My Schedule • {currentSem.name}</Text>
                                    </View>
                                    <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }}>
                                        <Text style={{ fontSize: 28, fontWeight: '700', color: '#ffffff' }}>{currentYear?.name || ''}</Text>
                                    </View>
                                </View>
                            </ImageBackground>
                            <View style={{ padding: 16, paddingTop: 12 }}>
                                <View style={{ width: 3052, borderRadius: 20, overflow: 'hidden', borderWidth: 3, borderColor: '#60A5FA', backgroundColor: '#ffffff' }}>
                                    <TimetableGrid
                                        classes={currentSem.classes}
                                        isDark={false}
                                        isQuickEditMode={false}
                                        isExportMode={true}
                                        onUpdateClass={() => {}}
                                        onPressClass={() => {}}
                                    />
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 18, paddingTop: 0 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="school" size={14} color="#4f46e5" style={{ marginRight: 6 }} />
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#4f46e5' }}>FinScholar</Text>
                                </View>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: '#94a3b8' }}>Generated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                            </View>
                        </View>
                    </ViewShot>
                    )}
                </View>
            )}

            {/* ── Schedule overview sheet ──────────────────────────────────── */}
            <Modal visible={showOverview} transparent animationType="slide" onRequestClose={() => setShowOverview(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowOverview(false)} />
                    <View style={{
                        maxHeight: '88%',
                        borderTopLeftRadius: Radius['4xl'], borderTopRightRadius: Radius['4xl'],
                        backgroundColor: isDark ? theme.surface : '#ffffff',
                        paddingTop: 10,
                    }}>
                        <View style={{ alignItems: 'center', marginBottom: 10 }}>
                            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: isDark ? '#334155' : '#cbd5e1' }} />
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 }}>
                            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 20, color: theme.text }}>Schedule Overview</Text>
                            <TouchableOpacity
                                onPress={() => setShowOverview(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Close overview"
                                style={iconButton}
                            >
                                <Ionicons name="close" size={19} color={isDark ? '#cbd5e1' : '#475569'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
                            {/* Hero: date + Fin's nudge */}
                            <View style={{
                                borderRadius: Radius['3xl'], overflow: 'hidden', marginBottom: 14,
                                backgroundColor: isDark ? '#312e81' : '#6b63ff',
                                paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18,
                            }}>
                                <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                                    <Defs>
                                        <LinearGradient id="schedHeroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <Stop offset="0%" stopColor={isDark ? '#312e81' : '#7b6eff'} />
                                            <Stop offset="100%" stopColor={isDark ? '#1e1b4b' : '#5b54fa'} />
                                        </LinearGradient>
                                    </Defs>
                                    <Rect width="100%" height="100%" fill="url(#schedHeroGrad)" />
                                    <Circle cx="0%" cy="0%" r="150" fill="rgba(255, 255, 255, 0.04)" />
                                    <Circle cx="100%" cy="100%" r="200" fill="rgba(255, 255, 255, 0.08)" />
                                </Svg>

                                <View style={{ position: 'absolute', right: 2, bottom: -6, width: 116, height: 128 }}>
                                    <Image
                                        source={require('../../assets/images/finscheduleherocard.png')}
                                        style={{ width: 116, height: 128 }}
                                        resizeMode="contain"
                                    />
                                </View>

                                <View style={{ maxWidth: '64%', zIndex: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                        <Ionicons name="sparkles" size={13} color="#e0e7ff" />
                                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 11, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                            Schedule Hub
                                        </Text>
                                    </View>
                                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 19, color: '#ffffff', marginBottom: 9, letterSpacing: -0.3 }}>
                                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </Text>
                                    <View style={{
                                        flexDirection: 'row', alignItems: 'center',
                                        backgroundColor: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.15)',
                                        borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)',
                                        paddingHorizontal: 11, paddingVertical: 9, borderRadius: 14,
                                    }}>
                                        <Ionicons name="chatbubble-ellipses" size={13} color="#e0e7ff" style={{ marginRight: 7, alignSelf: 'flex-start', marginTop: 2 }} />
                                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: '#ffffff', flexShrink: 1, lineHeight: 16 }}>
                                            {quote || 'Every class brings you closer to your graduation goals!'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Term metrics */}
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                <OverviewMetric
                                    theme={theme} isDark={isDark}
                                    icon="time" iconBg={isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff'} iconColor={isDark ? '#818cf8' : '#4f46e5'}
                                    label="Today's Classes" value={`${todayClasses.length} Classes`}
                                />
                                <OverviewMetric
                                    theme={theme} isDark={isDark}
                                    icon="calendar" iconBg={isDark ? 'rgba(14,165,233,0.2)' : '#e0f2fe'} iconColor={isDark ? '#38bdf8' : '#0ea5e9'}
                                    label="Weekly Total" value={`${currentSemClasses.length} Blocks`}
                                />
                                <OverviewMetric
                                    theme={theme} isDark={isDark}
                                    icon="checkmark-circle" iconBg={isDark ? 'rgba(16,185,129,0.2)' : '#d1fae5'} iconColor={isDark ? '#34d399' : '#10b981'}
                                    label="Attendance" value={overallAttendance === null ? 'N/A' : `${overallAttendance}%`}
                                />
                                <OverviewMetric
                                    theme={theme} isDark={isDark}
                                    icon="school" iconBg={isDark ? 'rgba(245,158,11,0.2)' : '#fef3c7'} iconColor={isDark ? '#fbbf24' : '#f59e0b'}
                                    label="Active Term" value={currentSem ? `${currentYear?.name || ''} • ${currentSem.name}` : 'No Term'} small
                                />
                            </View>

                            {/* Next / ongoing class */}
                            {nextClassInfo && (
                                <View style={{
                                    flexDirection: 'row', alignItems: 'center',
                                    padding: 13, borderRadius: Radius['2xl'], marginBottom: 16,
                                    backgroundColor: summaryStatus.bg,
                                    borderWidth: 1, borderColor: summaryStatus.tint + '55',
                                }}>
                                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, marginRight: 10, backgroundColor: summaryStatus.tint }}>
                                        <Text style={{ fontSize: 9.5, fontFamily: 'Nunito_800ExtraBold', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                            {isOngoing ? 'Ongoing' : 'Next'}
                                        </Text>
                                    </View>
                                    <Text style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.text }} numberOfLines={1}>
                                        {nextClassInfo.name}
                                        {!isOngoing && nextClassWaitStr ? ` · in ${nextClassWaitStr}` : ''}
                                    </Text>
                                </View>
                            )}

                            {/* Today's classes */}
                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>
                                Today
                            </Text>
                            {todayClasses.length === 0 ? (
                                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 13, fontStyle: 'italic', color: theme.textTertiary, marginBottom: 16 }}>
                                    No classes today 🎉
                                </Text>
                            ) : (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
                                    {todayClasses.map((cls: any, i: number) => (
                                        <View
                                            key={cls.id || i}
                                            style={{
                                                flexDirection: 'row', alignItems: 'center',
                                                paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, borderWidth: 1,
                                                backgroundColor: palette[cls.colorIdx % palette.length].bg,
                                                borderColor: palette[cls.colorIdx % palette.length].border,
                                            }}
                                        >
                                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, marginRight: 5, color: palette[cls.colorIdx % palette.length].text }}>{cls.name}</Text>
                                            <Text style={{ fontSize: 10, opacity: 0.85, color: palette[cls.colorIdx % palette.length].text }}>{formatHour(cls.startHour)}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Upcoming deadlines */}
                            {upcomingMilestones.length > 0 && (
                                <>
                                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>
                                        Upcoming
                                    </Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
                                        {upcomingMilestones.map((m: any, i: number) => {
                                            const itemMidnight = parseLocalDate(m.date);
                                            const todayMidnight = new Date().setHours(0, 0, 0, 0);
                                            const diffDays = Math.round((itemMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
                                            return (
                                                <View key={i} style={{
                                                    flexDirection: 'row', alignItems: 'center',
                                                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1,
                                                    backgroundColor: isDark ? theme.surfaceSecondary : '#ffffff',
                                                    borderColor: theme.cardBorder,
                                                }}>
                                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: theme.text }}>{m.name || m.title}</Text>
                                                    <Text style={{ fontSize: 10, marginLeft: 6, color: isDark ? '#60a5fa' : '#3b82f6' }}>
                                                        • {diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : `${diffDays} days`}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </>
                            )}

                            {/* Subjects still missing class times */}
                            {unscheduledSubjects.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => { setShowOverview(false); router.push('/(tabs)/grades'); }}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center',
                                        padding: 13, borderRadius: Radius['2xl'], marginBottom: 16,
                                        backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff',
                                        borderWidth: 1, borderColor: isDark ? 'rgba(59,130,246,0.3)' : '#bfdbfe',
                                    }}
                                >
                                    <Ionicons name="school-outline" size={17} color="#3b82f6" style={{ marginRight: 10 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: isDark ? '#93c5fd' : '#1d4ed8' }}>
                                            {unscheduledSubjects.length} subject{unscheduledSubjects.length > 1 ? 's' : ''} without a schedule
                                        </Text>
                                        <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11, marginTop: 2, color: isDark ? 'rgba(147,197,253,0.75)' : '#2563eb' }}>
                                            {unscheduledSubjects.map((sub: any) => sub.name).join(', ')}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={15} color="#3b82f6" />
                                </TouchableOpacity>
                            )}

                            {/* Destructive action, deliberately last */}
                            <TouchableOpacity
                                onPress={() => { setShowOverview(false); setTimeout(handleResetSchedule, 300); }}
                                accessibilityRole="button"
                                accessibilityLabel="Delete all classes in this term"
                                style={{
                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                    paddingVertical: 13, borderRadius: Radius['2xl'],
                                    backgroundColor: isDark ? 'rgba(127,29,29,0.3)' : '#fef2f2',
                                    borderWidth: 1, borderColor: isDark ? 'rgba(153,27,27,0.5)' : '#fecaca',
                                }}
                            >
                                <Ionicons name="trash" size={16} color="#ef4444" />
                                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: '#ef4444', marginLeft: 7 }}>Reset Schedule</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
            
            <ScheduleScannerModal 
                visible={showScanner} 
                onClose={() => setShowScanner(false)} 
                onApply={handleScannedClasses} 
                isPremium={isPremium}
                onRequestPremium={() => { setShowScanner(false); setShowPaywall(true); }}
            />

            <PremiumPaywallModal 
                visible={showPaywall} 
                onClose={() => setShowPaywall(false)} 
            />

            <DevMenuModal 
                visible={showDevMenu}
                onClose={() => setShowDevMenu(false)}
                isDark={isDark}
                onShowPaywall={() => setShowPaywall(true)}
            />

            <ClassDetailsModal 
                visible={!!selectedClass && !showEditModal} 
                cls={selectedClass} 
                isDark={isDark} 
                onClose={() => setSelectedClass(null)} 
                onEdit={() => {
                    const subjectClasses = currentSemClasses.filter((c: any) => c.name === selectedClass.name);
                    setEditingClass({
                        name: selectedClass.name,
                        instructor: selectedClass.instructor,
                        colorIdx: selectedClass.colorIdx,
                        schedules: subjectClasses.map((c: any) => ({
                            id: c.id, day: c.day, startHour: c.startHour, duration: c.duration, room: c.room || ''
                        }))
                    });
                    setShowEditModal(true);
                }}
                onDelete={() => {
                    AlertService.alert("Delete Class", `Remove ${selectedClass?.name}?`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => handleDeleteClasses([selectedClass.id]) }
                    ]);
                }}
            />

            <ClassEditModal 
                visible={showEditModal} 
                initialCls={editingClass} 
                isDark={isDark} 
                onClose={() => setShowEditModal(false)} 
                onSave={handleSaveClass} 
            />

            <Modal visible={showAiWarning} transparent animationType="fade">
                <View className="flex-1 justify-center items-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View className={`w-full p-6 rounded-3xl items-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                        <TouchableOpacity 
                            onPress={() => setShowAiWarning(false)} 
                            className="absolute top-4 right-4 p-2"
                        >
                            <Ionicons name="close" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
                        </TouchableOpacity>
                        <Image source={require('../../assets/images/FinSights.png')} className="w-20 h-20 mb-4" resizeMode="cover" />
                        <Text className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Check My Work!</Text>
                        <Text className={`text-center mb-6 leading-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            I've extracted your schedule, but AI can sometimes be slightly off with exact time blocks. In Quick Edit, hold a block and drag it to the right day and time.
                        </Text>
                        <TouchableOpacity 
                            onPress={() => { setShowAiWarning(false); setIsQuickEditMode(true); }}
                            className="flex-row items-center justify-center bg-yellow-500 px-6 py-3 rounded-full w-full"
                        >
                            <Ionicons name="flash" size={18} color="#111827" />
                            <Text className="font-bold text-gray-900 ml-2">Start Quick Edit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            <Modal visible={showPreviewModal} transparent={true} animationType="fade">
                <View className="flex-1 bg-black/90 justify-center items-center">
                    <View className="w-11/12 bg-white rounded-3xl overflow-hidden shadow-2xl p-6">
                        <Text className="text-xl font-bold text-center mb-3 text-slate-800">Preview Schedule</Text>
                        {/* Theme Toggle */}
                        <View style={{ flexDirection: 'row', alignSelf: 'center', marginBottom: 14, backgroundColor: '#f1f5f9', borderRadius: 12, padding: 3 }}>
                            <TouchableOpacity
                                onPress={() => { if (exportDark) handleToggleExportTheme(); }}
                                style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10, backgroundColor: !exportDark ? '#ffffff' : 'transparent', borderWidth: !exportDark ? 1 : 0, borderColor: '#e2e8f0' }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="sunny-outline" size={15} color={!exportDark ? '#f59e0b' : '#94a3b8'} />
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: !exportDark ? '#1e293b' : '#94a3b8', marginLeft: 5 }}>Light</Text>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => { if (!exportDark) handleToggleExportTheme(); }}
                                style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10, backgroundColor: exportDark ? '#1e293b' : 'transparent' }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="moon-outline" size={15} color={exportDark ? '#818cf8' : '#94a3b8'} />
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: exportDark ? '#ffffff' : '#94a3b8', marginLeft: 5 }}>Dark</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                        {previewUri && (
                            <View className="border border-slate-200 rounded-2xl overflow-hidden mb-5 bg-slate-100">
                                <Image source={{ uri: previewUri }} className="w-full h-[400px]" resizeMode="contain" />
                            </View>
                        )}
                        <View className="flex-row justify-between" style={{ gap: 16 }}>
                            <TouchableOpacity 
                                className="flex-1 py-4 bg-slate-200 rounded-2xl items-center"
                                onPress={closeExportPreview}
                            >
                                <Text className="font-bold text-slate-700 text-lg">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                className="flex-1 flex-row py-4 bg-indigo-600 rounded-2xl items-center justify-center"
                                onPress={handleSaveToGallery}
                            >
                                <Ionicons name="download-outline" size={22} color="white" />
                                <Text className="font-bold text-white text-lg ml-2">Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

/**
 * Shown in place of the timetable when the term has no classes yet. The grid
 * would otherwise render as an empty week, which reads as a bug rather than an
 * invitation to add something.
 */
function EmptyScheduleCard({ isDark, theme }: { isDark: boolean; theme: any }) {
    return (
        // The card sizes to its content and is centred in whatever space is left,
        // rather than stretching: a full-height tinted slab reads as a broken
        // screen next to the surface-coloured cards above it.
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
                width: '100%', maxWidth: 340, alignItems: 'center',
                paddingHorizontal: 26, paddingVertical: 30,
                borderRadius: Radius['3xl'],
                backgroundColor: theme.surface,
                borderWidth: 1, borderColor: theme.cardBorder,
                ...(isDark ? {} : (Shadows.sm as object)),
            }}>
                <View style={{
                    width: 88, height: 88, borderRadius: 44, marginBottom: 16,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isDark ? 'rgba(129, 140, 248, 0.12)' : '#eef2ff',
                    borderWidth: 1, borderColor: isDark ? 'rgba(129, 140, 248, 0.22)' : '#e0e7ff',
                }}>
                    {/* The PNG is transparent, so it needs no plate behind it —
                        `contain` also keeps Fin's question marks inside the halo. */}
                    <Image
                        source={require('../../assets/images/confused.png')}
                        style={{ width: 68, height: 68 }}
                        resizeMode="contain"
                    />
                </View>
                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 17, marginBottom: 6, color: theme.text }}>
                    Fin is confused! 🤔
                </Text>
                <Text style={{ textAlign: 'center', fontFamily: 'Nunito_400Regular', fontSize: 13, lineHeight: 19, color: theme.textSecondary }}>
                    There are no classes here yet. Scan a photo of your timetable, or add classes by hand with the buttons above.
                </Text>
            </View>
        </View>
    );
}

interface OverviewMetricProps {
    theme: any;
    isDark: boolean;
    icon: any;
    iconBg: string;
    iconColor: string;
    label: string;
    value: string;
    /** Term names run long, so they get the smaller value type. */
    small?: boolean;
}

/** One tile of the term stats grid inside the overview sheet. */
function OverviewMetric({ theme, isDark, icon, iconBg, iconColor, label, value, small }: OverviewMetricProps) {
    return (
        <View style={{
            flex: 1, minWidth: '45%',
            paddingHorizontal: 11, paddingVertical: 9,
            borderRadius: Radius['2xl'],
            backgroundColor: isDark ? theme.surfaceSecondary : '#f8fafc',
            borderWidth: 1, borderColor: theme.cardBorder,
        }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: iconBg }}>
                    <Ionicons name={icon} size={11} color={iconColor} />
                </View>
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: theme.textSecondary }}>{label}</Text>
            </View>
            <Text
                numberOfLines={1}
                style={small
                    ? { fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.text }
                    : { fontFamily: 'Nunito_900Black', fontSize: 16, color: theme.text }}
            >
                {value}
            </Text>
        </View>
    );
}
