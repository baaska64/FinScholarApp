import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, Animated, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { supabase } from '@/services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { Calculator } from '@/utils/calculator';
import Tabs from '@/components/ledger/Tabs';
import { useSemesterContext } from '@/components/SemesterContext';
import { getTheme, Typography, Radius, Shadows } from '@/constants/Theme';
import { DashboardSkeleton } from '@/components/ui/LoadingSkeleton';
import SectionHeader from '@/components/ui/SectionHeader';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import Badge from '@/components/ui/Badge';
import { SyncService } from '@/services/SyncService';
import PremiumPaywallModal from '@/components/PremiumPaywallModal';
import DevMenuModal from '@/components/DevMenuModal';


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

const getTimeLeftText = (dueDateIso: string, nowMs: number) => {
    const isOldFormat = !dueDateIso.includes('T');
    let dueTime = 0;
    if (isOldFormat) {
        const parts = dueDateIso.split('-');
        dueTime = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59).getTime();
    } else {
        dueTime = new Date(dueDateIso).getTime();
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
        }, [user])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        getRandomQuote();
        await loadData(true);
        setRefreshing(false);
    };

    if (!data) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                <DashboardSkeleton />
            </SafeAreaView>
        );
    }

    const currentYear = data.years.find((y: any) => y.id === activeYearId);
    const currentSem = currentYear?.semesters.find((s: any) => s.id === activeSemId);
    const system = data.settings?.gradingSystem || '1_IS_BEST';
    
    const semRes = currentSem ? Calculator.calculateSemester(currentSem, system) : { percent: 0, equivalent: 0 };
    const yrRes = currentYear ? Calculator.calculateYear(currentYear, system) : { percent: 0, equivalent: 0 };

    // Metric 1: Semester Progress (days passed / total days * 100)
    const semProgress = currentSem && currentSem.startDate && currentSem.endDate ? (() => {
        const start = new Date(currentSem.startDate + 'T00:00:00').getTime();
        const end = new Date(currentSem.endDate + 'T00:00:00').getTime();
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
        const startDateStr = currentSem.startDate || new Date().toISOString().split('T')[0];
        const endDateStr = currentSem.endDate || new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString().split('T')[0];
        const attendanceLog = currentSem.attendanceLog || {};
        
        const start = new Date(startDateStr + 'T00:00:00');
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

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            {/* Top App Bar */}
            <View 
                style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 16, zIndex: 10,
                    borderBottomWidth: 1, borderBottomColor: theme.cardBorder,
                    backgroundColor: theme.surface,
                    ...(!isDark ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 } : {}),
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ ...Typography.title, color: theme.text }}>FinScholar</Text>
                    {isPremium ? (
                        <View style={{ backgroundColor: theme.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>PRO</Text>
                        </View>
                    ) : (
                        <TouchableOpacity 
                            onPress={() => setShowPaywall(true)}
                            style={{ backgroundColor: theme.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                            <Ionicons name="diamond" size={10} color="#fff" />
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>GET PRO</Text>
                        </TouchableOpacity>
                    )}
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {syncStatus === 'syncing' && <Ionicons name="cloud-upload" size={22} color={theme.textTertiary} />}
                    {syncStatus === 'saved' && <Ionicons name="cloud-done" size={22} color={theme.success} />}
                    {(syncStatus === 'error' || syncStatus === 'offline') && <Ionicons name="cloud-offline" size={22} color={theme.textTertiary} />}
                    
                    <TouchableOpacity 
                        onPress={() => router.push('/(tabs)/profile')} 
                        style={{
                            width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: theme.surfaceSecondary
                        }}
                    >
                        <Ionicons name="settings-outline" size={22} color={theme.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView 
                style={{ flex: 1 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                showsVerticalScrollIndicator={false}
                bounces={true}
                removeClippedSubviews={true}
            >
              <View style={{ width: '100%', maxWidth: 800, alignSelf: 'center' }}>
                <View style={{ height: 24 }} />

                {data.years.length === 0 ? (
                    <View style={{ 
                        marginHorizontal: 24, 
                        marginTop: 40, 
                        borderRadius: Radius['4xl'], 
                        borderWidth: isDark ? 1 : 0, 
                        borderColor: theme.cardBorder, 
                        backgroundColor: theme.surface, 
                        ...(!isDark ? Shadows.xl : {}),
                        overflow: 'hidden'
                    }}>
                        {/* Header Section */}
                        <View style={{
                            backgroundColor: isDark ? '#312e81' : '#eef2ff',
                            width: '100%',
                            paddingTop: 32,
                            paddingBottom: 24,
                            alignItems: 'center',
                            borderBottomWidth: 1,
                            borderBottomColor: theme.cardBorder
                        }}>
                            <View style={{
                                width: 110,
                                height: 110,
                                borderRadius: 55,
                                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#ffffff',
                                borderWidth: 3,
                                borderColor: isDark ? 'rgba(99, 102, 241, 0.4)' : '#c7d2fe',
                                justifyContent: 'center',
                                alignItems: 'center',
                                overflow: 'hidden',
                                ...(!isDark ? Shadows.sm : {})
                            }}>
                                <Image 
                                    source={require('../../assets/images/finanimated.gif')} 
                                    style={{ 
                                        width: 175, 
                                        height: 175, 
                                        transform: [{ translateY: 25 }] 
                                    }} 
                                    resizeMode="contain" 
                                />
                            </View>
                        </View>
                        
                        {/* Content Section */}
                        <View style={{ padding: 24, alignItems: 'center', width: '100%' }}>
                            <Text style={{ ...Typography.title, fontSize: 24, color: theme.text, textAlign: 'center', marginBottom: 12 }}>
                                Welcome to FinScholar!
                            </Text>
                            <Text style={{ ...Typography.body, fontSize: 15, color: theme.textSecondary, textAlign: 'center', marginBottom: 28, lineHeight: 22 }}>
                                You haven't set up any academic terms yet. Let's create your first Year and Semester to start tracking!
                            </Text>
                            <AnimatedPressable 
                                onPress={() => router.push('/(tabs)/academic-manager')}
                                style={{
                                    backgroundColor: theme.primary, paddingVertical: 16, paddingHorizontal: 24,
                                    borderRadius: Radius.full, flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center',
                                    ...Platform.select({ ios: { shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 }, android: { elevation: 6 } }),
                                }}
                            >
                                <Ionicons name="options-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={{ color: '#ffffff', fontFamily: 'Nunito_700Bold', fontSize: 16 }}>Manage Academic Terms</Text>
                            </AnimatedPressable>
                        </View>
                    </View>
                ) : (
                    <>
                {/* Year/Term Selector */}
                <View style={{ marginBottom: 16, paddingHorizontal: 24 }}>
                    <Tabs 
                        years={data.years} 
                        activeYearId={activeYearId} 
                        activeSemId={activeSemId}
                    />
                </View>

                {/* Hero Banner & Overlapping Stats Combined */}
                <FadeInItem index={0}>
                    <View style={{ 
                        marginHorizontal: 24, 
                        marginBottom: 28,
                        borderRadius: Radius['4xl'],
                        backgroundColor: theme.surface,
                        ...(!isDark ? Shadows.lg : {}),
                        borderWidth: isDark ? 1 : 0,
                        borderColor: theme.cardBorder,
                    }}>
                        {/* Top Blue Banner */}
                        <View style={{
                            backgroundColor: isDark ? '#312e81' : '#4f46e5',
                            padding: 20,
                            paddingBottom: 48,
                            borderTopLeftRadius: Radius['4xl'],
                            borderTopRightRadius: Radius['4xl'],
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            {/* Decorative background glow circle */}
                            <View style={{
                                position: 'absolute', right: -30, top: -30, width: 180, height: 180,
                                borderRadius: 90, backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            }} />

                            {/* Banner Top Row: Fin Quote & Mascot */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                {/* Speech Bubble / Quote */}
                                <TouchableOpacity 
                                    activeOpacity={0.8}
                                    onPress={getRandomQuote}
                                    style={{
                                        flex: 1,
                                        padding: 14,
                                        borderRadius: Radius['2xl'],
                                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.2)',
                                        borderWidth: 1,
                                        borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.3)',
                                        marginRight: 12,
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <Ionicons name="sparkles" size={13} color="#fcd34d" />
                                        <Text style={{ ...Typography.label, textTransform: 'uppercase', letterSpacing: 1.2, color: '#e0e7ff' }}>Fin says:</Text>
                                    </View>
                                    <Text style={{ ...Typography.caption, fontStyle: 'italic', color: '#ffffff', lineHeight: 18 }}>
                                        "{quote}"
                                    </Text>
                                </TouchableOpacity>

                                {/* Mascot Graphic */}
                                <View style={{ width: 100, height: 100, justifyContent: 'center', alignItems: 'center' }}>
                                    <Image 
                                        source={require('../../assets/images/finanimated.gif')} 
                                        style={{ 
                                            width: 200, 
                                            height: 200,
                                            transform: [{ translateY: 40 }]
                                        }}
                                        resizeMode="contain" 
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Bottom Stats Card */}
                        <View style={{
                            backgroundColor: theme.surface,
                            borderRadius: Radius['4xl'],
                            padding: 20,
                            marginTop: -28,
                            zIndex: 10,
                        }}>
                            {/* Metric 1: Semester Progress Bar */}
                            <View style={{ marginBottom: 16 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isDark ? 'rgba(129,140,248,0.2)' : theme.primaryLight + '25', alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name="calendar-outline" size={15} color={theme.primary} />
                                        </View>
                                        <Text style={{ ...Typography.label, color: theme.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                            Semester Progress
                                        </Text>
                                    </View>
                                    <Text style={{ ...Typography.subtitle, color: theme.primary, fontSize: 16 }}>
                                        {semProgress.percent}%
                                    </Text>
                                </View>
                                <View style={{ height: 8, width: '100%', borderRadius: 4, backgroundColor: theme.surfaceSecondary, overflow: 'hidden' }}>
                                    <View style={{ height: '100%', width: `${semProgress.percent}%`, backgroundColor: theme.primary, borderRadius: 4 }} />
                                </View>
                                <Text style={{ ...Typography.caption, color: theme.textTertiary, marginTop: 4, fontSize: 11 }}>
                                    {currentSem?.startDate && currentSem?.endDate ? (
                                        `${semProgress.daysPassed} of ${semProgress.totalDays} days passed`
                                    ) : (
                                        'Set semester start & end dates in Academic Manager'
                                    )}
                                </Text>
                            </View>

                            {/* Divider line */}
                            <View style={{ height: 1, backgroundColor: theme.cardBorder, marginBottom: 16 }} />

                            {/* 4-Metric Grid (Metrics 2, 3, 4, 5) */}
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                {/* (2) Year GWA */}
                                <View style={{
                                    flex: 1, minWidth: '45%', padding: 12, borderRadius: Radius['2xl'],
                                    backgroundColor: theme.surfaceSecondary,
                                    borderWidth: 1, borderColor: theme.cardBorder,
                                }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <Ionicons name="school-outline" size={14} color={isDark ? '#818cf8' : '#4f46e5'} />
                                        <Text style={{ ...Typography.label, color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase' }}>Year GWA</Text>
                                    </View>
                                    <Text style={{ ...Typography.title, color: theme.text, fontSize: 18 }}>
                                        {system === 'PERCENT' ? (yrRes.percent > 0 ? `${yrRes.percent.toFixed(2)}%` : '--') : (yrRes.equivalent > 0 ? yrRes.equivalent.toFixed(2) : '--')}
                                    </Text>
                                </View>

                                {/* (3) Sem GWA */}
                                <View style={{
                                    flex: 1, minWidth: '45%', padding: 12, borderRadius: Radius['2xl'],
                                    backgroundColor: theme.surfaceSecondary,
                                    borderWidth: 1, borderColor: theme.cardBorder,
                                }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <Ionicons name="ribbon-outline" size={14} color={isDark ? '#38bdf8' : '#0ea5e9'} />
                                        <Text style={{ ...Typography.label, color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase' }}>Sem GWA</Text>
                                    </View>
                                    <Text style={{ ...Typography.title, color: theme.text, fontSize: 18 }}>
                                        {system === 'PERCENT' ? (semRes.percent > 0 ? `${semRes.percent.toFixed(2)}%` : '--') : (semRes.equivalent > 0 ? semRes.equivalent.toFixed(2) : '--')}
                                    </Text>
                                </View>

                                {/* (4) Overall Attendance % */}
                                <View style={{
                                    flex: 1, minWidth: '45%', padding: 12, borderRadius: Radius['2xl'],
                                    backgroundColor: theme.surfaceSecondary,
                                    borderWidth: 1, borderColor: theme.cardBorder,
                                }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <Ionicons name="checkmark-done-circle-outline" size={14} color={isDark ? '#34d399' : '#10b981'} />
                                        <Text style={{ ...Typography.label, color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase' }}>Attendance</Text>
                                    </View>
                                    <Text style={{ ...Typography.title, color: theme.text, fontSize: 18 }}>
                                        {overallAttendance}%
                                    </Text>
                                </View>

                                {/* (5) Pending Tasks */}
                                <View style={{
                                    flex: 1, minWidth: '45%', padding: 12, borderRadius: Radius['2xl'],
                                    backgroundColor: theme.surfaceSecondary,
                                    borderWidth: 1, borderColor: theme.cardBorder,
                                }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <Ionicons name="checkbox-outline" size={14} color={isDark ? '#fbbf24' : '#f59e0b'} />
                                        <Text style={{ ...Typography.label, color: theme.textSecondary, fontSize: 10, textTransform: 'uppercase' }}>Pending Tasks</Text>
                                    </View>
                                    <Text style={{ ...Typography.title, color: theme.text, fontSize: 18 }}>
                                        {pendingTasksCount}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </FadeInItem>

                {/* Horizontal "My Subjects" Carousel Section */}
                <FadeInItem index={2}>
                    <View style={{ marginBottom: 28 }}>
                        <View style={{ paddingHorizontal: 24 }}>
                            <SectionHeader 
                                title={`My Subjects (${currentSem?.subjects?.length || 0})`} 
                                onAction={() => router.push('/(tabs)/grades')} 
                                actionIcon="arrow-forward-circle" 
                            />
                        </View>

                        {(!currentSem?.subjects || currentSem.subjects.length === 0) ? (
                            <View style={{ paddingHorizontal: 24 }}>
                                <View style={{
                                    padding: 20, borderRadius: Radius['2xl'], alignItems: 'center', justifyContent: 'center',
                                    borderWidth: 1, borderColor: theme.cardBorder,
                                    backgroundColor: theme.surface,
                                    ...Shadows.sm,
                                }}>
                                    <Ionicons name="journal-outline" size={32} color={theme.textTertiary} style={{ marginBottom: 8 }} />
                                    <Text style={{ ...Typography.captionBold, color: theme.textSecondary }}>No subjects enrolled yet</Text>
                                    <Text style={{ ...Typography.caption, color: theme.textTertiary, textAlign: 'center', marginTop: 2 }}>
                                        Add subjects in Academic Manager or Ledger to track progress
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <ScrollView
                                horizontal={true}
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 24, gap: 14 }}
                            >
                                {currentSem.subjects.map((sub: any, idx: number) => {
                                    const requirements = sub.requirements || [];
                                    const totalTasks = requirements.length;
                                    const completedTasks = requirements.filter((req: any) => req.status === 'submitted' || req.status === 'graded').length;
                                    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                                    const progressText = `${completedTasks}/${totalTasks} tasks (${progressPercent}%)`;

                                    const cardAccent = sub.colorIdx !== undefined 
                                        ? ['#4f46e5', '#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899'][sub.colorIdx % 6]
                                        : theme.primary;
                                    const codeDisplay = sub.code ? sub.code : sub.name;
                                    const nameDisplay = sub.code && sub.name && sub.code !== sub.name ? sub.name : null;
                                    const unitsDisplay = `${sub.units ?? 0} ${Number(sub.units) === 1 ? 'Unit' : 'Units'}`;

                                     return (
                                        <AnimatedPressable
                                            key={sub.id || idx}
                                            activeOpacity={0.85}
                                            onPress={() => router.push({ pathname: '/(tabs)/requirements', params: { subjectId: sub.id } })}
                                            style={{
                                                width: 220,
                                                padding: 16,
                                                borderRadius: Radius['2xl'],
                                                borderWidth: 1,
                                                borderColor: theme.cardBorder,
                                                backgroundColor: theme.surface,
                                                ...Shadows.md,
                                                justifyContent: 'space-between',
                                            }}
                                        >
                                            {/* Top row: Subject Code/Badge & Units */}
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                                <View style={{
                                                    flexDirection: 'row', alignItems: 'center', gap: 6,
                                                    backgroundColor: isDark ? `${cardAccent}25` : `${cardAccent}15`,
                                                    paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.md,
                                                }}>
                                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cardAccent }} />
                                                    <Text style={{ ...Typography.captionBold, color: isDark ? theme.text : cardAccent, fontSize: 12 }} numberOfLines={1}>
                                                        {codeDisplay}
                                                    </Text>
                                                </View>
                                                <Text style={{ ...Typography.caption, color: theme.textTertiary, fontSize: 11 }}>
                                                    {unitsDisplay}
                                                </Text>
                                            </View>

                                            {/* Middle: Subject Name (if distinct from code) */}
                                            {nameDisplay ? (
                                                <Text style={{ ...Typography.bodyBold, color: theme.text, fontSize: 14, marginBottom: 12 }} numberOfLines={1}>
                                                    {nameDisplay}
                                                </Text>
                                            ) : (
                                                <View style={{ height: 12 }} />
                                            )}

                                            {/* Bottom: Task Progress Bar & % */}
                                            <View style={{ marginTop: 'auto' }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                    <Text style={{ ...Typography.caption, color: theme.textSecondary, fontSize: 11 }}>
                                                        Progress
                                                    </Text>
                                                    <Text style={{ ...Typography.captionBold, color: theme.text, fontSize: 11 }}>
                                                        {progressText}
                                                    </Text>
                                                </View>
                                                <View style={{
                                                    height: 6, width: '100%', borderRadius: 3,
                                                    backgroundColor: theme.surfaceSecondary,
                                                    overflow: 'hidden',
                                                }}>
                                                    <View style={{
                                                        height: '100%',
                                                        width: `${progressPercent}%`,
                                                        backgroundColor: cardAccent,
                                                        borderRadius: 3,
                                                    }} />
                                                </View>
                                            </View>
                                        </AnimatedPressable>
                                    );
                                })}
                            </ScrollView>
                        )}
                    </View>
                </FadeInItem>

                {/* Today's Classes */}
                <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
                    <SectionHeader title="Today's Classes" onAction={() => router.push('/(tabs)/schedule')} actionIcon="arrow-forward-circle" />

                    {/* Semester date range indicator */}
                    {currentSem && (currentSem.startDate || currentSem.endDate) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
                            <Ionicons name="calendar-outline" size={13} color={theme.textTertiary} />
                            <Text style={{ ...Typography.caption, color: theme.textTertiary, marginLeft: 6 }}>
                                {currentSem.startDate ? new Date(currentSem.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '...'}
                                {' → '}
                                {currentSem.endDate ? new Date(currentSem.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '...'}
                            </Text>
                        </View>
                    )}

                    {(() => {
                        // Check if semester is active based on dates
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const semStart = currentSem?.startDate ? new Date(currentSem.startDate + 'T00:00:00') : null;
                        const semEnd = currentSem?.endDate ? new Date(currentSem.endDate + 'T00:00:00') : null;
                        const semesterEnded = semEnd && today > semEnd;
                        const semesterNotStarted = semStart && today < semStart;

                        if (semesterEnded) {
                            return (
                                <FadeInItem index={3}>
                                    <View style={{
                                        padding: 20, borderRadius: Radius['2xl'], flexDirection: 'row', alignItems: 'center',
                                        borderWidth: 1, borderColor: theme.cardBorder,
                                        backgroundColor: theme.surface,
                                        ...Shadows.md,
                                    }}>
                                        <View style={{ borderRadius: Radius.full, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: 14, backgroundColor: theme.surfaceSecondary, borderWidth: 1, borderColor: theme.cardBorder }}>
                                            <Ionicons name="checkmark-done-circle" size={24} color={theme.textSecondary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text numberOfLines={1} style={{ ...Typography.subtitle, fontSize: 16, color: theme.text }}>Semester Ended</Text>
                                            <Text numberOfLines={2} style={{ ...Typography.caption, color: theme.textSecondary, marginTop: 2, lineHeight: 18 }}>
                                                This semester ended on {semEnd!.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Switch to an active semester to see classes.
                                            </Text>
                                        </View>
                                    </View>
                                </FadeInItem>
                            );
                        }

                        if (semesterNotStarted) {
                            const daysUntil = Math.ceil((semStart!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            return (
                                <FadeInItem index={3}>
                                    <View style={{
                                        padding: 20, borderRadius: Radius['2xl'], flexDirection: 'row', alignItems: 'center',
                                        borderWidth: 1, borderColor: theme.cardBorder,
                                        backgroundColor: theme.surface,
                                        ...Shadows.md,
                                    }}>
                                        <View style={{ borderRadius: Radius.full, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: 14, backgroundColor: isDark ? 'rgba(129,140,248,0.2)' : theme.primaryLight + '25', borderWidth: 1, borderColor: theme.cardBorder }}>
                                            <Ionicons name="hourglass-outline" size={24} color={theme.primary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ ...Typography.subtitle, fontSize: 16, color: theme.text }}>Starts in {daysUntil} day{daysUntil > 1 ? 's' : ''}</Text>
                                            <Text style={{ ...Typography.caption, color: theme.textSecondary, marginTop: 2, lineHeight: 18 }}>
                                                Classes begin {semStart!.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Get ready!
                                            </Text>
                                        </View>
                                    </View>
                                </FadeInItem>
                            );
                        }

                        const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
                        const todayStr = new Date().toISOString().split('T')[0];
                        const log = currentSem?.attendanceLog || {};
                        const rawTodayClasses = (currentSem?.classes || []).filter((c: any) => c.day === todayIdx);
                        const todayClasses = rawTodayClasses.filter((c: any) => {
                            const entry = log[`${todayStr}_${c.id}`];
                            if (entry) {
                                if (typeof entry === 'boolean') return !entry;
                                if (entry.status !== 'pending' && entry.status != null) return false;
                            }
                            return true;
                        });

                        if (todayClasses.length === 0) {
                            return (
                                <FadeInItem index={3}>
                                    <View style={{
                                        padding: 20, borderRadius: Radius['2xl'], flexDirection: 'row', alignItems: 'center',
                                        borderWidth: 1, borderColor: theme.cardBorder,
                                        backgroundColor: theme.surface,
                                        ...Shadows.md,
                                    }}>
                                        <View style={{ borderRadius: Radius.full, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: 14, backgroundColor: isDark ? 'rgba(251,191,36,0.2)' : theme.warningLight, borderWidth: 1, borderColor: theme.cardBorder }}>
                                            <Ionicons name="game-controller" size={24} color={theme.warning} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ ...Typography.subtitle, fontSize: 16, color: theme.text }}>Free Time</Text>
                                            <Text style={{ ...Typography.caption, color: theme.textSecondary, marginTop: 2, lineHeight: 18 }}>No classes today. Go touch grass or play games!</Text>
                                        </View>
                                    </View>
                                </FadeInItem>
                            );
                        }

                        return todayClasses.map((cls: any, idx: number) => {
                            const formatTime = (h: number) => {
                                const hours = Math.floor(h);
                                const mins = Math.round((h - hours) * 60);
                                const ampm = hours >= 12 && hours < 24 ? 'PM' : 'AM';
                                let dh = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
                                if (dh > 12) dh -= 12;
                                return `${dh}:${mins.toString().padStart(2, '0')} ${ampm}`;
                            };
                            
                            const nowDate = new Date();
                            const currentHourFloat = nowDate.getHours() + (nowDate.getMinutes() / 60);
                            const waitHours = cls.startHour - currentHourFloat;
                            const durationVal = cls.duration || 1;
                            
                            let timeString = '';
                            if (waitHours > 0) {
                                const h = Math.floor(waitHours);
                                const m = Math.round((waitHours - h) * 60);
                                timeString = `Starts in ${h > 0 ? `${h}h ` : ''}${m}m`;
                            } else if (waitHours > -durationVal) {
                                timeString = `Ongoing`;
                            } else {
                                timeString = `Ended`;
                            }

                            const classAccent = cls.colorIdx !== undefined 
                                ? ['#ff453a', '#30d158', '#0a84ff', '#ff9f0a', '#bf5af2', '#64d2ff'][cls.colorIdx % 6] 
                                : theme.primary;

                            return (
                                <FadeInItem key={idx} index={idx + 3} style={{ marginBottom: 12 }}>
                                    <AnimatedPressable 
                                        activeOpacity={0.9}
                                        onPress={() => router.push({ pathname: '/(tabs)/schedule', params: { viewMode: 'attendance', targetDate: todayStr, trigger: Date.now() } })}
                                        style={{
                                            padding: 16, borderRadius: Radius['2xl'], flexDirection: 'row', alignItems: 'center',
                                            borderWidth: 1, borderColor: theme.cardBorder,
                                            backgroundColor: theme.surface,
                                            ...Shadows.md,
                                        }}
                                    >
                                        {/* Color strip accent */}
                                        <View style={{ width: 4, height: 48, borderRadius: 2, marginRight: 12, backgroundColor: classAccent }} />

                                        {/* Class Info */}
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                                                <Text style={{ ...Typography.subtitle, fontSize: 16, color: theme.text }} numberOfLines={1}>{cls.name}</Text>
                                                <View style={{
                                                    paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.sm,
                                                    backgroundColor: waitHours > 0 ? (isDark ? 'rgba(129,140,248,0.2)' : theme.primaryLight + '25')
                                                        : (waitHours > -durationVal ? (isDark ? 'rgba(52,211,153,0.2)' : theme.successLight)
                                                        : theme.surfaceSecondary)
                                                }}>
                                                    <Text style={{
                                                        ...Typography.captionBold, fontSize: 10,
                                                        color: waitHours > 0 ? theme.primary
                                                            : (waitHours > -durationVal ? theme.success
                                                            : theme.textTertiary)
                                                    }}>
                                                        {timeString}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <Ionicons name="time-outline" size={12} color={theme.textTertiary} />
                                                    <Text style={{ ...Typography.caption, color: theme.textSecondary, fontSize: 12 }}>
                                                        {formatTime(cls.startHour)} - {formatTime(cls.startHour + durationVal)} ({durationVal}h)
                                                    </Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                                    <Ionicons name="location-outline" size={12} color={theme.textTertiary} />
                                                    <Text style={{ ...Typography.caption, color: theme.textSecondary, fontSize: 12 }}>
                                                        {cls.room || 'TBA'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Attendance Buttons: P, A, NC */}
                                        <View style={{ flexDirection: 'row', borderRadius: Radius.md, borderWidth: 1, overflow: 'hidden', borderColor: theme.cardBorder }}>
                                            {['present', 'absent', 'cancelled'].map((statusOption) => {
                                                const key = `${todayStr}_${cls.id}`;
                                                const current = currentSem?.attendanceLog?.[key];
                                                let currentStatus = null;
                                                if (current) {
                                                    if (typeof current === 'boolean') currentStatus = current ? 'present' : null;
                                                    else currentStatus = current.status;
                                                }
                                                const isActive = currentStatus === statusOption;
                                                
                                                const label = statusOption === 'present' ? 'P' : (statusOption === 'absent' ? 'A' : 'NC');
                                                const activeBg = statusOption === 'present' ? theme.success : (statusOption === 'absent' ? theme.error : theme.textTertiary);

                                                return (
                                                    <TouchableOpacity 
                                                        key={statusOption}
                                                        onPress={() => {
                                                            const nd = JSON.parse(JSON.stringify(data));
                                                            const sem = nd.years.find((y:any) => y.id === activeYearId)?.semesters.find((s:any) => s.id === activeSemId);
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
                                                            paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center',
                                                            borderRightWidth: statusOption !== 'cancelled' ? 1 : 0,
                                                            borderRightColor: theme.cardBorder,
                                                            backgroundColor: isActive ? activeBg : 'transparent',
                                                        }}
                                                    >
                                                        <Text style={{
                                                            ...Typography.captionBold,
                                                            fontSize: 11,
                                                            color: isActive ? '#ffffff' : theme.textSecondary
                                                        }}>
                                                            {label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </AnimatedPressable>
                                </FadeInItem>
                            );
                        });
                    })()}
                </View>

                {/* Tasks Tracker */}
                <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
                    <SectionHeader title="Tasks" onAction={() => router.push('/(tabs)/requirements')} actionIcon="arrow-forward-circle" />
                    
                    {(() => {
                        let taskItems: any[] = [];
                        if (currentSem?.subjects) {
                            currentSem.subjects.forEach((sub: any) => {
                                if (sub.requirements) {
                                    taskItems.push(...sub.requirements
                                        .filter((r: any) => r.status !== 'submitted' && r.status !== 'graded')
                                        .map((r: any) => ({ ...r, subjectId: sub.id, subjectName: sub.name, title: r.title, priority: r.priority || 'medium', date: r.dueDate }))
                                    );
                                }
                            });
                        }

                        const parseLocalDate = (dateStr: string) => {
                            if (typeof dateStr === 'string' && dateStr.includes('-') && !dateStr.includes('T')) {
                                const parts = dateStr.split('-');
                                if (parts.length === 3) return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
                            }
                            const d = new Date(dateStr);
                            return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                        };

                        const todayTime = new Date().setHours(0,0,0,0);
                        const thresholds = data.settings?.taskThresholds || { high: 21, medium: 10, low: 5 };

                        const visibleTasks = taskItems
                            .filter((m: any) => {
                                if (!m.date) return false;
                                const mTime = parseLocalDate(m.date);
                                const diffDays = Math.round((mTime - todayTime) / (1000 * 60 * 60 * 24));
                                if (diffDays < 0) return true; // overdue tasks still need attention
                                const prio = (m.priority || 'medium').toLowerCase();
                                if (prio === 'high') return diffDays <= thresholds.high;
                                if (prio === 'medium') return diffDays <= thresholds.medium;
                                return diffDays <= thresholds.low;
                            })
                            .sort((a: any, b: any) => parseLocalDate(a.date) - parseLocalDate(b.date))
                            .slice(0, 3);

                        if (visibleTasks.length === 0) {
                            return (
                                <FadeInItem index={4}>
                                    <View style={{
                                        padding: 20, borderRadius: Radius['2xl'], flexDirection: 'row', alignItems: 'center',
                                        borderWidth: 1, borderColor: theme.cardBorder,
                                        backgroundColor: theme.surface,
                                        ...Shadows.md,
                                    }}>
                                        <Image source={require('../../assets/images/studying.png')} style={{ width: 48, height: 48, marginRight: 14 }} resizeMode="contain" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ ...Typography.subtitle, fontSize: 16, color: theme.text }}>All Clear!</Text>
                                            <Text style={{ ...Typography.caption, color: theme.textSecondary, marginTop: 2, lineHeight: 18 }}>No pending tasks. You're all caught up.</Text>
                                        </View>
                                    </View>
                                </FadeInItem>
                            );
                        }

                        return visibleTasks.map((m: any, idx: number) => {
                            const mTime = parseLocalDate(m.date);
                            const mDate = new Date(m.date.includes('T') ? m.date : mTime);
                            const daysText = getTimeLeftText(m.date, now);
                            const diffDays = Math.round((mTime - todayTime) / (1000 * 60 * 60 * 24));
                            let timeColor = daysText === 'Overdue' ? theme.error : (diffDays <= 3 ? theme.warning : theme.textTertiary);
                            const prio = (m.priority || 'medium').toLowerCase();
                            const badgeVariant = prio === 'high' ? 'high' : (prio === 'medium' ? 'medium' : 'low');

                            return (
                                <FadeInItem key={idx} index={idx + 4} style={{ marginBottom: 12 }}>
                                    <AnimatedPressable 
                                        activeOpacity={0.9}
                                        onPress={() => router.push({ pathname: '/(tabs)/requirements', params: { subjectId: m.subjectId } })}
                                        style={{
                                            padding: 16, borderRadius: Radius['2xl'], flexDirection: 'row', alignItems: 'center',
                                            borderWidth: 1, borderColor: theme.cardBorder,
                                            backgroundColor: theme.surface,
                                            ...Shadows.md,
                                        }}
                                    >
                                        {/* Date visual box */}
                                        <View style={{ width: 48, height: 52, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', marginRight: 14, backgroundColor: theme.surfaceSecondary }}>
                                            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: theme.text }}>{mDate.getDate()}</Text>
                                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: theme.textTertiary }}>{mDate.toLocaleString('default', { month: 'short' })}</Text>
                                        </View>

                                        {/* Task title, subject, priority & due date/urgency */}
                                        <View style={{ flex: 1, marginRight: 10 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                                                <Text style={{ ...Typography.bodyBold, color: theme.text, fontSize: 15 }} numberOfLines={1}>{m.title}</Text>
                                                <Badge label={prio} variant={badgeVariant as any} />
                                            </View>
                                            <Text style={{ ...Typography.caption, color: theme.textSecondary, marginBottom: 4 }} numberOfLines={1}>{m.subjectName}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Ionicons name="alarm-outline" size={12} color={timeColor} />
                                                <Text style={{ ...Typography.captionBold, color: timeColor, fontSize: 11 }}>
                                                    {daysText} • Due {mDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Quick Task Completion Toggle (DONE) */}
                                        <TouchableOpacity 
                                            onPress={() => {
                                                const nd = JSON.parse(JSON.stringify(data));
                                                const sem = nd.years.find((y:any) => y.id === activeYearId)?.semesters.find((s:any) => s.id === activeSemId);
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
                                                paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'center',
                                                borderRadius: Radius.md, borderWidth: 1, borderColor: theme.cardBorder,
                                                backgroundColor: theme.surfaceSecondary,
                                            }}
                                        >
                                            <Ionicons name="checkmark-circle-outline" size={14} color={theme.success} />
                                            <Text style={{ fontSize: 10, marginLeft: 4, fontFamily: 'Nunito_700Bold', color: theme.textSecondary }}>DONE</Text>
                                        </TouchableOpacity>
                                    </AnimatedPressable>
                                </FadeInItem>
                            );
                        });
                    })()}
                </View>

                {/* Upcoming Events (Calendar) */}
                <View style={{ paddingHorizontal: 24, marginBottom: 40 }}>
                    <SectionHeader title="Upcoming" onAction={() => router.push('/(tabs)/calendar')} actionIcon="add-circle" />
                    
                    {(() => {
                        let eventItems: any[] = [];
                        if (currentSem?.milestones) {
                            eventItems.push(...currentSem.milestones.map((m: any) => ({ ...m, priority: m.priority || 'medium' })));
                        }

                        const parseLocalDate = (dateStr: string) => {
                            if (typeof dateStr === 'string' && dateStr.includes('-') && !dateStr.includes('T')) {
                                const parts = dateStr.split('-');
                                if (parts.length === 3) return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
                            }
                            const d = new Date(dateStr);
                            return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                        };

                        const todayTime = new Date().setHours(0,0,0,0);

                        // Only show events happening today or in the future
                        const upcomingEvents = eventItems
                            .filter((m: any) => {
                                if (!m.date) return false;
                                const mTime = parseLocalDate(m.date);
                                return mTime >= todayTime;
                            })
                            .sort((a: any, b: any) => parseLocalDate(a.date) - parseLocalDate(b.date))
                            .slice(0, 3);

                        if (upcomingEvents.length === 0) {
                            return (
                                <FadeInItem index={5}>
                                    <View style={{
                                        padding: 20, borderRadius: Radius['2xl'], flexDirection: 'row', alignItems: 'center',
                                        borderWidth: 1, borderColor: theme.cardBorder,
                                        backgroundColor: theme.surface,
                                        ...Shadows.md,
                                    }}>
                                        <Image source={require('../../assets/images/studying.png')} style={{ width: 48, height: 48, marginRight: 14 }} resizeMode="contain" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ ...Typography.subtitle, fontSize: 16, color: theme.text }}>Clear Skies</Text>
                                            <Text style={{ ...Typography.caption, color: theme.textSecondary, marginTop: 2, lineHeight: 18 }}>No upcoming events. Smooth sailing ahead.</Text>
                                        </View>
                                    </View>
                                </FadeInItem>
                            );
                        }

                        return upcomingEvents.map((m: any, idx: number) => {
                            const mTime = parseLocalDate(m.date);
                            const mDate = new Date(m.date.includes('T') ? m.date : mTime);
                            const diffDays = Math.round((mTime - todayTime) / (1000 * 60 * 60 * 24));
                            const daysText = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : `In ${diffDays} days`;
                            const timeColor = diffDays === 0 ? theme.success : (diffDays <= 3 ? theme.warning : theme.textTertiary);
                            const prio = (m.priority || 'medium').toLowerCase();
                            const badgeVariant = prio === 'high' ? 'high' : (prio === 'medium' ? 'medium' : 'low');

                            return (
                                <FadeInItem key={idx} index={idx + 5} style={{ marginBottom: 12 }}>
                                    <AnimatedPressable 
                                        activeOpacity={0.9}
                                        onPress={() => router.push('/(tabs)/calendar')}
                                        style={{
                                            padding: 16, borderRadius: Radius['2xl'], flexDirection: 'row', alignItems: 'center',
                                            borderWidth: 1, borderColor: theme.cardBorder,
                                            backgroundColor: theme.surface,
                                            ...Shadows.md,
                                        }}
                                    >
                                        <View style={{ width: 48, height: 52, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', marginRight: 14, backgroundColor: theme.surfaceSecondary }}>
                                            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: theme.text }}>{mDate.getDate()}</Text>
                                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: theme.textTertiary }}>{mDate.toLocaleString('default', { month: 'short' })}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ ...Typography.bodyBold, color: theme.text }} numberOfLines={1}>{m.title}</Text>
                                            <Text style={{ ...Typography.captionBold, color: timeColor, marginTop: 2 }}>{daysText}</Text>
                                        </View>
                                        <Badge label={prio} variant={badgeVariant as any} />
                                    </AnimatedPressable>
                                </FadeInItem>
                            );
                        });
                    })()}
                </View>
                </>
                )}
                
                <View style={{ height: insets.bottom + 80 }} />
              </View>
            </ScrollView>

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
        </SafeAreaView>
    );
}
