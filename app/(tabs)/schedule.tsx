import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Image, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseClient';
import { SyncService } from '../../services/SyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Tabs from '@/components/ledger/Tabs';
import TimetableGrid, { LIGHT_COLORS, DARK_COLORS } from '@/components/schedule/TimetableGrid';
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
import { getTheme, Typography, Radius, Shadows } from '@/constants/Theme';
import { ListSkeleton } from '@/components/ui/LoadingSkeleton';

const generateId = () => Math.random().toString(36).substr(2, 9);

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
  const { selectedYear, selectedSemester, setYearAndSemester, isLoaded } = useSemesterContext();
  const [activeYearId, setLocalYearId] = useState<string | null>(null);
  const [activeSemId, setLocalSemId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded) {
      if (selectedYear) setLocalYearId(selectedYear);
      if (selectedSemester) setLocalSemId(selectedSemester);
    }
  }, [isLoaded, selectedYear, selectedSemester]);

  const setActiveYearId = (id: string | null) => {
    setLocalYearId(id);
    if (id && activeSemId) setYearAndSemester(id, activeSemId);
  };

  const setActiveSemId = (id: string | null) => {
    setLocalSemId(id);
    if (activeYearId && id) setYearAndSemester(activeYearId, id);
  };
    
    const params = useLocalSearchParams();
    const [viewMode, setViewMode] = useState<'grid' | 'attendance' | 'list'>(params.viewMode === 'attendance' ? 'attendance' : 'grid');
    const [isQuickEditMode, setIsQuickEditMode] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [showDevMenu, setShowDevMenu] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'offline' | 'syncing' | 'saved'>('offline');
    const [showAiWarning, setShowAiWarning] = useState(false);
    const [upcomingMilestones, setUpcomingMilestones] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [editingClass, setEditingClass] = useState<any>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const viewShotRef = React.useRef<any>(null);
    const viewShotDarkRef = React.useRef<any>(null);
    const viewShotListRef = React.useRef<any>(null);
    const quickEditSaveTimeout = React.useRef<NodeJS.Timeout | null>(null);

    const [previewUri, setPreviewUri] = useState<string | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [exportDark, setExportDark] = useState(true);

    const handleExportSchedule = async () => {
        let ref;
        if (viewMode === 'list') {
            ref = viewShotListRef;
        } else {
            ref = exportDark ? viewShotDarkRef : viewShotRef;
        }
        if (!ref?.current) return;
        try {
            // Delay to ensure image assets are decoded before capture
            await new Promise(resolve => setTimeout(resolve, 500));
            const uri = await ref.current.capture();
            setPreviewUri(uri);
            setShowPreviewModal(true);
        } catch (e: any) {
            AlertService.alert('Export Failed', e.message);
        }
    };

    const handleToggleExportTheme = async () => {
        const newDark = !exportDark;
        setExportDark(newDark);
        const ref = newDark ? viewShotDarkRef : viewShotRef;
        if (!ref.current) return;
        try {
            await new Promise(resolve => setTimeout(resolve, 400));
            const uri = await ref.current.capture();
            setPreviewUri(uri);
        } catch (e: any) {
            // silent fail - keep current preview
        }
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
            setShowPreviewModal(false);
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

    const normalizeDay = (day: any) => {
        if (typeof day === 'number') return Math.max(0, Math.min(6, day));
        if (typeof day !== 'string') return 0;
        const d = day.toLowerCase().trim();
        if (d.startsWith('tu')) return 1;
        if (d.startsWith('w')) return 2;
        if (d.startsWith('th')) return 3;
        if (d.startsWith('f')) return 4;
        if (d.startsWith('sa')) return 5;
        if (d.startsWith('su')) return 6;
        return 0;
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
                let parsedStartHour = 8;
                if (typeof rawTime === 'number') {
                    parsedStartHour = rawTime;
                } else if (typeof rawTime === 'string') {
                    const match = rawTime.match(/(\d+)/);
                    if (match) {
                        parsedStartHour = parseInt(match[1]);
                        if (rawTime.toLowerCase().includes('pm') && parsedStartHour < 12) parsedStartHour += 12;
                    }
                }

                let dur = sc.duration || 1;
                if (typeof dur === 'string') {
                    const match = dur.match(/(\d+(\.\d+)?)/);
                    if (match) dur = parseFloat(match[1]);
                    else dur = 1;
                }

                nd.years.find((y: any) => y.id === activeYearId)?.semesters.find((s: any) => s.id === activeSemId)?.classes.push({
                    id: generateId(),
                    name: className,
                    room: sc.room || sc.location || '',
                    instructor: sc.instructor || sc.teacher || '',
                    day: normalizeDay(sc.day),
                    startHour: parsedStartHour,
                    duration: dur,
                    colorIdx: sc.colorIdx || Math.floor(Math.random() * 6),
                    subjectId,
                    absences: 0, lates: 0, cuts: 0
                });
            } else {
                // Nested format
                const safeSchedules = sc.schedules || [];
                safeSchedules.forEach((sch: any) => {
                    let parsedStartHour = 8;
                    const schTime = sch.startHour !== undefined ? sch.startHour : (sch.time || sch.startTime || sch.start_time);
                    if (typeof schTime === 'number') {
                        parsedStartHour = schTime;
                    } else if (typeof schTime === 'string') {
                        const match = schTime.match(/(\d+)/);
                        if (match) {
                            parsedStartHour = parseInt(match[1]);
                            if (schTime.toLowerCase().includes('pm') && parsedStartHour < 12) parsedStartHour += 12;
                        }
                    }

                    let dur = sch.duration || 1;
                    if (typeof dur === 'string') {
                        const match = dur.match(/(\d+(\.\d+)?)/);
                        if (match) dur = parseFloat(match[1]);
                        else dur = 1;
                    }

                    nd.years.find((y: any) => y.id === activeYearId)?.semesters.find((s: any) => s.id === activeSemId)?.classes.push({
                        id: generateId(),
                        name: className,
                        room: sc.room || sc.location || sch.room || '',
                        instructor: sc.instructor || sc.teacher || '',
                        day: normalizeDay(sch.day),
                        startHour: parsedStartHour,
                        duration: dur,
                        colorIdx: sc.colorIdx || Math.floor(Math.random() * 6),
                        subjectId,
                        absences: 0, lates: 0, cuts: 0
                    });
                });
            }
        });
        saveData(nd);
        setShowScanner(false);
        setShowAiWarning(true);
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
                                    const raw = await (await import('@react-native-async-storage/async-storage')).default.getItem('grade_ledger_v2_data');
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

        let minWaitHours = Infinity;
        
        currentSemClasses.forEach((cls: any) => {
            if (cls.day === currentDayIdx && currentHourFloat >= cls.startHour && currentHourFloat < cls.startHour + (cls.duration || 1)) {
                nextClassInfo = cls;
                isOngoing = true;
            }
        });

        if (!isOngoing) {
            currentSemClasses.forEach((cls: any) => {
                let daysUntil = cls.day - currentDayIdx;
                if (daysUntil < 0 || (daysUntil === 0 && cls.startHour <= currentHourFloat)) daysUntil += 7;
                const waitHours = (daysUntil * 24) + (cls.startHour - currentHourFloat);
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
    
    const palette = [
        { bg: isDark ? 'rgba(56, 162, 255, 0.22)' : 'rgba(41, 151, 255, 0.1)', border: isDark ? '#56aaff' : '#2997ff', text: isDark ? '#8ec5ff' : '#1a7fd4' },
        { bg: isDark ? 'rgba(60, 220, 100, 0.2)' : 'rgba(48, 209, 88, 0.1)', border: isDark ? '#4ade80' : '#30d158', text: isDark ? '#7defa0' : '#1da34a' },
        { bg: isDark ? 'rgba(200, 100, 252, 0.2)' : 'rgba(191, 90, 242, 0.1)', border: isDark ? '#c084fc' : '#bf5af2', text: isDark ? '#d8b4fe' : '#a03cd1' },
        { bg: isDark ? 'rgba(110, 220, 255, 0.2)' : 'rgba(100, 210, 255, 0.1)', border: isDark ? '#7dd3fc' : '#64d2ff', text: isDark ? '#a5e1fc' : '#00aae6' },
    ];
    
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            {/* Header */}
            <View style={{
                paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, zIndex: 10,
                borderBottomWidth: 1, borderBottomColor: isDark ? theme.cardBorder : '#f1f5f9',
                backgroundColor: theme.surface,
                ...(!isDark ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 } : {}),
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                            width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12,
                            backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff',
                        }}>
                            <Ionicons name="calendar" size={20} color={isDark ? '#818cf8' : '#6366f1'} />
                        </View>
                        <View>
                            <Text style={{ ...Typography.title, color: theme.text }}>My Schedule</Text>
                            <Text style={{ ...Typography.caption, color: theme.textTertiary }}>
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                            </Text>
                        </View>
                    </View>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {syncStatus === 'syncing' && <Ionicons name="cloud-upload" size={22} color={theme.textTertiary} />}
                        {syncStatus === 'saved' && <Ionicons name="cloud-done" size={22} color={theme.success} />}
                        {syncStatus === 'offline' && <Ionicons name="cloud-offline" size={22} color={theme.textTertiary} />}
                        
                        <TouchableOpacity 
                            onPress={() => router.push('/(tabs)/profile')} 
                            onLongPress={() => setShowDevMenu(true)}
                            delayLongPress={500}
                            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' }}
                        >
                            <Ionicons name="settings-outline" size={22} color={isDark ? '#cbd5e1' : '#475569'} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* View Toggles */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', borderRadius: 12, padding: 4, backgroundColor: isDark ? theme.surfaceSecondary : '#e2e8f0' }}>
                        <TouchableOpacity 
                            onPress={() => setViewMode('grid')}
                            style={{
                                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center',
                                backgroundColor: viewMode === 'grid' ? (isDark ? '#475569' : '#ffffff') : 'transparent',
                                ...(!isDark && viewMode === 'grid' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 } : {}),
                            }}
                        >
                            <Ionicons name="grid" size={14} color={viewMode === 'grid' ? (isDark ? '#e2e8f0' : '#0f172a') : (isDark ? '#64748b' : '#64748b')} />
                            <Text style={{ marginLeft: 6, fontSize: 12, fontFamily: 'Nunito_700Bold', color: viewMode === 'grid' ? (isDark ? '#e2e8f0' : '#1e293b') : (isDark ? '#64748b' : '#64748b') }}>Grid</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setViewMode('list')}
                            style={{
                                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center',
                                backgroundColor: viewMode === 'list' ? (isDark ? '#475569' : '#ffffff') : 'transparent',
                                ...(!isDark && viewMode === 'list' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 } : {}),
                            }}
                        >
                            <Ionicons name="albums" size={14} color={viewMode === 'list' ? (isDark ? '#e2e8f0' : '#0f172a') : (isDark ? '#64748b' : '#64748b')} />
                            <Text style={{ marginLeft: 6, fontSize: 12, fontFamily: 'Nunito_700Bold', color: viewMode === 'list' ? (isDark ? '#e2e8f0' : '#1e293b') : (isDark ? '#64748b' : '#64748b') }}>Glass</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setViewMode('attendance')}
                            style={{
                                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center',
                                backgroundColor: viewMode === 'attendance' ? (isDark ? '#475569' : '#ffffff') : 'transparent',
                                ...(!isDark && viewMode === 'attendance' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 } : {}),
                            }}
                        >
                            <Ionicons name="list" size={14} color={viewMode === 'attendance' ? (isDark ? '#e2e8f0' : '#0f172a') : (isDark ? '#64748b' : '#64748b')} />
                            <Text style={{ marginLeft: 6, fontSize: 12, fontFamily: 'Nunito_700Bold', color: viewMode === 'attendance' ? (isDark ? '#e2e8f0' : '#1e293b') : (isDark ? '#64748b' : '#64748b') }}>Attendance</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
            
            <ScrollView className="flex-1 px-4 py-4" contentContainerClassName="pb-[100px]" removeClippedSubviews={true}>
                {/* Year / Semester Navigation */}
                <Tabs 
                    years={data.years} 
                    activeYearId={activeYearId} 
                    activeSemId={activeSemId}
                    onSelectYear={id => {
                        setActiveYearId(id);
                        const yr = data.years.find((y: any) => y.id === id);
                        if (yr && yr.semesters.length > 0) setActiveSemId(yr.semesters[0].id);
                        else setActiveSemId(null);
                    }}
                    onSelectSem={id => setActiveSemId(id)}
                />

                {!currentSem ? (
                    <View className={`mt-10 items-center justify-center p-8 rounded-[32px] ${isDark ? 'bg-slate-800' : 'bg-white shadow-sm'}`}>
                        <Ionicons name="folder-open" size={48} color={isDark ? "#475569" : "#94a3b8"} style={{marginBottom: 16}} />
                        <Text className={`text-center font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No semester selected. {'\n'}Add a semester above to view your schedule!</Text>
                    </View>
                ) : (
                    <View className="mt-4">
                        {/* Scan + Add Actions (prominent, at top) */}
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                            <TouchableOpacity 
                                onPress={() => {
                                    if (SyncService.getIsPremium()) {
                                        setShowScanner(true);
                                    } else {
                                        setShowPaywall(true);
                                    }
                                }} 
                                style={{
                                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16,
                                    backgroundColor: isDark ? '#4f46e5' : '#6366f1',
                                    ...(!isDark ? { shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 } : {}),
                                }}
                            >
                                <Ionicons name="sparkles" size={18} color="#fff" />
                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: '#fff', marginLeft: 8 }}>Scan Image</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => { setEditingClass(null); setShowEditModal(true); }} 
                                style={{
                                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16,
                                    borderWidth: 1.5, borderColor: isDark ? '#334155' : '#e2e8f0',
                                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                }}
                            >
                                <Ionicons name="add-circle-outline" size={18} color={isDark ? '#e2e8f0' : '#334155'} />
                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: isDark ? '#e2e8f0' : '#334155', marginLeft: 8 }}>Add Class</Text>
                            </TouchableOpacity>
                        </View>
                        {currentSem.classes.length === 0 ? (
                            <View className={`flex-row items-center p-4 rounded-2xl mb-4 border shadow-sm ${isDark ? 'bg-indigo-950 border-indigo-900' : 'bg-indigo-50 border-indigo-200'}`}>
                                <View className="w-10 h-10 rounded-full bg-white items-center justify-center mr-3 overflow-hidden shadow-sm border border-indigo-100">
                                    <Image source={require('../../assets/images/confused.png')} className="w-12 h-12" style={{ transform: [{translateY: 4}] }} resizeMode="cover" />
                                </View>
                                <View className="flex-1">
                                    <Text className={`text-sm font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>Fin is confused! 🤔</Text>
                                    <Text className={`text-xs ${isDark ? 'text-indigo-200' : 'text-indigo-700'}`}>Where is everyone? There are no classes here! Scan an image or add classes manually so Fin knows where to go!</Text>
                                </View>
                            </View>
                        ) : null}

                        {/* ── Subjects without schedule alert ──────────────────── */}
                        {(() => {
                            const unscheduled = getUnscheduledSubjects(currentSem);
                            if (unscheduled.length === 0) return null;
                            return (
                                <TouchableOpacity
                                    onPress={() => router.push('/(tabs)/grades')}
                                    className={`mb-4 p-4 rounded-[24px] border flex-row items-center ${isDark ? 'bg-blue-950/40 border-blue-800/40' : 'bg-blue-50 border-blue-200'}`}
                                >
                                    <Ionicons name="school-outline" size={18} color="#3b82f6" style={{ marginRight: 10 }} />
                                    <View className="flex-1">
                                        <Text className={`font-bold text-sm ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                                            {unscheduled.length} subject{unscheduled.length > 1 ? 's' : ''} without a schedule
                                        </Text>
                                        <Text className={`text-xs mt-0.5 ${isDark ? 'text-blue-500/70' : 'text-blue-600/80'}`} numberOfLines={1}>
                                            {unscheduled.map((s: any) => s.name).join(', ')} · Add class times above →
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })()}

                        {upcomingMilestones.length > 0 && (
                            <View className="mb-4">
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                                    <View className={`flex-row items-center px-3 py-1.5 rounded-full mr-2 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200'}`}>
                                        <Ionicons name="notifications" size={12} color={isDark ? "#94a3b8" : "#64748b"} />
                                        <Text className={`text-[10px] font-bold ml-1 uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Upcoming</Text>
                                    </View>
                                    {upcomingMilestones.map((m: any, i: number) => {
                                        const itemMidnight = parseLocalDate(m.date);
                                        const todayMidnight = new Date().setHours(0,0,0,0);
                                        const diffDays = Math.round((itemMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
                                        return (
                                            <View key={i} className={`flex-row items-center px-3 py-1.5 rounded-full border mr-2 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                <Text className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{m.name || m.title}</Text>
                                                <Text className={`text-[10px] ml-2 ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>
                                                    • {diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : `${diffDays} days`}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        )}

                        <View className="mb-4">
                            {/* Today's Classes Strip */}
                            <View className={`p-4 rounded-[28px] border-2 flex-row items-center ${isDark ? 'bg-slate-900 border-indigo-500/10' : 'bg-indigo-50/30 border-indigo-100 shadow-sm shadow-indigo-100/30'}`}>
                                <View className={`px-2 py-1 rounded-md mr-3 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                                    <Text className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Today</Text>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1 flex-row">
                                    {currentSemClasses.filter((c: any) => c.day === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)).length === 0 ? (
                                        <Text className={`text-sm italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No classes today 🎉</Text>
                                    ) : (
                                        currentSemClasses.filter((c: any) => c.day === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)).map((cls: any, i: number) => {
                                            const formatTime = (h: number) => {
                                                const hours = Math.floor(h);
                                                const mins = Math.round((h - hours) * 60);
                                                const ampm = hours >= 12 && hours < 24 ? 'PM' : 'AM';
                                                let dh = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
                                                if (dh > 12) dh -= 12;
                                                return `${dh}${mins > 0 ? `:${mins.toString().padStart(2, '0')}` : ''}${ampm}`;
                                            };
                                            return (
                                                <View key={i} className="flex-row items-center mr-3 px-2 py-1 rounded-md border" style={{backgroundColor: palette[cls.colorIdx%palette.length].bg, borderColor: palette[cls.colorIdx%palette.length].border}}>
                                                    <Text className="text-xs font-bold mr-1" style={{color: palette[cls.colorIdx%palette.length].text}}>{cls.name}</Text>
                                                    <Text className="text-[10px]" style={{color: palette[cls.colorIdx%palette.length].text, opacity: 0.8}}>{formatTime(cls.startHour)}</Text>
                                                </View>
                                            );
                                        })
                                    )}
                                </ScrollView>
                            </View>

                            {/* Next Class Strip */}
                            {nextClassInfo && (
                                <View className={`mt-3 p-4 rounded-[28px] border-2 flex-row items-center ${isOngoing ? (isDark ? 'bg-slate-900 border-green-500/20' : 'bg-green-50/40 border-green-100') : (isDark ? 'bg-slate-900 border-yellow-500/20' : 'bg-yellow-50/40 border-yellow-100')}`}>
                                    <View className={`px-2 py-1 rounded-md mr-3 ${isOngoing ? (isDark ? 'bg-green-900' : 'bg-green-200') : (isDark ? 'bg-yellow-900' : 'bg-yellow-200')}`}>
                                        <Text className={`text-[10px] font-bold uppercase tracking-wider ${isOngoing ? 'text-green-600' : 'text-yellow-600'}`}>{isOngoing ? 'Ongoing' : 'Next'}</Text>
                                    </View>
                                    <View className="flex-1 flex-row items-center">
                                        <Text className={`text-sm font-bold mr-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{nextClassInfo.name}</Text>
                                        {!isOngoing && <Text className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>starts in </Text>}
                                        {!isOngoing && <Text className="text-sm font-bold text-yellow-600">{nextClassWaitStr}</Text>}
                                    </View>
                                </View>
                            )}
                        </View>

                        {viewMode === 'grid' && (
                            <TouchableOpacity 
                                key={isDark ? 'dark' : 'light'}
                                onPress={() => setIsQuickEditMode(!isQuickEditMode)}
                                className={`mb-4 flex-row items-center justify-center py-4 rounded-3xl border-2 ${isQuickEditMode ? 'bg-indigo-500 border-indigo-400 shadow-lg shadow-indigo-500/30' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm')}`}
                            >
                                <Ionicons name={isQuickEditMode ? "close-circle" : "flash"} size={20} color={isQuickEditMode ? "#ffffff" : (isDark ? "#94a3b8" : "#64748b")} />
                                <Text className={`ml-2 text-base font-extrabold ${isQuickEditMode ? 'text-white' : (isDark ? 'text-slate-300' : 'text-slate-600')}`}>
                                    {isQuickEditMode ? "Exit Quick Edit Mode" : "Quick Edit Schedule"}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {viewMode === 'grid' ? (
                            <View className="mb-8">
                                <TouchableOpacity 
                                    onPress={handleExportSchedule}
                                    className={`mb-4 flex-row items-center justify-center py-4 rounded-3xl border-2 ${isDark ? 'bg-indigo-600 border-indigo-500' : 'bg-indigo-50 border-indigo-200'}`}
                                >
                                    <Ionicons name="download" size={20} color={isDark ? "#ffffff" : "#4f46e5"} />
                                    <Text className={`ml-2 text-base font-extrabold ${isDark ? 'text-white' : 'text-indigo-700'}`}>
                                        Export as Image
                                    </Text>
                                </TouchableOpacity>

                                <TimetableGrid 
                                    classes={currentSem.classes} 
                                    isDark={isDark} 
                                    isQuickEditMode={isQuickEditMode} 
                                    onUpdateClass={onUpdateClass} 
                                    onUpdateClasses={onUpdateClasses}
                                    onDeleteClasses={handleDeleteClasses}
                                    onPressClass={(cls: any) => {
                                        if (!isQuickEditMode) setSelectedClass(cls);
                                    }}
                                />

                                {/* Hidden views for screenshot export */}
                                {/* Dark theme export */}
                                <View style={{ position: 'absolute', top: 0, left: 0, zIndex: -1, opacity: 0 }}>
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
                                            {/* Footer */}
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 18, paddingTop: 0 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Ionicons name="school" size={14} color="#6366f1" style={{ marginRight: 6 }} />
                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#6366f1' }}>FinScholar</Text>
                                                </View>
                                                <Text style={{ fontSize: 10, fontWeight: '600', color: '#475569' }}>Generated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                                            </View>
                                        </View>
                                    </ViewShot>
                                </View>
                                {/* Light theme export */}
                                <View style={{ position: 'absolute', top: 0, left: 0, zIndex: -1, opacity: 0 }}>
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
                                            {/* Footer */}
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 18, paddingTop: 0 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Ionicons name="school" size={14} color="#4f46e5" style={{ marginRight: 6 }} />
                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#4f46e5' }}>FinScholar</Text>
                                                </View>
                                                <Text style={{ fontSize: 10, fontWeight: '600', color: '#94a3b8' }}>Generated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                                            </View>
                                        </View>
                                    </ViewShot>
                                </View>
                            </View>
                        ) : viewMode === 'list' ? (
                            <View className="mb-8">
                                <TouchableOpacity 
                                    onPress={handleExportSchedule}
                                    className={`mb-4 flex-row items-center justify-center py-4 rounded-3xl border-2 ${isDark ? 'bg-indigo-600 border-indigo-500' : 'bg-indigo-50 border-indigo-200'}`}
                                >
                                    <Ionicons name="download" size={20} color={isDark ? "#ffffff" : "#4f46e5"} />
                                    <Text className={`ml-2 text-base font-extrabold ${isDark ? 'text-white' : 'text-indigo-700'}`}>
                                        Export as Image
                                    </Text>
                                </TouchableOpacity>
                                
                                <ViewShot ref={viewShotListRef} options={{ format: 'jpg', quality: 1 }}>
                                    <ScheduleListView 
                                        classes={currentSem.classes} 
                                        isDark={isDark}
                                        currentSem={currentSem}
                                        currentYear={currentYear}
                                    />
                                </ViewShot>
                            </View>
                        ) : (
                            <AttendanceTracker 
                                data={data} 
                                activeYearId={activeYearId} 
                                activeSemId={activeSemId}
                                saveData={saveData}
                                targetDate={params.targetDate as string}
                                trigger={params.trigger as string}
                            />
                        )}

                        <View className="mt-4 flex-row gap-3">
                            <TouchableOpacity onPress={handleResetSchedule} className={`p-4 rounded-[24px] border-2 items-center justify-center ${isDark ? 'bg-red-950/40 border-red-900/50' : 'bg-red-50 border-red-100'}`}>
                                <Ionicons name="trash" size={18} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
            
            <ScheduleScannerModal 
                visible={showScanner} 
                onClose={() => setShowScanner(false)} 
                onApply={handleScannedClasses} 
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
                            I've extracted your schedule, but AI can sometimes be slightly off with exact time blocks. Please review the schedule carefully.
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
                                onPress={() => setShowPreviewModal(false)}
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
