import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, Animated, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useColorScheme } from 'nativewind';
import { supabase } from '@/services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { Calculator } from '@/utils/calculator';
import Tabs from '@/components/ledger/Tabs';
import { useSemesterContext } from '@/components/SemesterContext';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import SectionHeader from '@/components/ui/SectionHeader';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import ProgressBar from '@/components/ui/ProgressBar';
import { SyncService } from '@/services/SyncService';
import PremiumPaywallModal from '@/components/PremiumPaywallModal';
import DevMenuModal from '@/components/DevMenuModal';
import ScheduleScannerModal from '@/components/schedule/ScheduleScannerModal';
import { ensureSubjectExists } from '@/utils/subjectRegistry';
import { normalizeScheduleDays, parseClassHour, parseClassDuration } from '@/utils/scheduleParsing';
import TermSetupModal from '@/components/onboarding/TermSetupModal';
import GettingStartedCard, { buildGettingStartedSteps } from '@/components/onboarding/GettingStartedCard';
import { OnboardingService } from '@/services/OnboardingService';
import SpotlightTarget from '@/components/spotlight/SpotlightTarget';
import { useScreenTour } from '@/components/spotlight/useScreenTour';
import { useSpotlight } from '@/components/spotlight/SpotlightProvider';
import { SPOTLIGHT_IDS, TOUR_KEYS, MAIN_TOUR } from '@/constants/tours';
import { useTabBarHeight } from '@/components/CustomTabBar';


const FIN_QUOTES = [
    "Believe you can and you're halfway there!",
    "Every day is a fresh opportunity to learn and grow.",
    "Small progress every day adds up to big results.",
    "Don't worry about being perfect, just focus on getting better.",
    "Your hard work will pay off. Keep pushing forward!",
    "Success is the sum of small efforts repeated day in and day out.",
    "Focus on your goals, you've got this!",
    "Mistakes are proof that you are trying.",
    "The secret to getting ahead is getting started.",
    "You are capable of doing amazing things!"
];

export const getLocalDateString = (d: Date = new Date()): string => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
};

export const parseLocalDate = (dateStr: string | undefined | null): number => {
    if (!dateStr || typeof dateStr !== 'string') return 0;
    const trimmed = dateStr.trim();
    if (!trimmed) return 0;
    if (trimmed.includes('-') && !trimmed.includes('T')) {
        const parts = trimmed.split('-');
        if (parts.length === 3) {
            const yr = parseInt(parts[0], 10);
            const mo = parseInt(parts[1], 10) - 1;
            const da = parseInt(parts[2], 10);
            if (!isNaN(yr) && !isNaN(mo) && !isNaN(da)) {
                return new Date(yr, mo, da).getTime();
            }
        }
    }
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return 0;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export const parseSemDate = (s: string | undefined | null): number => {
    if (!s || typeof s !== 'string') return NaN;
    const trimmed = s.trim();
    if (!trimmed) return NaN;
    if (trimmed.includes('T')) return new Date(trimmed).getTime();
    const parts = trimmed.split('-');
    if (parts.length === 3) {
        const yr = parseInt(parts[0], 10);
        const mo = parseInt(parts[1], 10) - 1;
        const da = parseInt(parts[2], 10);
        if (!isNaN(yr) && !isNaN(mo) && !isNaN(da)) {
            return new Date(yr, mo, da).getTime();
        }
    }
    return new Date(trimmed).getTime();
};

export const getTimeLeftText = (dueDateIso: string | undefined | null, nowMs: number) => {
    if (!dueDateIso || typeof dueDateIso !== 'string') return 'No date';
    const trimmed = dueDateIso.trim();
    if (!trimmed) return 'No date';

    const isOldFormat = !trimmed.includes('T');
    let dueTime = 0;
    if (isOldFormat) {
        const parts = trimmed.split('-');
        if (parts.length === 3) {
            const yr = parseInt(parts[0], 10);
            const mo = parseInt(parts[1], 10) - 1;
            const da = parseInt(parts[2], 10);
            if (!isNaN(yr) && !isNaN(mo) && !isNaN(da)) {
                dueTime = new Date(yr, mo, da, 23, 59, 59).getTime();
            }
        }
    } else {
        dueTime = new Date(trimmed).getTime();
    }
    
    if (isNaN(dueTime) || dueTime === 0) {
        const fallback = new Date(trimmed).getTime();
        if (isNaN(fallback)) return 'Invalid date';
        dueTime = fallback;
    }
    
    const diff = dueTime - nowMs;
    if (diff <= 0) return 'Overdue';

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days >= 1) return `In ${days} day${days > 1 ? 's' : ''}`;
    if (hours >= 1) return `In ${hours} hr${hours > 1 ? 's' : ''} ${minutes % 60} min${minutes % 60 !== 1 ? 's' : ''}`;
    if (minutes >= 1) return `In ${minutes}m ${seconds % 60}s`;
    return `In ${seconds}s`;
};

/** Staggered fade-in wrapper */
function FadeInItem({ children, index, style }: { children: React.ReactNode; index: number; style?: any }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(16)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 80, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 80, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
            {children}
        </Animated.View>
    );
}

export default function DashboardScreen() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const insets = useSafeAreaInsets();
    const { width: SCREEN_WIDTH } = useWindowDimensions();
    
    const [user, setUser] = useState<any>(null);
    const [data, setData] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [showDevMenu, setShowDevMenu] = useState(false);
    const [showScannerModal, setShowScannerModal] = useState(false);
    const [showTermSetup, setShowTermSetup] = useState(false);
    const [checklistDismissed, setChecklistDismissed] = useState(true);
    const [isPremium, setIsPremium] = useState(false);
    
    const { selectedYear: activeYearId, selectedSemester: activeSemId } = useSemesterContext();
    const [syncStatus, setSyncStatus] = useState<'offline' | 'syncing' | 'saved' | 'error'>('offline');
    const [quote, setQuote] = useState('');

    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(timer);
    }, []);

    const getRandomQuote = () => {
        const idx = Math.floor(Math.random() * FIN_QUOTES.length);
        setQuote(FIN_QUOTES[idx]);
    };

    useEffect(() => {
        getRandomQuote();
    }, []);

    // Default to hidden until we know the preference, so it never flashes in.
    useEffect(() => {
        OnboardingService.isChecklistDismissed().then((dismissed) => setChecklistDismissed(dismissed));
    }, []);

    const handleDismissChecklist = useCallback(() => {
        setChecklistDismissed(true);
        OnboardingService.dismissChecklist();
    }, []);

    const gettingStartedSteps = useMemo(
        () => buildGettingStartedSteps(data, activeYearId, activeSemId, () => setShowTermSetup(true)),
        [data, activeYearId, activeSemId]
    );

    // The welcome tour points at controls on this screen and the tab bar, so it
    // waits until the dashboard has rendered its real content.
    const { startTour } = useSpotlight();
    useScreenTour(TOUR_KEYS.main, MAIN_TOUR, data !== null);

    const handleStartTour = useCallback(() => {
        startTour(MAIN_TOUR, { key: TOUR_KEYS.main });
    }, [startTour]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            // Restore premium status from Supabase on app launch
            if (session?.user) {
                SyncService.checkAndRestorePremium().then(() => {
                    setIsPremium(SyncService.getIsPremium());
                });
            }
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            // Restore premium status from Supabase after login
            if (session?.user) {
                SyncService.checkAndRestorePremium().then(() => {
                    setIsPremium(SyncService.getIsPremium());
                });
            }
        });
        
        // Also read initial value synchronously
        setIsPremium(SyncService.getIsPremium());

        const unsubscribeSync = SyncService.subscribeDataChange(async () => {
            setIsPremium(SyncService.getIsPremium());
            try {
                const str = await AsyncStorage.getItem('grade_ledger_v2_data');
                if (str) {
                    setData(JSON.parse(str));
                }
            } catch (e) {}
        });

        return () => {
            subscription.unsubscribe();
            unsubscribeSync();
        };
    }, []);

    const fetchData = useCallback(async (forcedUser?: any) => {
        setIsPremium(SyncService.getIsPremium());
        const currentUser = forcedUser || user || (await supabase.auth.getUser()).data.user;
        let loaded = null;
        try {
            const str = await AsyncStorage.getItem('grade_ledger_v2_data');
            if (str) loaded = JSON.parse(str);
        } catch(e) {}

        if (currentUser && (!loaded)) {
            try {
                const { data: dbData } = await supabase.from('user_ledgers').select('ledger_data').eq('id', currentUser.id).single();
                if (dbData?.ledger_data) {
                    loaded = dbData.ledger_data;
                    await AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(loaded));
                }
            } catch (e) {
                console.error("Failed to load from DB", e);
            }
        }

        if (!loaded) loaded = { settings: {}, years: [] };

        if (currentUser) setSyncStatus('saved');
        else setSyncStatus('offline');

        setData(loaded);
    }, [user]);

    const loadData = async (forceSync = false) => {
        await fetchData();
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
            OnboardingService.isChecklistDismissed().then((dismissed) => setChecklistDismissed(dismissed));
        }, [user])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        getRandomQuote();
        await loadData(true);
        setRefreshing(false);
    };

    const handleScannedClasses = (scannedClasses: any[]) => {
        let nd = { ...data };
        const sem = nd.years?.find((y: any) => y.id === activeYearId)?.semesters?.find((s: any) => s.id === activeSemId);
        if (!sem) return;
        
        const safeScanned = scannedClasses || [];
        safeScanned.forEach((sc: any) => {
            const className = sc.name || sc.subject || sc.class || 'Unnamed Class';
            const regResult = ensureSubjectExists(nd, activeYearId, activeSemId, className, { fromSchedule: true });
            nd = regResult.data;
            const subjectId = regResult.subjectId;
            const subjectEntry = nd.years?.find((y: any) => y.id === activeYearId)?.semesters?.find((s: any) => s.id === activeSemId)?.subjects?.find((s: any) => s.id === subjectId);
            if (subjectEntry) subjectEntry.hasSchedule = true;

            const curSem = nd.years?.find((y: any) => y.id === activeYearId)?.semesters?.find((s: any) => s.id === activeSemId);
            if (!curSem) return;
            if (!curSem.classes) curSem.classes = [];

            const rawTime = sc.startHour !== undefined ? sc.startHour : (sc.time || sc.startTime || sc.start_time);

            if (sc.day !== undefined && rawTime !== undefined) {
                const parsedStartHour = parseClassHour(rawTime);
                const rawEndTime = sc.endHour !== undefined ? sc.endHour : (sc.endTime || sc.end_time);
                const dur = parseClassDuration(sc.duration, parsedStartHour, rawEndTime);
                const colorVal = sc.colorIdx !== undefined && sc.colorIdx !== null ? Number(sc.colorIdx) : Math.floor(Math.random() * 6);
                const dayIndices = normalizeScheduleDays(sc.day);

                dayIndices.forEach(dayIdx => {
                    curSem.classes.push({
                        id: Math.random().toString(36).substr(2, 9),
                        name: className,
                        room: sc.room || sc.location || '',
                        instructor: sc.instructor || sc.teacher || '',
                        day: dayIdx,
                        startHour: parsedStartHour,
                        duration: dur,
                        colorIdx: colorVal,
                        subjectId,
                        absences: 0, lates: 0, cuts: 0
                    });
                });
            } else if (Array.isArray(sc.schedules) && sc.schedules.length > 0) {
                sc.schedules.forEach((sch: any) => {
                    const schTime = sch.startHour !== undefined ? sch.startHour : (sch.time || sch.startTime || sch.start_time);
                    const parsedStartHour = parseClassHour(schTime);
                    const schEndTime = sch.endHour !== undefined ? sch.endHour : (sch.endTime || sch.end_time);
                    const dur = parseClassDuration(sch.duration, parsedStartHour, schEndTime);
                    const colorVal = sch.colorIdx !== undefined && sch.colorIdx !== null ? Number(sch.colorIdx) : (sc.colorIdx !== undefined && sc.colorIdx !== null ? Number(sc.colorIdx) : Math.floor(Math.random() * 6));
                    const dayIndices = normalizeScheduleDays(sch.day);

                    dayIndices.forEach(dayIdx => {
                        curSem.classes.push({
                            id: Math.random().toString(36).substr(2, 9),
                            name: className,
                            room: sch.room || sch.location || sc.room || sc.location || '',
                            instructor: sch.instructor || sch.teacher || sc.instructor || sc.teacher || '',
                            day: dayIdx,
                            startHour: parsedStartHour,
                            duration: dur,
                            colorIdx: colorVal,
                            subjectId,
                            absences: 0, lates: 0, cuts: 0
                        });
                    });
                });
            }
        });

        setData(nd);
        AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(nd));
        SyncService.pushLocalChanges(nd);
        setShowScannerModal(false);
    };

    if (!data) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                <DashboardSkeleton />
            </SafeAreaView>
        );
    }

    const currentYear = data.years?.find((y: any) => y.id === activeYearId);
    const currentSem = currentYear?.semesters?.find((s: any) => s.id === activeSemId);
    const system = data.settings?.gradingSystem || '1_IS_BEST';
    
    const semRes = currentSem ? Calculator.calculateSemester(currentSem, system) : { percent: 0, equivalent: 0 };
    const yrRes = currentYear ? Calculator.calculateYear(currentYear, system) : { percent: 0, equivalent: 0 };

    // Metric 1: Semester Progress (days passed / total days * 100)
    const semProgress = currentSem && currentSem.startDate && currentSem.endDate ? (() => {
        const start = parseSemDate(currentSem.startDate);
        const end = parseSemDate(currentSem.endDate);
        if (isNaN(start) || isNaN(end) || end <= start) return { percent: 0, daysPassed: 0, totalDays: 0 };
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nowTime = today.getTime();
        
        const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
        let daysPassed = Math.round((nowTime - start) / (1000 * 60 * 60 * 24));
        if (daysPassed < 0) daysPassed = 0;
        if (daysPassed > totalDays) daysPassed = totalDays;
        
        const percent = Math.min(100, Math.max(0, Math.round((daysPassed / totalDays) * 100)));
        return { percent, daysPassed, totalDays };
    })() : { percent: 0, daysPassed: 0, totalDays: 0 };

    // Metric 4: Overall Attendance % (past non-cancelled attended hours / total conducted hours * 100)
    const overallAttendance = currentSem ? (() => {
        if (!currentSem.classes || currentSem.classes.length === 0) return 100;
        const startDateStr = currentSem.startDate || getLocalDateString();
        const endDateStr = currentSem.endDate || getLocalDateString(new Date(Date.now() + 1000 * 60 * 60 * 24 * 120));
        const attendanceLog = currentSem.attendanceLog || {};
        
        const startMs = parseSemDate(startDateStr);
        const endMs = parseSemDate(endDateStr);
        if (isNaN(startMs) || isNaN(endMs)) return 100;

        const start = new Date(startMs);
        const end = new Date(endMs);
        end.setHours(23, 59, 59, 999);
        const now = new Date();
        
        const limitDate = now < end ? now : end;
        
        let totalConductedHours = 0;
        let attendedHours = 0;
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        for (let d = new Date(start); d <= limitDate; d.setDate(d.getDate() + 1)) {
            const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
            const dateStr = getLocalDateString(d);
            
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
                sessionDate.setHours(Math.floor(startHour), (startHour % 1) * 60, 0, 0);
                
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
        
        if (totalConductedHours === 0) return 100;
        return Math.min(100, Math.max(0, Math.round((attendedHours / totalConductedHours) * 100)));
    })() : 100;

    // Metric 5: Pending Tasks Count (requirements where status !== 'submitted' && status !== 'graded')
    const pendingTasksCount = currentSem ? (() => {
        if (!currentSem.subjects) return 0;
        let count = 0;
        currentSem.subjects.forEach((sub: any) => {
            if (sub.requirements) {
                sub.requirements.forEach((req: any) => {
                    if (req.status !== 'submitted' && req.status !== 'graded') {
                        count++;
                    }
                });
            }
        });
        return count;
    })() : 0;

    // ── Derived presentation values ───────────────────────────────────────────
    const tints = getTints(isDark);

    const hour = new Date(now).getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    /**
     * First name if the signed-in account has one, "Scholar" otherwise — which
     * is also what every guest sees, since auth is optional throughout.
     */
    const displayName = (() => {
        const meta = user?.user_metadata || {};
        const raw = meta.full_name || meta.name || meta.preferred_username || '';
        const first = String(raw).trim().split(/\s+/)[0];
        if (!first) return 'Scholar';
        return first.charAt(0).toUpperCase() + first.slice(1);
    })();

    const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    const todayStr = getLocalDateString(new Date());
    const todayClasses = (currentSem?.classes || [])
        .filter((c: any) => c.day === todayIdx)
        .slice()
        .sort((a: any, b: any) => (a.startHour || 0) - (b.startHour || 0));

    const gwaValue = system === 'PERCENT'
        ? (semRes.percent > 0 ? `${semRes.percent.toFixed(2)}%` : '--')
        : (semRes.equivalent > 0 ? semRes.equivalent.toFixed(2) : '--');

    // Attendance drives a risk colour, not just a number.
    const attendanceTint = overallAttendance >= 90 ? tints.attendance
        : overallAttendance >= 75 ? tints.tasks
        : tints.danger;
    const attendanceCaption = overallAttendance >= 90 ? 'On track'
        : overallAttendance >= 75 ? 'Watch it'
        : 'At risk';

    const totalUnits = (currentSem?.subjects || [])
        .reduce((sum: number, sub: any) => sum + (Number(sub.units) || 0), 0);

    // Cards size to the viewport so the shelf reads the same on any phone.
    const subjectCardWidth = Math.max(186, Math.min(230, SCREEN_WIDTH * 0.58));

    const formatClassTime = (h: number) => {
        const totalMins = Math.round(h * 60);
        const normH = (Math.floor(totalMins / 60) % 24 + 24) % 24;
        const normM = (totalMins % 60 + 60) % 60;
        const ampm = normH >= 12 ? 'PM' : 'AM';
        const dh = normH % 12 === 0 ? 12 : normH % 12;
        return `${dh}:${normM.toString().padStart(2, '0')} ${ampm}`;
    };
    /** Compact form for the timeline rail — "7:30" over a separate AM/PM line. */
    const splitClassTime = (h: number) => {
        const full = formatClassTime(h);
        const [clock, ampm] = full.split(' ');
        return { clock: clock.replace(':00', ''), ampm };
    };

    /**
     * "Aug 12 – Dec 11, 2026" within one calendar year, both years when the
     * term straddles two. The year is what tells two same-named terms apart.
     */
    const formatSemRange = (startStr?: string, endStr?: string) => {
        const one = (dStr?: string, withYear = true) => {
            if (!dStr) return null;
            const ms = parseSemDate(dStr);
            if (isNaN(ms)) return null;
            return new Date(ms).toLocaleDateString('en-US',
                withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
        };
        const startMs = parseSemDate(startStr || '');
        const endMs = parseSemDate(endStr || '');
        const sameYear = !isNaN(startMs) && !isNaN(endMs)
            && new Date(startMs).getFullYear() === new Date(endMs).getFullYear();
        const start = one(startStr, !sameYear);
        const end = one(endStr, true);
        if (start && end) return `${start} – ${end}`;
        if (start) return `Starts ${start}`;
        if (end) return `Ends ${end}`;
        return null;
    };

    /** Small caps label. One definition, so every label matches. */
    const microLabel = {
        fontFamily: 'Nunito_800ExtraBold' as const,
        fontSize: 10,
        letterSpacing: 0.8,
        textTransform: 'uppercase' as const,
        color: theme.textTertiary,
    };
    const hairline = { height: 1, backgroundColor: theme.cardBorder };

    const statTiles = [
        {
            key: 'gwa',
            tint: tints.grades,
            label: 'Sem GWA',
            value: gwaValue,
            caption: currentSem?.subjects?.length ? `${currentSem.subjects.length} subjects` : 'No subjects',
            onPress: () => router.push('/(tabs)/grades'),
        },
        {
            key: 'attendance',
            tint: attendanceTint,
            label: 'Attendance',
            value: `${overallAttendance}%`,
            caption: attendanceCaption,
            onPress: () => router.push({ pathname: '/(tabs)/schedule', params: { viewMode: 'attendance' } }),
        },
        {
            key: 'tasks',
            tint: tints.tasks,
            label: 'Tasks',
            value: `${pendingTasksCount}`,
            caption: pendingTasksCount === 0 ? 'All clear' : 'Pending',
            onPress: () => router.push('/(tabs)/requirements'),
        },
    ];

    const quickActions = [
        { key: 'flashcards', icon: 'albums' as const, tint: tints.grades, label: 'Flashcards', hint: 'Study & quiz', onPress: () => router.push('/(tabs)/flashcards') },
        { key: 'scanner', icon: 'scan' as const, tint: tints.tools, label: 'Scanner', hint: 'AI schedule', onPress: () => setShowScannerModal(true) },
        { key: 'calendar', icon: 'calendar' as const, tint: tints.attendance, label: 'Calendar', hint: 'Milestones', onPress: () => router.push('/(tabs)/calendar') },
        { key: 'terms', icon: 'options' as const, tint: tints.tasks, label: 'Terms', hint: 'Academic', onPress: () => router.push('/(tabs)/academic-manager') },
    ];

    const GUTTER = 14;
    const tabBarHeight = useTabBarHeight();

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.background }}>
            {/* ── App bar. Flush with the page, so it reads as the top of the
                 sheet rather than a floating chrome bar. ─────────────────────── */}
            <View
                style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 10, zIndex: 10,
                    backgroundColor: theme.background,
                }}
            >
                <TouchableOpacity
                    activeOpacity={0.8}
                    onLongPress={() => setShowDevMenu(true)}
                    accessibilityRole="header"
                    accessibilityLabel="FinScholar"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 }}
                >
                    <View style={{
                        width: 32, height: 32, borderRadius: 10,
                        backgroundColor: tints.schedule.fill,
                        borderWidth: 1, borderColor: tints.schedule.line,
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Ionicons name="school" size={17} color={tints.schedule.ink} />
                    </View>
                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 19, color: theme.text, letterSpacing: -0.4 }}>
                        FinScholar
                    </Text>
                    {isPremium ? (
                        <View style={{ backgroundColor: tints.attendance.solid, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontSize: 9.5, fontFamily: 'Nunito_800ExtraBold', color: '#fff', letterSpacing: 0.3 }}>PRO</Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={() => setShowPaywall(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Upgrade to FinScholar Pro"
                            style={{ backgroundColor: theme.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, flexDirection: 'row', alignItems: 'center', gap: 3 }}
                        >
                            <Ionicons name="diamond" size={9} color="#fff" />
                            <Text style={{ fontSize: 9.5, fontFamily: 'Nunito_800ExtraBold', color: '#fff' }}>GET PRO</Text>
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                        accessible
                        accessibilityLabel={syncStatus === 'syncing' ? 'Syncing' : syncStatus === 'saved' ? 'Synced' : 'Offline'}
                        style={{ width: 22, alignItems: 'center' }}
                    >
                        {syncStatus === 'syncing' && <Ionicons name="cloud-upload" size={19} color={theme.textTertiary} />}
                        {syncStatus === 'saved' && <Ionicons name="cloud-done" size={19} color={tints.attendance.solid} />}
                        {(syncStatus === 'error' || syncStatus === 'offline') && <Ionicons name="cloud-offline" size={19} color={theme.textTertiary} />}
                    </View>

                    <SpotlightTarget id={SPOTLIGHT_IDS.homeSettings}>
                        <TouchableOpacity
                            onPress={() => router.push('/(tabs)/profile')}
                            accessibilityRole="button"
                            accessibilityLabel="Settings"
                            style={{
                                width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                                backgroundColor: theme.surface,
                                borderWidth: 1, borderColor: theme.cardBorder,
                                borderBottomWidth: 2, borderBottomColor: theme.lip,
                            }}
                        >
                            <Ionicons name="settings-outline" size={18} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </SpotlightTarget>
                </View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                showsVerticalScrollIndicator={false}
                bounces={true}
            >
              <View style={{ width: '100%', maxWidth: 620, alignSelf: 'center', paddingTop: 2 }}>

                {!data?.years || data.years.length === 0 ? (
                    /* ── First run: no term exists yet ─────────────────────── */
                    <View style={{ paddingHorizontal: GUTTER }}>
                        <Card padding={0} radius={Radius['2xl']} style={{ marginTop: 8, overflow: 'hidden' }}>
                            <View style={{
                                backgroundColor: tints.schedule.fill,
                                paddingTop: 26, paddingBottom: 20, alignItems: 'center',
                                borderBottomWidth: 1, borderBottomColor: tints.schedule.line,
                            }}>
                                <View style={{
                                    width: 96, height: 96, borderRadius: 30,
                                    backgroundColor: isDark ? 'rgba(129,140,248,0.14)' : '#ffffff',
                                    borderWidth: 2, borderColor: tints.schedule.line,
                                    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
                                }}>
                                    <Image
                                        source={require('../../assets/images/finanimated_opt.gif')}
                                        style={{ width: 152, height: 152, transform: [{ translateY: 22 }] }}
                                        resizeMode="contain"
                                    />
                                </View>
                            </View>

                            <View style={{ padding: 22, alignItems: 'center', width: '100%' }}>
                                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 22, color: theme.text, textAlign: 'center', marginBottom: 8, letterSpacing: -0.4 }}>
                                    Welcome to FinScholar
                                </Text>
                                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 22, lineHeight: 21 }}>
                                    Your subjects, grades and classes all live inside a term. Let's create your first one — it takes about ten seconds.
                                </Text>
                                <SpotlightTarget id={SPOTLIGHT_IDS.homeTerm} style={{ width: '100%' }}>
                                    <AnimatedPressable
                                        onPress={() => setShowTermSetup(true)}
                                        accessibilityRole="button"
                                        accessibilityLabel="Set up my term"
                                        style={{
                                            backgroundColor: theme.primary, paddingVertical: 14, paddingHorizontal: 22,
                                            borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center',
                                            borderBottomWidth: 3, borderBottomColor: isDark ? '#4338ca' : '#3730a3',
                                        }}
                                    >
                                        <Ionicons name="sparkles" size={18} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={{ color: '#ffffff', fontFamily: 'Nunito_800ExtraBold', fontSize: 15 }}>Set up my term</Text>
                                    </AnimatedPressable>
                                </SpotlightTarget>
                                <TouchableOpacity
                                    onPress={() => router.push('/(tabs)/academic-manager')}
                                    accessibilityRole="button"
                                    accessibilityLabel="Manage academic terms"
                                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 2 }}
                                >
                                    <Ionicons name="options-outline" size={15} color={theme.textSecondary} style={{ marginRight: 6 }} />
                                    <Text style={{ color: theme.textSecondary, fontFamily: 'Nunito_700Bold', fontSize: 13.5 }}>Manage Academic Terms</Text>
                                </TouchableOpacity>
                            </View>
                        </Card>
                    </View>
                ) : (
                    <>
                {/* ══════════════════════════════════════════════════════════════
                    THE STATUS BOARD — greeting, term, timeline and the three
                    headline numbers in ONE panel. Previously five separate
                    floating cards; grouping them is what stops the page reading
                    as a stack of unrelated widgets.
                   ══════════════════════════════════════════════════════════════ */}
                <FadeInItem index={0} style={{ paddingHorizontal: GUTTER, marginBottom: 16 }}>
                    <Card padding={0} radius={Radius['2xl']} style={{ overflow: 'hidden' }}>

                        {/* ── Fin's welcome ────────────────────────────────
                            Fin is given a habitat rather than a chip: the water
                            is drawn into the panel and the mascot sits in it,
                            bleeding off the right edge. That is what makes it
                            read as one illustrated header instead of an avatar
                            parked next to some text. The copy column is capped
                            so it can never collide with the art. */}
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={getRandomQuote}
                            accessibilityRole="button"
                            accessibilityLabel={`${greeting}, ${displayName}. Fin says: ${quote}. Tap for another tip.`}
                            style={{
                                position: 'relative',
                                minHeight: 152,
                                justifyContent: 'center',
                                paddingLeft: 16, paddingRight: 14, paddingVertical: 16,
                                backgroundColor: tints.schedule.fill,
                                overflow: 'hidden',
                            }}
                        >
                            {/* Water. The Svg is wrapped rather than positioned
                                directly: a percentage width on the Svg itself
                                resolves against the parent's CONTENT box, so the
                                waves stopped short of the right padding and left
                                an unpainted strip down the edge of the banner. */}
                            <View
                                pointerEvents="none"
                                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 78 }}
                            >
                                <Svg
                                    width="100%"
                                    height="100%"
                                    viewBox="0 0 390 78"
                                    preserveAspectRatio="none"
                                >
                                    <Path
                                        d="M0 30 C 58 8, 118 50, 196 30 C 274 10, 330 46, 390 26 L390 78 L0 78 Z"
                                        fill={isDark ? 'rgba(129,140,248,0.10)' : 'rgba(79,70,229,0.09)'}
                                    />
                                    <Path
                                        d="M0 50 C 70 30, 138 68, 212 50 C 286 32, 340 62, 390 46 L390 78 L0 78 Z"
                                        fill={isDark ? 'rgba(129,140,248,0.13)' : 'rgba(79,70,229,0.13)'}
                                    />
                                </Svg>
                            </View>

                            {/* Two sparkles, placed in the gap between copy and mascot */}
                            <Ionicons
                                name="sparkles"
                                size={13}
                                color={isDark ? 'rgba(169,178,251,0.75)' : 'rgba(255,255,255,0.95)'}
                                style={{ position: 'absolute', right: 118, top: 26 }}
                            />
                            <Ionicons
                                name="sparkles"
                                size={9}
                                color={isDark ? 'rgba(169,178,251,0.5)' : 'rgba(255,255,255,0.8)'}
                                style={{ position: 'absolute', right: 148, top: 62 }}
                            />

                            {/* Fin, bottom-anchored and bleeding off the edge */}
                            <Image
                                source={require('../../assets/images/FinDashboard.png')}
                                style={{ position: 'absolute', right: -18, bottom: -16, width: 170, height: 170 }}
                                resizeMode="contain"
                            />

                            <View style={{ maxWidth: '58%', zIndex: 2 }}>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 5 }}>
                                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 17, lineHeight: 23, letterSpacing: -0.3, color: tints.schedule.ink }}>
                                        {greeting},{' '}
                                    </Text>
                                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 17, lineHeight: 23, letterSpacing: -0.3, color: theme.text }}>
                                        {displayName}!
                                    </Text>
                                </View>
                                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12.5, lineHeight: 17, color: theme.textSecondary }} numberOfLines={3}>
                                    {quote}
                                </Text>
                            </View>

                            <View style={{ position: 'absolute', top: 12, right: 12, zIndex: 3 }}>
                                <Ionicons name="refresh" size={16} color={isDark ? theme.textTertiary : tints.schedule.ink} />
                            </View>
                        </TouchableOpacity>

                        <View style={hairline} />

                        {/* Term + timeline */}
                        <Tabs
                            years={data?.years || []}
                            activeYearId={activeYearId}
                            activeSemId={activeSemId}
                            spotlightId={SPOTLIGHT_IDS.homeTerm}
                            renderTrigger={(open, label) => (
                                <View>
                                    <TouchableOpacity
                                        onPress={open}
                                        activeOpacity={0.75}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Active term: ${label}. Tap to switch term.`}
                                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10 }}
                                    >
                                        <View style={{ flex: 1, marginRight: 10 }}>
                                            <Text style={microLabel}>Active term</Text>
                                            <Text numberOfLines={1} style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: theme.text, marginTop: 2, letterSpacing: -0.3 }}>
                                                {label}
                                            </Text>
                                        </View>
                                        <View style={{
                                            flexDirection: 'row', alignItems: 'center', gap: 4,
                                            paddingLeft: 10, paddingRight: 8, height: 30, borderRadius: 10,
                                            backgroundColor: theme.surfaceSecondary,
                                            borderWidth: 1, borderColor: theme.cardBorder,
                                        }}>
                                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: theme.textSecondary }}>Switch</Text>
                                            <Ionicons name="chevron-down" size={14} color={theme.textSecondary} />
                                        </View>
                                    </TouchableOpacity>

                                    {currentSem?.startDate && currentSem?.endDate ? (
                                        <View style={{ paddingHorizontal: 14, paddingBottom: 13 }}>
                                            <ProgressBar
                                                progress={semProgress.percent / 100}
                                                height={8}
                                                color={tints.schedule.solid}
                                                accessibilityLabel="Semester progress"
                                            />
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
                                                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: tints.schedule.ink }}>
                                                    {semProgress.percent}%
                                                </Text>
                                                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, marginLeft: 6 }}>
                                                    · day {semProgress.daysPassed} of {semProgress.totalDays}
                                                </Text>
                                                <View style={{ flex: 1 }} />
                                                <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary }}>
                                                    {formatSemRange(currentSem.startDate, currentSem.endDate)}
                                                </Text>
                                            </View>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => router.push('/(tabs)/academic-manager')}
                                            activeOpacity={0.7}
                                            accessibilityRole="button"
                                            accessibilityLabel="Set semester start and end dates in Academic Manager"
                                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 13 }}
                                        >
                                            <Ionicons name="information-circle-outline" size={15} color={theme.textTertiary} style={{ marginRight: 7 }} />
                                            <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textSecondary }}>
                                                {formatSemRange(currentSem?.startDate, currentSem?.endDate)
                                                    ? `${formatSemRange(currentSem?.startDate, currentSem?.endDate)} · add the other date`
                                                    : 'Add start & end dates to track this semester'}
                                            </Text>
                                            <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        />

                        <View style={hairline} />

                        {/* Three headline numbers. Each column carries a colour
                            rail so the domain is readable before the label is. */}
                        <View style={{ flexDirection: 'row' }}>
                            {statTiles.map((tile, i) => (
                                <TouchableOpacity
                                    key={tile.key}
                                    onPress={tile.onPress}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${tile.label}: ${tile.value}. ${tile.caption}.`}
                                    style={{
                                        flex: 1,
                                        paddingTop: 11, paddingBottom: 13, paddingHorizontal: 11,
                                        borderLeftWidth: i === 0 ? 0 : 1,
                                        borderLeftColor: theme.cardBorder,
                                    }}
                                >
                                    <View style={{ height: 3, width: 22, borderRadius: 2, backgroundColor: tile.tint.solid, marginBottom: 8 }} />
                                    <Text numberOfLines={1} style={microLabel}>{tile.label}</Text>
                                    <Text
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                        style={{ fontFamily: 'Nunito_900Black', fontSize: 24, color: theme.text, letterSpacing: -0.8, marginTop: 3 }}
                                    >
                                        {tile.value}
                                    </Text>
                                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_700Bold', fontSize: 10.5, color: tile.tint.ink, marginTop: 2 }}>
                                        {tile.caption}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Card>
                </FadeInItem>

                {/* ══ Setup checklist — only while something is outstanding ════ */}
                {!checklistDismissed && gettingStartedSteps.some(step => !step.done) && (
                    <FadeInItem index={1} style={{ paddingHorizontal: GUTTER, marginBottom: 16 }}>
                        <GettingStartedCard
                            steps={gettingStartedSteps}
                            onDismiss={handleDismissChecklist}
                            onStartTour={handleStartTour}
                        />
                    </FadeInItem>
                )}

                {/* ══ Toolbelt — recessed, so it reads as fixed to the page ═════ */}
                <FadeInItem index={2} style={{ paddingHorizontal: GUTTER, marginBottom: 24 }}>
                    <Card variant="sunken" padding={6} radius={Radius.xl} style={{ flexDirection: 'row' }}>
                        {quickActions.map((action) => (
                            <TouchableOpacity
                                key={action.key}
                                onPress={action.onPress}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={`${action.label}, ${action.hint}`}
                                style={{ flex: 1, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 2 }}
                            >
                                <View style={{
                                    width: 42, height: 42, borderRadius: 14, marginBottom: 7,
                                    alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: action.tint.fill,
                                    borderWidth: 1, borderColor: action.tint.line,
                                    borderBottomWidth: 2,
                                }}>
                                    <Ionicons name={action.icon} size={19} color={action.tint.ink} />
                                </View>
                                <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 11.5, color: theme.text }}>
                                    {action.label}
                                </Text>
                                <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 9.5, color: theme.textTertiary, marginTop: 1 }}>
                                    {action.hint}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </Card>
                </FadeInItem>

                {/* ══ TODAY — a timeline, not a list of boxes ═══════════════════ */}
                <FadeInItem index={3} style={{ marginBottom: 24 }}>
                    <View style={{ paddingHorizontal: GUTTER }}>
                        <SectionHeader
                            title="Today"
                            count={todayClasses.length > 0 ? todayClasses.length : undefined}
                            subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            onAction={() => router.push('/(tabs)/schedule')}
                            actionLabel="Schedule"
                            railColor={tints.schedule.solid}
                        />
                    </View>

                    <View style={{ paddingHorizontal: GUTTER }}>
                    {(() => {
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const semStartMs = parseSemDate(currentSem?.startDate);
                        const semEndMs = parseSemDate(currentSem?.endDate);
                        const semStart = !isNaN(semStartMs) ? new Date(semStartMs) : null;
                        const semEnd = !isNaN(semEndMs) ? new Date(semEndMs) : null;
                        const semesterEnded = semEnd && today.getTime() > semEnd.getTime();
                        const semesterNotStarted = semStart && today.getTime() < semStart.getTime();

                        if (semesterEnded) {
                            return (
                                <QuietState
                                    theme={theme} isDark={isDark} tint={tints.attendance}
                                    icon="checkmark-done-circle"
                                    title="Semester ended"
                                    body={`Ended ${semEnd!.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Switch terms to see classes.`}
                                />
                            );
                        }

                        if (semesterNotStarted) {
                            const daysUntil = Math.ceil((semStart!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            return (
                                <QuietState
                                    theme={theme} isDark={isDark} tint={tints.schedule}
                                    icon="hourglass-outline"
                                    title={`Starts in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`}
                                    body={`Classes begin ${semStart!.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Get ready!`}
                                />
                            );
                        }

                        if (todayClasses.length === 0) {
                            return (
                                <QuietState
                                    theme={theme} isDark={isDark} tint={tints.tasks}
                                    icon="game-controller"
                                    title="Free time"
                                    body="No classes today. Go touch grass or play games!"
                                />
                            );
                        }

                        return (
                            <Card padding={0} radius={Radius.xl} style={{ overflow: 'hidden' }}>
                                {todayClasses.map((cls: any, idx: number) => {
                                    const nowDate = new Date();
                                    const currentHourFloat = nowDate.getHours() + (nowDate.getMinutes() / 60);
                                    const waitHours = cls.startHour - currentHourFloat;
                                    const durationVal = cls.duration || 1;

                                    let timeString = '';
                                    if (waitHours > 0) {
                                        const totalMins = Math.max(1, Math.round(waitHours * 60));
                                        const h = Math.floor(totalMins / 60);
                                        const m = totalMins % 60;
                                        timeString = `in ${h > 0 ? `${h}h ` : ''}${m > 0 || h === 0 ? `${m}m` : ''}`.trim();
                                    } else if (waitHours > -durationVal) {
                                        timeString = 'Now';
                                    } else {
                                        timeString = 'Ended';
                                    }

                                    const isNow = waitHours <= 0 && waitHours > -durationVal;
                                    const isDone = waitHours <= -durationVal;

                                    const classAccent = (cls.colorIdx !== undefined && cls.colorIdx !== null)
                                        ? ['#e0524a', '#2fae6e', '#3b82f6', '#e08b12', '#8b5cf6', '#0ea5c4'][((Math.floor(cls.colorIdx) % 6) + 6) % 6]
                                        : tints.schedule.solid;

                                    const start = splitClassTime(cls.startHour);

                                    return (
                                        <View
                                            key={cls.id || idx}
                                            style={{
                                                borderTopWidth: idx === 0 ? 0 : 1,
                                                borderTopColor: theme.cardBorder,
                                                backgroundColor: isNow
                                                    ? tints.attendance.fill
                                                    : 'transparent',
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', paddingVertical: 11, paddingRight: 10, paddingLeft: 10, opacity: isDone ? 0.55 : 1 }}>
                                                {/* Time rail */}
                                                <View style={{ width: 50, alignItems: 'center', paddingTop: 1 }}>
                                                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 14, color: theme.text, letterSpacing: -0.3 }}>
                                                        {start.clock}
                                                    </Text>
                                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 9, color: theme.textTertiary, letterSpacing: 0.5 }}>
                                                        {start.ampm}
                                                    </Text>
                                                    <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 9.5, color: theme.textTertiary, marginTop: 3 }}>
                                                        {durationVal}h
                                                    </Text>
                                                </View>

                                                {/* Colour rail */}
                                                <View style={{ width: 4, borderRadius: 2, backgroundColor: classAccent, marginHorizontal: 9 }} />

                                                <TouchableOpacity
                                                    activeOpacity={0.7}
                                                    onPress={() => router.push({ pathname: '/(tabs)/schedule', params: { viewMode: 'attendance', targetDate: todayStr, trigger: Date.now() } })}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`${cls.name}, ${formatClassTime(cls.startHour)} to ${formatClassTime(cls.startHour + durationVal)}, room ${cls.room || 'to be announced'}. ${timeString}. Open attendance.`}
                                                    style={{ flex: 1, justifyContent: 'center', marginRight: 8 }}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                                                        <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: theme.text, marginRight: 6 }}>
                                                            {cls.name}
                                                        </Text>
                                                        {isNow ? (
                                                            <View style={{
                                                                flexDirection: 'row', alignItems: 'center',
                                                                paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
                                                                backgroundColor: tints.attendance.solid,
                                                            }}>
                                                                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff', marginRight: 4 }} />
                                                                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 9.5, color: '#fff' }}>NOW</Text>
                                                            </View>
                                                        ) : (
                                                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 10.5, color: theme.textTertiary }}>
                                                                {timeString}
                                                            </Text>
                                                        )}
                                                    </View>
                                                    {/* Room on one line, never wrapping under the icon */}
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Ionicons name="location-outline" size={11} color={theme.textTertiary} />
                                                        <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textSecondary, marginLeft: 3 }}>
                                                            {cls.room || 'TBA'}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>

                                                {/* Attendance — the one place saturated colour is earned */}
                                                <View style={{ flexDirection: 'row', alignSelf: 'center', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: theme.cardBorder }}>
                                                    {(['present', 'absent', 'cancelled'] as const).map((statusOption) => {
                                                        const key = `${todayStr}_${cls.id}`;
                                                        const current = currentSem?.attendanceLog?.[key];
                                                        let currentStatus = null;
                                                        if (current) {
                                                            if (typeof current === 'boolean') currentStatus = current ? 'present' : null;
                                                            else currentStatus = current.status;
                                                        }
                                                        const isActive = currentStatus === statusOption;

                                                        const label = statusOption === 'present' ? 'P' : (statusOption === 'absent' ? 'A' : 'NC');
                                                        const fullLabel = statusOption === 'present' ? 'present' : (statusOption === 'absent' ? 'absent' : 'no class');
                                                        const activeBg = statusOption === 'present' ? tints.attendance.solid
                                                            : (statusOption === 'absent' ? tints.danger.solid : theme.textTertiary);

                                                        return (
                                                            <TouchableOpacity
                                                                key={statusOption}
                                                                accessibilityRole="button"
                                                                accessibilityState={{ selected: isActive }}
                                                                accessibilityLabel={`Mark ${cls.name} ${fullLabel}`}
                                                                onPress={() => {
                                                                    const nd = JSON.parse(JSON.stringify(data));
                                                                    const sem = nd.years?.find((y:any) => y.id === activeYearId)?.semesters?.find((s:any) => s.id === activeSemId);
                                                                    if (sem) {
                                                                        if (!sem.attendanceLog) sem.attendanceLog = {};
                                                                        let existing = sem.attendanceLog[key];
                                                                        if (typeof existing === 'boolean') existing = { status: existing ? 'present' : null };
                                                                        sem.attendanceLog[key] = { ...(existing || {}), status: isActive ? 'pending' : statusOption, isManual: true };
                                                                        setData(nd);
                                                                        AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(nd));
                                                                        SyncService.pushLocalChanges(nd);
                                                                    }
                                                                }}
                                                                style={{
                                                                    minWidth: 33, height: 36, alignItems: 'center', justifyContent: 'center',
                                                                    borderRightWidth: statusOption !== 'cancelled' ? 1 : 0,
                                                                    borderRightColor: theme.cardBorder,
                                                                    backgroundColor: isActive ? activeBg : (isDark ? 'rgba(255,255,255,0.03)' : '#ffffff'),
                                                                }}
                                                            >
                                                                <Text style={{
                                                                    fontFamily: 'Nunito_800ExtraBold', fontSize: 11.5,
                                                                    color: isActive ? '#ffffff' : theme.textSecondary,
                                                                }}>
                                                                    {label}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </Card>
                        );
                    })()}
                    </View>
                </FadeInItem>

                {/* ══ TASKS ════════════════════════════════════════════════════ */}
                <FadeInItem index={4} style={{ paddingHorizontal: GUTTER, marginBottom: 24 }}>
                    <SectionHeader
                        title="Tasks"
                        count={pendingTasksCount > 0 ? pendingTasksCount : undefined}
                        onAction={() => router.push('/(tabs)/requirements')}
                        actionLabel="View all"
                        railColor={tints.tasks.solid}
                    />

                    {(() => {
                        let taskItems: any[] = [];
                        if (currentSem?.subjects) {
                            currentSem.subjects.forEach((sub: any) => {
                                if (sub.requirements) {
                                    taskItems.push(...sub.requirements
                                        .filter((r: any) => r.status !== 'submitted' && r.status !== 'graded')
                                        .map((r: any) => ({ ...r, subjectId: sub.id, subjectName: sub.name, title: r.title, priority: r.priority || 'medium', date: r.dueDate || r.date }))
                                    );
                                }
                            });
                        }

                        const todayTime = new Date().setHours(0,0,0,0);
                        const thresholds = data?.settings?.taskThresholds || { high: 21, medium: 10, low: 5 };

                        const visibleTasks = taskItems
                            .filter((m: any) => {
                                if (!m.date) return false;
                                const mTime = parseLocalDate(m.date);
                                if (mTime === 0) return false;
                                const diffDays = Math.round((mTime - todayTime) / (1000 * 60 * 60 * 24));
                                if (diffDays < 0) return true;
                                const prio = (m.priority || 'medium').toLowerCase();
                                if (prio === 'high') return diffDays <= thresholds.high;
                                if (prio === 'medium') return diffDays <= thresholds.medium;
                                return diffDays <= thresholds.low;
                            })
                            .sort((a: any, b: any) => parseLocalDate(a.date) - parseLocalDate(b.date))
                            .slice(0, 3);

                        if (visibleTasks.length === 0) {
                            return (
                                <QuietState
                                    theme={theme} isDark={isDark} tint={tints.attendance}
                                    image={require('../../assets/images/studying.png')}
                                    title="All clear"
                                    body="No pending tasks. You're all caught up."
                                />
                            );
                        }

                        return (
                            <Card padding={0} radius={Radius.xl} style={{ overflow: 'hidden' }}>
                                {visibleTasks.map((m: any, idx: number) => {
                                    const mTime = parseLocalDate(m.date);
                                    const mDate = new Date(mTime || Date.now());
                                    const daysText = getTimeLeftText(m.date, now);
                                    const diffDays = Math.round((mTime - todayTime) / (1000 * 60 * 60 * 24));
                                    const isOverdue = daysText === 'Overdue';
                                    const urgencyTint = isOverdue ? tints.danger : (diffDays <= 3 ? tints.tasks : null);
                                    const prio = (m.priority || 'medium').toLowerCase();
                                    const badgeVariant = prio === 'high' ? 'high' : (prio === 'medium' ? 'medium' : 'low');

                                    return (
                                        <View
                                            key={m.id || idx}
                                            style={{
                                                flexDirection: 'row', alignItems: 'center', padding: 10,
                                                borderTopWidth: idx === 0 ? 0 : 1,
                                                borderTopColor: theme.cardBorder,
                                                backgroundColor: isOverdue ? tints.danger.fill : 'transparent',
                                            }}
                                        >
                                            <TouchableOpacity
                                                activeOpacity={0.7}
                                                onPress={() => router.push({ pathname: '/(tabs)/requirements', params: { subjectId: m.subjectId } })}
                                                accessibilityRole="button"
                                                accessibilityLabel={`${m.title}, ${m.subjectName}, ${prio} priority, ${daysText}`}
                                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 8 }}
                                            >
                                                {/* Due date block */}
                                                <View style={{
                                                    width: 44, height: 48, borderRadius: 12, marginRight: 11,
                                                    alignItems: 'center', justifyContent: 'center',
                                                    backgroundColor: (urgencyTint || tints.schedule).fill,
                                                    borderWidth: 1, borderColor: (urgencyTint || tints.schedule).line,
                                                }}>
                                                    <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 17, color: (urgencyTint || tints.schedule).ink, letterSpacing: -0.5 }}>
                                                        {mDate.getDate()}
                                                    </Text>
                                                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.8, color: (urgencyTint || tints.schedule).ink }}>
                                                        {mDate.toLocaleString('default', { month: 'short' })}
                                                    </Text>
                                                </View>

                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                                        <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: theme.text, marginRight: 6 }}>
                                                            {m.title}
                                                        </Text>
                                                        <Badge label={prio} variant={badgeVariant as any} />
                                                    </View>
                                                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textSecondary, marginBottom: 2 }}>
                                                        {m.subjectName}
                                                    </Text>
                                                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: urgencyTint ? urgencyTint.ink : theme.textTertiary }}>
                                                        {daysText} · due {mDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                accessibilityRole="button"
                                                accessibilityLabel={`Mark ${m.title} as done`}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                onPress={() => {
                                                    const nd = JSON.parse(JSON.stringify(data));
                                                    const sem = nd.years?.find((y:any) => y.id === activeYearId)?.semesters?.find((s:any) => s.id === activeSemId);
                                                    if (sem && sem.subjects) {
                                                        const subj = sem.subjects.find((s:any) => s.id === m.subjectId);
                                                        if (subj && subj.requirements) {
                                                            const req = subj.requirements.find((r:any) => r.id === m.id);
                                                            if (req) {
                                                                req.status = 'submitted';
                                                                setData(nd);
                                                                AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(nd));
                                                                SyncService.pushLocalChanges(nd);
                                                            }
                                                        }
                                                    }
                                                }}
                                                style={{
                                                    width: 38, height: 38, borderRadius: 12,
                                                    alignItems: 'center', justifyContent: 'center',
                                                    backgroundColor: tints.attendance.fill,
                                                    borderWidth: 1, borderColor: tints.attendance.line,
                                                    borderBottomWidth: 2,
                                                }}
                                            >
                                                <Ionicons name="checkmark" size={19} color={tints.attendance.ink} />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </Card>
                        );
                    })()}
                </FadeInItem>

                {/* ══ UPCOMING ═════════════════════════════════════════════════ */}
                <FadeInItem index={5} style={{ paddingHorizontal: GUTTER, marginBottom: 24 }}>
                    <SectionHeader
                        title="Upcoming"
                        onAction={() => router.push('/(tabs)/calendar')}
                        actionLabel="Add"
                        actionIcon="add-circle-outline"
                        railColor={tints.attendance.solid}
                    />

                    {(() => {
                        let eventItems: any[] = [];
                        if (currentSem?.milestones) {
                            eventItems.push(...currentSem.milestones.map((m: any) => ({ ...m, priority: m.priority || 'medium' })));
                        }

                        const todayTime = new Date().setHours(0,0,0,0);

                        const upcomingEvents = eventItems
                            .filter((m: any) => {
                                if (!m.date) return false;
                                const mTime = parseLocalDate(m.date);
                                if (mTime === 0) return false;
                                return mTime >= todayTime;
                            })
                            .sort((a: any, b: any) => parseLocalDate(a.date) - parseLocalDate(b.date))
                            .slice(0, 3);

                        if (upcomingEvents.length === 0) {
                            return (
                                <QuietState
                                    theme={theme} isDark={isDark} tint={tints.schedule}
                                    image={require('../../assets/images/studying.png')}
                                    title="Clear skies"
                                    body="No upcoming events. Smooth sailing ahead."
                                />
                            );
                        }

                        return (
                            <Card padding={0} radius={Radius.xl} style={{ overflow: 'hidden' }}>
                                {upcomingEvents.map((m: any, idx: number) => {
                                    const mTime = parseLocalDate(m.date);
                                    const mDate = new Date(mTime || Date.now());
                                    const diffDays = Math.round((mTime - todayTime) / (1000 * 60 * 60 * 24));
                                    const daysText = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : `In ${diffDays} days`;
                                    const dayTint = diffDays === 0 ? tints.attendance : (diffDays <= 3 ? tints.tasks : tints.schedule);
                                    const prio = (m.priority || 'medium').toLowerCase();
                                    const badgeVariant = prio === 'high' ? 'high' : (prio === 'medium' ? 'medium' : 'low');

                                    return (
                                        <TouchableOpacity
                                            key={m.id || idx}
                                            activeOpacity={0.7}
                                            onPress={() => router.push('/(tabs)/calendar')}
                                            accessibilityRole="button"
                                            accessibilityLabel={`${m.title}, ${daysText}, ${prio} priority`}
                                            style={{
                                                flexDirection: 'row', alignItems: 'center', padding: 10,
                                                borderTopWidth: idx === 0 ? 0 : 1,
                                                borderTopColor: theme.cardBorder,
                                            }}
                                        >
                                            <View style={{
                                                width: 44, height: 48, borderRadius: 12, marginRight: 11,
                                                alignItems: 'center', justifyContent: 'center',
                                                backgroundColor: dayTint.fill,
                                                borderWidth: 1, borderColor: dayTint.line,
                                            }}>
                                                <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 17, color: dayTint.ink, letterSpacing: -0.5 }}>{mDate.getDate()}</Text>
                                                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.8, color: dayTint.ink }}>
                                                    {mDate.toLocaleString('default', { month: 'short' })}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1, marginRight: 8 }}>
                                                <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: theme.text }}>
                                                    {m.title}
                                                </Text>
                                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: dayTint.ink, marginTop: 2 }}>
                                                    {daysText}
                                                </Text>
                                            </View>
                                            <Badge label={prio} variant={badgeVariant as any} />
                                        </TouchableOpacity>
                                    );
                                })}
                            </Card>
                        );
                    })()}
                </FadeInItem>

                {/* ══ SUBJECTS — a full-bleed shelf, so cards never clip ════════ */}
                <FadeInItem index={6} style={{ marginBottom: 8 }}>
                    <View style={{ paddingHorizontal: GUTTER }}>
                        <SectionHeader
                            title="My Subjects"
                            count={currentSem?.subjects?.length || 0}
                            subtitle={totalUnits > 0 ? `${totalUnits} units enrolled` : undefined}
                            onAction={() => router.push('/(tabs)/grades')}
                            actionLabel="Grades"
                            railColor={tints.grades.solid}
                        />
                    </View>

                    {(!currentSem?.subjects || currentSem.subjects.length === 0) ? (
                        <View style={{ paddingHorizontal: GUTTER }}>
                            <QuietState
                                theme={theme} isDark={isDark} tint={tints.grades}
                                icon="journal-outline"
                                title="No subjects yet"
                                body="Add subjects in Grades or Academic Manager to track progress."
                            />
                        </View>
                    ) : (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            decelerationRate="fast"
                            snapToInterval={subjectCardWidth + 10}
                            snapToAlignment="start"
                            contentContainerStyle={{ gap: 10, paddingHorizontal: GUTTER, paddingVertical: 2 }}
                        >
                            {currentSem.subjects.map((sub: any, idx: number) => {
                                const requirements = sub.requirements || [];
                                const totalTasks = requirements.length;
                                const completedTasks = requirements.filter((req: any) => req.status === 'submitted' || req.status === 'graded').length;
                                const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                                const cardAccent = (sub.colorIdx !== undefined && sub.colorIdx !== null)
                                    ? ['#6d4aec', '#10a37a', '#3b82f6', '#e08b12', '#8b5cf6', '#e0524a'][((Math.floor(sub.colorIdx) % 6) + 6) % 6]
                                    : tints.grades.solid;
                                const codeDisplay = sub.code ? sub.code : sub.name;
                                const nameDisplay = sub.code && sub.name && sub.code !== sub.name ? sub.name : null;

                                return (
                                    <Card
                                        key={sub.id || idx}
                                        padding={0}
                                        radius={Radius.lg}
                                        onPress={() => router.push({ pathname: '/(tabs)/requirements', params: { subjectId: sub.id } })}
                                        accessibilityLabel={`${codeDisplay}${nameDisplay ? `, ${nameDisplay}` : ''}, ${sub.units ?? 0} units, ${completedTasks} of ${totalTasks} tasks done`}
                                        style={{ width: subjectCardWidth, overflow: 'hidden' }}
                                    >
                                        {/* Colour cap — identifies the subject at a glance */}
                                        <View style={{ height: 4, backgroundColor: cardAccent }} />

                                        <View style={{ padding: 12 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                                                <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Nunito_900Black', fontSize: 14, color: theme.text, marginRight: 6, letterSpacing: -0.2 }}>
                                                    {codeDisplay}
                                                </Text>
                                                <View style={{
                                                    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
                                                    backgroundColor: theme.surfaceSecondary,
                                                }}>
                                                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 9.5, color: theme.textSecondary }}>
                                                        {sub.units ?? 0}u
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Fixed-height slot keeps every card the same height whether
                                                or not the subject has a long name behind its code. */}
                                            <View style={{ height: 16, marginBottom: 10, justifyContent: 'center' }}>
                                                {nameDisplay ? (
                                                    <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textSecondary }}>
                                                        {nameDisplay}
                                                    </Text>
                                                ) : null}
                                            </View>

                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                                <Text style={microLabel}>Tasks</Text>
                                                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 11.5, color: theme.text }}>
                                                    {completedTasks}/{totalTasks}
                                                </Text>
                                            </View>
                                            <ProgressBar
                                                progress={progressPercent / 100}
                                                height={6}
                                                color={cardAccent}
                                                animate={false}
                                                accessibilityLabel={`${codeDisplay} task progress`}
                                            />
                                        </View>
                                    </Card>
                                );
                            })}
                        </ScrollView>
                    )}
                </FadeInItem>
                </>
                )}

                <View style={{ height: tabBarHeight + 24 }} />
              </View>
            </ScrollView>

            <ScheduleScannerModal 
                visible={showScannerModal}
                onClose={() => setShowScannerModal(false)}
                onApply={handleScannedClasses}
                isPremium={isPremium}
                onRequestPremium={() => { setShowScannerModal(false); setShowPaywall(true); }}
            />

            <PremiumPaywallModal 
                visible={showPaywall} 
                onClose={() => setShowPaywall(false)} 
                entryPoint="grades"
            />

            <DevMenuModal 
                visible={showDevMenu}
                onClose={() => setShowDevMenu(false)}
                isDark={isDark}
                onShowPaywall={() => setShowPaywall(true)}
            />

            <TermSetupModal
                visible={showTermSetup}
                onClose={() => setShowTermSetup(false)}
                onCreated={() => loadData()}
            />
        </SafeAreaView>
    );
}

interface QuietStateProps {
    theme: any;
    isDark: boolean;
    tint: { fill: string; line: string; ink: string; solid: string };
    /** Either an Ionicon name or an image source — never both. */
    icon?: keyof typeof Ionicons.glyphMap;
    image?: any;
    title: string;
    body: string;
}

/**
 * The one "nothing here" state. Deliberately low-contrast and borderless: an
 * empty section should recede, not occupy the same visual weight as a section
 * full of real work. Earlier this was a full card, which meant two empty
 * sections could dominate the whole screen.
 */
function QuietState({ theme, isDark, tint, icon, image, title, body }: QuietStateProps) {
    return (
        <View
            style={{
                flexDirection: 'row', alignItems: 'center',
                padding: 12, borderRadius: Radius.lg,
                backgroundColor: tint.fill,
                borderWidth: 1, borderColor: tint.line,
            }}
        >
            {image ? (
                <Image source={image} style={{ width: 34, height: 34, marginRight: 11 }} resizeMode="contain" />
            ) : (
                <View
                    style={{
                        width: 34, height: 34, borderRadius: 11, marginRight: 11,
                        alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)',
                    }}
                >
                    <Ionicons name={icon || 'ellipse-outline'} size={17} color={tint.ink} />
                </View>
            )}
            <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 13.5, color: theme.text }}>{title}</Text>
                <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textSecondary, marginTop: 1, lineHeight: 16 }}>
                    {body}
                </Text>
            </View>
        </View>
    );
}
