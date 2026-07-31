import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, Animated, Platform, Dimensions } from 'react-native';
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

const SCREEN_WIDTH = Dimensions.get('window').width;

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
    
    const [user, setUser] = useState<any>(null);
    const [data, setData] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showPaywall, setShowPaywall] = useState(false);
    const [showDevMenu, setShowDevMenu] = useState(false);
    const [isPremium, setIsPremium] = useState(false);
    
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
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });
        
        const unsubscribeSync = SyncService.subscribeDataChange(() => {
            setIsPremium(SyncService.getIsPremium());
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

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            {/* Top App Bar */}
            <View 
                style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingHorizontal: 24, paddingVertical: 16, zIndex: 10,
                    borderBottomWidth: 1, borderBottomColor: isDark ? theme.cardBorder : '#f1f5f9',
                    backgroundColor: isDark ? theme.surface : theme.surface,
                    ...(!isDark ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4 } : {}),
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ ...Typography.title, color: theme.text }}>FinScholar</Text>
                    {isPremium ? (
                        <View style={{ backgroundColor: '#10b981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>PRO</Text>
                        </View>
                    ) : (
                        <TouchableOpacity 
                            onPress={() => setShowPaywall(true)}
                            style={{ backgroundColor: '#6366f1', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                        >
                            <Ionicons name="diamond" size={10} color="#fff" />
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>GET PRO</Text>
                        </TouchableOpacity>
                    )}
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {syncStatus === 'syncing' && <Ionicons name="cloud-upload" size={22} color={theme.textTertiary} />}
                    {syncStatus === 'saved' && <Ionicons name="cloud-done" size={22} color={theme.success} />}
                    {(syncStatus === 'error' || syncStatus === 'offline') && <Ionicons name="cloud-offline" size={22} color={theme.textTertiary} />}
                    
                    <TouchableOpacity 
                        onPress={() => router.push('/(tabs)/profile')} 
                        style={{
                            width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9'
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
                <View style={{ height: 24 }} />

                {data.years.length === 0 ? (
                    <View style={{ marginHorizontal: 24, marginTop: 40, padding: 32, borderRadius: Radius['4xl'], alignItems: 'center', borderWidth: 2, borderColor: isDark ? theme.cardBorder : '#f1f5f9', backgroundColor: theme.surface, ...Shadows.lg }}>
                        <Ionicons name="school-outline" size={56} color={theme.textTertiary} style={{ marginBottom: 20 }} />
                        <Text style={{ ...Typography.title, color: theme.text, textAlign: 'center', marginBottom: 12 }}>Welcome to FinScholar!</Text>
                        <Text style={{ ...Typography.body, color: theme.textSecondary, textAlign: 'center', marginBottom: 32 }}>
                            You haven't set up any academic terms yet. Let's create your first Year and Semester to start tracking!
                        </Text>
                        <AnimatedPressable 
                            onPress={() => router.push('/(tabs)/academic-manager')}
                            style={{
                                backgroundColor: theme.primary, paddingVertical: 16, paddingHorizontal: 32,
                                borderRadius: Radius.full, flexDirection: 'row', alignItems: 'center',
                                ...Platform.select({ ios: { shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 }, android: { elevation: 6 } }),
                            }}
                        >
                            <Ionicons name="options-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={{ color: '#ffffff', fontFamily: 'Nunito_700Bold', fontSize: 18 }}>Manage Academic Terms</Text>
                        </AnimatedPressable>
                    </View>
                ) : (
                    <>
                {/* Year/Term Selector */}
                <View style={{ marginBottom: 24, paddingHorizontal: 24 }}>
                    <Tabs 
                        years={data.years} 
                        activeYearId={activeYearId} 
                        activeSemId={activeSemId}
                        onSelectYear={id => {
                            setActiveYearId(id);
                            AsyncStorage.setItem('dashboard_active_year', id);
                            const yr = data.years.find((y: any) => y.id === id);
                            if (yr && yr.semesters.length > 0) {
                                setActiveSemId(yr.semesters[0].id);
                                AsyncStorage.setItem('dashboard_active_sem', yr.semesters[0].id);
                            } else {
                                setActiveSemId(null);
                                AsyncStorage.removeItem('dashboard_active_sem');
                            }
                        }}
                        onSelectSem={id => {
                            setActiveSemId(id);
                            AsyncStorage.setItem('dashboard_active_sem', id);
                        }}
                    />
                </View>

                {/* Fin's Daily Quote */}
                <FadeInItem index={0}>
                    <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
                        <View style={{
                            padding: 18, borderRadius: Radius['3xl'], position: 'relative',
                            borderWidth: 1, borderColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff',
                            backgroundColor: isDark ? 'rgba(30,41,59,0.8)' : '#eef2ff',
                        }}>
                            <Text style={{ ...Typography.label, textTransform: 'uppercase', letterSpacing: 1.2, color: isDark ? '#818cf8' : '#4f46e5', marginBottom: 6 }}>Fin says:</Text>
                            <Text style={{ ...Typography.body, fontStyle: 'italic', color: isDark ? '#e2e8f0' : '#374151' }}>"{quote}"</Text>
                        </View>
                    </View>
                </FadeInItem>

                {/* Mascot Stats Card */}
                <FadeInItem index={1}>
                    <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
                        <View style={{
                            borderRadius: Radius['4xl'], width: '100%',
                            backgroundColor: isDark ? '#0f766e' : '#34d399',
                            ...Platform.select({ ios: { shadowColor: '#34d399', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 }, android: { elevation: 8 } }),
                        }}>
                            <View style={{
                                borderRadius: Radius['4xl'], width: '100%', flexDirection: 'row',
                                alignItems: 'center', justifyContent: 'space-between',
                                overflow: 'hidden',
                            }}>
                                {/* Left: Year GWA */}
                                <View style={{ paddingLeft: 16, paddingVertical: 24, zIndex: 10 }}>
                                    <View style={{ backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.xl, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                                        <Text style={{ fontFamily: 'Nunito_700Bold', color: 'rgba(255,255,255,0.9)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2, textAlign: 'center' }}>Year GWA</Text>
                                        <Text style={{ fontFamily: 'Nunito_900Black', color: '#ffffff', fontSize: 22, textAlign: 'center' }}>
                                            {system === 'PERCENT' ? (yrRes.percent > 0 ? yrRes.percent.toFixed(2) : '--') : (yrRes.equivalent > 0 ? yrRes.equivalent.toFixed(2) : '--')}
                                        </Text>
                                    </View>
                                </View>

                                {/* Center: Mascot */}
                                <View style={{ flex: 1, height: Math.max(105, SCREEN_WIDTH * 0.28), overflow: 'hidden', zIndex: 0 }}>
                                    <Image 
                                        source={require('../../assets/images/FinDashboard.png')} 
                                        style={{ 
                                            position: 'absolute',
                                            width: SCREEN_WIDTH * 0.48, 
                                            height: SCREEN_WIDTH * 0.48,
                                            left: '50%',
                                            marginLeft: -(SCREEN_WIDTH * 0.24), // Center horizontally
                                            top: -(SCREEN_WIDTH * 0.035), // Shift up to show books and crop 5px below them
                                        }}
                                        resizeMode="contain" 
                                    />
                                </View>

                                {/* Right: Semester GWA */}
                                <View style={{ paddingRight: 16, paddingVertical: 24, zIndex: 10 }}>
                                    <View style={{ backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.xl, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                                        <Text style={{ fontFamily: 'Nunito_700Bold', color: 'rgba(255,255,255,0.9)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2, textAlign: 'center' }}>Sem GWA</Text>
                                        <Text style={{ fontFamily: 'Nunito_900Black', color: '#ffffff', fontSize: 22, textAlign: 'center' }}>
                                            {system === 'PERCENT' ? (semRes.percent > 0 ? semRes.percent.toFixed(2) : '--') : (semRes.equivalent > 0 ? semRes.equivalent.toFixed(2) : '--')}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
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
                                <FadeInItem index={2}>
                                    <View style={{
                                        padding: 24, borderRadius: Radius['3xl'], flexDirection: 'row', alignItems: 'center',
                                        borderWidth: 2, borderColor: isDark ? 'rgba(100,116,139,0.2)' : '#e2e8f0',
                                        backgroundColor: isDark ? 'rgba(30,41,59,0.8)' : '#f8fafc',
                                        ...Shadows.md,
                                    }}>
                                        <View style={{ borderRadius: 999, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginRight: 16, backgroundColor: isDark ? 'rgba(100,116,139,0.2)' : '#f1f5f9', borderWidth: 1, borderColor: isDark ? 'rgba(100,116,139,0.3)' : '#e2e8f0' }}>
                                            <Ionicons name="checkmark-done-circle" size={28} color={isDark ? '#94a3b8' : '#64748b'} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ ...Typography.subtitle, color: isDark ? '#e2e8f0' : '#334155' }}>Semester Ended</Text>
                                            <Text style={{ ...Typography.caption, color: isDark ? '#94a3b8' : '#64748b', marginTop: 4, lineHeight: 18 }}>
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
                                <FadeInItem index={2}>
                                    <View style={{
                                        padding: 24, borderRadius: Radius['3xl'], flexDirection: 'row', alignItems: 'center',
                                        borderWidth: 2, borderColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff',
                                        backgroundColor: isDark ? 'rgba(30,41,59,0.8)' : '#eef2ff',
                                        ...Shadows.md,
                                    }}>
                                        <View style={{ borderRadius: 999, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginRight: 16, backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff', borderWidth: 1, borderColor: isDark ? 'rgba(99,102,241,0.3)' : '#c7d2fe' }}>
                                            <Ionicons name="hourglass-outline" size={28} color={isDark ? '#818cf8' : '#6366f1'} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ ...Typography.subtitle, color: isDark ? '#e2e8f0' : '#312e81' }}>Starts in {daysUntil} day{daysUntil > 1 ? 's' : ''}</Text>
                                            <Text style={{ ...Typography.caption, color: isDark ? '#94a3b8' : 'rgba(49,46,129,0.7)', marginTop: 4, lineHeight: 18 }}>
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
                                <FadeInItem index={2}>
                                    <View style={{
                                        padding: 24, borderRadius: Radius['3xl'], flexDirection: 'row', alignItems: 'center',
                                        borderWidth: 2, borderColor: isDark ? 'rgba(245,158,11,0.2)' : '#fef3c7',
                                        backgroundColor: isDark ? 'rgba(30,41,59,0.8)' : '#fffbeb',
                                        ...Shadows.md,
                                    }}>
                                        <View style={{ borderRadius: 999, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginRight: 16, backgroundColor: isDark ? 'rgba(120,53,15,0.5)' : '#fef3c7', borderWidth: 1, borderColor: isDark ? 'rgba(245,158,11,0.3)' : '#fde68a' }}>
                                            <Ionicons name="game-controller" size={28} color={isDark ? '#fbbf24' : '#d97706'} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ ...Typography.subtitle, color: isDark ? '#e2e8f0' : '#92400e' }}>Free Time</Text>
                                            <Text style={{ ...Typography.caption, color: isDark ? '#94a3b8' : 'rgba(146,64,14,0.7)', marginTop: 4, lineHeight: 18 }}>No classes today. Go touch grass or play games!</Text>
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
                            
                            let timeString = '';
                            if (waitHours > 0) {
                                const h = Math.floor(waitHours);
                                const m = Math.round((waitHours - h) * 60);
                                timeString = `Starts in ${h > 0 ? `${h}h ` : ''}${m}m`;
                            } else if (waitHours > -(cls.duration || 1)) {
                                timeString = `Ongoing`;
                            } else {
                                timeString = `Ended`;
                            }

                            return (
                                <FadeInItem key={idx} index={idx + 2} style={{ marginBottom: 12 }}>
                                    <AnimatedPressable 
                                        activeOpacity={1}
                                        onPress={() => router.push({ pathname: '/(tabs)/schedule', params: { viewMode: 'attendance', targetDate: todayStr, trigger: Date.now() } })}
                                        style={{
                                            padding: 20, borderRadius: Radius['3xl'], flexDirection: 'row', alignItems: 'center',
                                            borderWidth: 1, borderColor: isDark ? theme.cardBorder : '#f1f5f9',
                                            backgroundColor: theme.surface,
                                            ...Shadows.md,
                                        }}
                                    >
                                        <View style={{ width: 5, height: 44, borderRadius: 3, marginRight: 16, backgroundColor: cls.colorIdx !== undefined ? ['#ff453a', '#30d158', '#0a84ff', '#ff9f0a', '#bf5af2', '#64d2ff'][cls.colorIdx % 6] : '#3b82f6' }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ ...Typography.subtitle, color: theme.text }}>{cls.name}</Text>
                                            <Text style={{ ...Typography.caption, color: theme.textTertiary, marginTop: 2 }}>{formatTime(cls.startHour)} • {timeString}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', borderRadius: 10, borderWidth: 1, overflow: 'hidden', borderColor: isDark ? theme.cardBorder : '#e2e8f0', marginLeft: 8 }}>
                                            {['present', 'absent', 'cancelled'].map((statusOption) => {
                                                const key = `${todayStr}_${cls.id}`;
                                                const current = currentSem?.attendanceLog?.[key];
                                                let currentStatus = null;
                                                if (current) {
                                                    if (typeof current === 'boolean') currentStatus = current ? 'present' : null;
                                                    else currentStatus = current.status;
                                                }
                                                const isActive = currentStatus === statusOption;
                                                
                                                const iconName = statusOption === 'present' ? 'checkmark-circle' : (statusOption === 'absent' ? 'close-circle' : 'remove-circle-outline');
                                                const label = statusOption === 'present' ? 'P' : (statusOption === 'absent' ? 'A' : 'NC');
                                                const activeBg = statusOption === 'present' ? '#22c55e' : (statusOption === 'absent' ? '#ef4444' : '#64748b');

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
                                                                import('@/services/SyncService').then(({ SyncService }) => SyncService.pushLocalChanges(nd));
                                                            }
                                                        }}
                                                        style={{
                                                            paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center',
                                                            borderRightWidth: statusOption !== 'cancelled' ? 1 : 0,
                                                            borderRightColor: isDark ? theme.cardBorder : '#e2e8f0',
                                                            backgroundColor: isActive ? activeBg : 'transparent',
                                                        }}
                                                    >
                                                        <Ionicons name={iconName} size={16} color={isActive ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b')} />
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
                                <FadeInItem index={3}>
                                    <View style={{
                                        padding: 24, borderRadius: Radius['3xl'], flexDirection: 'row', alignItems: 'center',
                                        borderWidth: 2, borderColor: isDark ? 'rgba(34,197,94,0.2)' : '#dcfce7',
                                        backgroundColor: isDark ? 'rgba(30,41,59,0.8)' : '#f0fdf4',
                                        ...Shadows.md,
                                    }}>
                                        <Image source={require('../../assets/images/studying.png')} style={{ width: 56, height: 56, marginRight: 16 }} resizeMode="contain" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ ...Typography.subtitle, color: isDark ? '#e2e8f0' : '#166534' }}>All Clear!</Text>
                                            <Text style={{ ...Typography.caption, color: isDark ? '#94a3b8' : 'rgba(22,101,52,0.7)', marginTop: 4, lineHeight: 18 }}>No pending tasks. You're all caught up.</Text>
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
                                <FadeInItem key={idx} index={idx + 3} style={{ marginBottom: 12 }}>
                                    <AnimatedPressable 
                                        activeOpacity={1}
                                        onPress={() => router.push({ pathname: '/(tabs)/requirements', params: { subjectId: m.subjectId } })}
                                        style={{
                                            padding: 20, borderRadius: Radius['3xl'], flexDirection: 'row', alignItems: 'center',
                                            borderWidth: 1, borderColor: isDark ? theme.cardBorder : '#f1f5f9',
                                            backgroundColor: theme.surface,
                                            ...Shadows.md,
                                        }}
                                    >
                                        <View style={{ width: 48, height: 56, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', marginRight: 16, backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' }}>
                                            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 20, color: theme.text }}>{mDate.getDate()}</Text>
                                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: theme.textTertiary }}>{mDate.toLocaleString('default', { month: 'short' })}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ ...Typography.bodyBold, color: theme.text }} numberOfLines={1}>{m.title}</Text>
                                            <Text style={{ ...Typography.caption, color: theme.textTertiary, marginTop: 1 }} numberOfLines={1}>{m.subjectName}</Text>
                                            <Text style={{ ...Typography.captionBold, color: timeColor, marginTop: 2 }}>{daysText}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Badge label={prio} variant={badgeVariant as any} />
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
                                                                import('@/services/SyncService').then(({ SyncService }) => SyncService.pushLocalChanges(nd));
                                                            }
                                                        }
                                                    }
                                                }}
                                                style={{
                                                    paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', alignItems: 'center',
                                                    borderRadius: 6, borderWidth: 1, borderColor: isDark ? theme.cardBorder : '#e2e8f0',
                                                    backgroundColor: isDark ? theme.surfaceSecondary : '#ffffff',
                                                }}
                                            >
                                                <Ionicons name="checkmark-circle-outline" size={13} color={isDark ? '#cbd5e1' : '#64748b'} />
                                                <Text style={{ fontSize: 10, marginLeft: 3, fontFamily: 'Nunito_700Bold', color: isDark ? '#cbd5e1' : '#475569' }}>DONE</Text>
                                            </TouchableOpacity>
                                        </View>
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
                                <FadeInItem index={4}>
                                    <View style={{
                                        padding: 24, borderRadius: Radius['3xl'], flexDirection: 'row', alignItems: 'center',
                                        borderWidth: 2, borderColor: isDark ? 'rgba(14,165,233,0.2)' : '#e0f2fe',
                                        backgroundColor: isDark ? 'rgba(30,41,59,0.8)' : '#f0f9ff',
                                        ...Shadows.md,
                                    }}>
                                        <Image source={require('../../assets/images/studying.png')} style={{ width: 56, height: 56, marginRight: 16 }} resizeMode="contain" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ ...Typography.subtitle, color: isDark ? '#e2e8f0' : '#0c4a6e' }}>Clear Skies</Text>
                                            <Text style={{ ...Typography.caption, color: isDark ? '#94a3b8' : 'rgba(12,74,110,0.7)', marginTop: 4, lineHeight: 18 }}>No upcoming events. Smooth sailing ahead.</Text>
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
                                <FadeInItem key={idx} index={idx + 4} style={{ marginBottom: 12 }}>
                                    <AnimatedPressable 
                                        activeOpacity={1}
                                        onPress={() => router.push('/(tabs)/calendar')}
                                        style={{
                                            padding: 20, borderRadius: Radius['3xl'], flexDirection: 'row', alignItems: 'center',
                                            borderWidth: 1, borderColor: isDark ? theme.cardBorder : '#f1f5f9',
                                            backgroundColor: theme.surface,
                                            ...Shadows.md,
                                        }}
                                    >
                                        <View style={{ width: 48, height: 56, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', marginRight: 16, backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' }}>
                                            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 20, color: theme.text }}>{mDate.getDate()}</Text>
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
            </ScrollView>

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
        </SafeAreaView>
    );
}
