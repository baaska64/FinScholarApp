import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabaseClient';
import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncService } from '@/services/SyncService';
import { AlertService } from '@/components/CustomAlert';
import { ChangelogService } from '@/components/ChangelogModal';
import { WidgetPreview } from 'react-native-android-widget';
import { WIDGET_GALLERY, renderWidgetPreview } from '../../widget/WidgetTaskHandler';
import { buildDemoSnapshot } from '../../widget/widgetData';
import { getTheme, Typography, Radius, Shadows } from '@/constants/Theme';
import { OnboardingService } from '@/services/OnboardingService';
import { ThemeService } from '@/services/ThemeService';
import { THEME_OPTIONS, ThemePreference } from '@/utils/themePreference';
import { useSpotlight } from '@/components/spotlight/SpotlightProvider';
import { ALL_TOUR_KEYS, MAIN_TOUR, TOUR_KEYS } from '@/constants/tours';
import { useTabBarHeight } from '@/components/CustomTabBar';
import Constants from 'expo-constants';

const APP_VERSION = Constants.expoConfig?.version ?? '';

/** A single settings row */
const SettingsRow = ({ icon, iconColor, label, onPress, chevron = true, isDark, theme }: any) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                onPress={onPress}
                onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start()}
                onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
                style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: 16, paddingHorizontal: 16,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{
                        width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc',
                    }}>
                        <Ionicons name={icon} size={20} color={iconColor} />
                    </View>
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 15, marginLeft: 14, color: theme.text, flex: 1 }}>{label}</Text>
                </View>
                {chevron && <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />}
            </TouchableOpacity>
        </Animated.View>
    );
};

/** Section header for grouped settings */
const SectionLabel = ({ title, theme }: { title: string; theme: any }) => (
    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: theme.textTertiary, marginBottom: 8, marginTop: 24, paddingHorizontal: 4 }}>
        {title}
    </Text>
);

export default function ProfileScreen() {
    const [email, setEmail] = useState('Loading...');
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const tabBarHeight = useTabBarHeight();
    const [showWidgetPreview, setShowWidgetPreview] = useState(false);
    const [widgetPage, setWidgetPage] = useState(0);
    // One snapshot for the whole gallery — the previews are illustrative, so they
    // show a full day rather than whatever this student happens to have booked.
    const demoSnapshot = useMemo(() => buildDemoSnapshot(), []);
    const galleryPageWidth = Math.round(Dimensions.get('window').width * 0.92);
    const [showThresholdSettings, setShowThresholdSettings] = useState(false);
    const [thresholds, setThresholds] = useState({ high: 21, medium: 10, low: 5 });
    const [data, setData] = useState<any>(null);
    const { startTour } = useSpotlight();

    const [themePref, setThemePref] = useState<ThemePreference>(ThemeService.get());
    useEffect(() => ThemeService.subscribe(setThemePref), []);

    const handleSetTheme = (preference: ThemePreference) => {
        // Wrap in setTimeout to avoid 'React state update on unmounted component' warnings
        // that NativeWind sometimes throws when switching the global theme
        setTimeout(() => {
            ThemeService.set(preference);
        }, 0);
    };

    // Entrance animation
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;
    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
        ]).start();
    }, []);

    useEffect(() => {
        AsyncStorage.getItem('grade_ledger_v2_data').then(str => {
            if (str) {
                const loaded = JSON.parse(str);
                setData(loaded);
                if (loaded.settings?.taskThresholds) {
                    setThresholds(loaded.settings.taskThresholds);
                }
            }
        });
    }, []);

    const handleSaveThresholds = () => {
        if (data) {
            const nd = { ...data };
            if (!nd.settings) nd.settings = {};
            nd.settings.taskThresholds = thresholds;
            AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(nd));
            setData(nd);
            SyncService.pushLocalChanges(nd);
        }
        setShowThresholdSettings(false);
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setEmail(session?.user?.email ?? 'Guest User');
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setEmail(session?.user?.email ?? 'Guest User');
        });
        return () => subscription.unsubscribe();
    }, []);

    async function handleLogout() {
        // Pushes are throttled; send the queued ledger while there is still a session.
        await SyncService.flushPendingPush();
        await AsyncStorage.removeItem('grade_ledger_v2_data');
        await AsyncStorage.removeItem('@last_synced_timestamp');
        await SyncService.setPremiumUser(false);
        const { error } = await supabase.auth.signOut();
        if (error) {
            AlertService.alert('Error', error.message);
        } else {
            router.replace('/login');
        }
    }

    const handleReplayIntro = async () => {
        await OnboardingService.reset();
        router.push({ pathname: '/onboarding', params: { replay: '1' } });
    };

    const handleGuidedTour = async () => {
        // Clear the per-screen nudges too, so the whole walkthrough replays.
        await OnboardingService.resetTours(ALL_TOUR_KEYS);
        router.navigate('/(tabs)');
        // Let the dashboard land before the spotlight starts measuring it.
        setTimeout(() => startTour(MAIN_TOUR, { key: TOUR_KEYS.main }), 400);
    };

    const handleRestoreChecklist = async () => {
        await OnboardingService.restoreChecklist();
        AlertService.alert(
            'Checklist restored',
            'The Getting Started checklist is back on your dashboard. It hides itself once every step is done.',
            [{ text: 'Got it' }]
        );
    };

    const isGuest = email === 'Guest User';
    const initials = isGuest ? '?' : email.charAt(0).toUpperCase();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }} showsVerticalScrollIndicator={false}>
              <View style={{ width: '100%', maxWidth: 800, alignSelf: 'center' }}>
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                    {/* Profile Header */}
                    <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 24 }}>
                        <View style={{
                            width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff',
                            borderWidth: 3, borderColor: theme.primary,
                        }}>
                            <Text style={{ fontSize: 32, fontFamily: 'Nunito_900Black', color: theme.primary }}>{initials}</Text>
                        </View>
                        <Text style={{ ...Typography.title, color: theme.text, marginTop: 14 }}>
                            {isGuest ? 'Guest Profile' : 'Student Profile'}
                        </Text>
                        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 14, color: theme.textSecondary, marginTop: 4 }}>{email}</Text>
                    </View>

                    {/* Settings Sections */}
                    <View style={{ paddingHorizontal: 20 }}>
                        {/* Appearance */}
                        <SectionLabel title="Appearance" theme={theme} />
                        <View style={{
                            backgroundColor: theme.card, borderRadius: 20, borderWidth: 1, borderColor: theme.cardBorder,
                            overflow: 'hidden',
                            ...(!isDark ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 } : {}),
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 }}>
                                <View style={{
                                    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc',
                                }}>
                                    <Ionicons
                                        name={themePref === 'system' ? 'phone-portrait-outline' : isDark ? 'moon' : 'sunny'}
                                        size={20}
                                        color={isDark ? '#818cf8' : '#f59e0b'}
                                    />
                                </View>
                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 15, marginLeft: 14, color: theme.text, flex: 1 }}>Theme</Text>
                                <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: theme.surfaceSecondary }}>
                                    {THEME_OPTIONS.map((option) => {
                                        const active = themePref === option.value;
                                        return (
                                            <TouchableOpacity
                                                key={option.value}
                                                onPress={() => handleSetTheme(option.value)}
                                                activeOpacity={0.7}
                                                accessibilityRole="radio"
                                                accessibilityState={{ selected: active }}
                                                accessibilityLabel={option.value === 'system' ? 'Match device theme' : `${option.label} theme`}
                                                style={{
                                                    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9,
                                                    borderWidth: 1,
                                                    borderColor: active ? theme.cardBorder : 'transparent',
                                                    // In the dark the raised segment has to be lighter than
                                                    // its track, not the surface colour, which is darker.
                                                    backgroundColor: active ? (isDark ? '#2b3342' : '#ffffff') : 'transparent',
                                                }}
                                            >
                                                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12.5, color: active ? theme.text : theme.textTertiary }}>
                                                    {option.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                            <View style={{ height: 1, backgroundColor: theme.cardBorder, marginHorizontal: 16 }} />
                            <SettingsRow
                                icon="apps"
                                iconColor={isDark ? '#f472b6' : '#ec4899'}
                                label="Home Screen Widgets"
                                onPress={() => setShowWidgetPreview(true)}
                                isDark={isDark}
                                theme={theme}
                            />
                        </View>

                        {/* Academic */}
                        <SectionLabel title="Academic" theme={theme} />
                        <View style={{
                            backgroundColor: theme.card, borderRadius: 20, borderWidth: 1, borderColor: theme.cardBorder,
                            overflow: 'hidden',
                            ...(!isDark ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 } : {}),
                        }}>
                            <SettingsRow
                                icon="folder-open"
                                iconColor={isDark ? '#38bdf8' : '#0284c7'}
                                label="Manage Academic Terms"
                                onPress={() => router.push('/(tabs)/academic-manager')}
                                isDark={isDark}
                                theme={theme}
                            />
                            <View style={{ height: 1, backgroundColor: theme.cardBorder, marginHorizontal: 16 }} />
                            <SettingsRow
                                icon="layers-outline"
                                iconColor={isDark ? '#f472b6' : '#ec4899'}
                                label="Study Options"
                                onPress={() => router.push('/study-options')}
                                isDark={isDark}
                                theme={theme}
                            />
                            <View style={{ height: 1, backgroundColor: theme.cardBorder, marginHorizontal: 16 }} />
                            <SettingsRow
                                icon="options"
                                iconColor={isDark ? '#a78bfa' : '#8b5cf6'}
                                label="Dashboard Priority Settings"
                                onPress={() => setShowThresholdSettings(true)}
                                isDark={isDark}
                                theme={theme}
                            />
                        </View>

                        {/* Help */}
                        <SectionLabel title="Help" theme={theme} />
                        <View style={{
                            backgroundColor: theme.card, borderRadius: 20, borderWidth: 1, borderColor: theme.cardBorder,
                            overflow: 'hidden',
                            ...(!isDark ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 } : {}),
                        }}>
                            <SettingsRow
                                icon="navigate"
                                iconColor={isDark ? '#818cf8' : '#4f46e5'}
                                label="Take the Guided Tour"
                                onPress={handleGuidedTour}
                                isDark={isDark}
                                theme={theme}
                            />
                            <View style={{ height: 1, backgroundColor: theme.cardBorder, marginHorizontal: 16 }} />
                            <SettingsRow
                                icon="sparkles"
                                iconColor={isDark ? '#38bdf8' : '#0284c7'}
                                label="Replay Intro Slides"
                                onPress={handleReplayIntro}
                                isDark={isDark}
                                theme={theme}
                            />
                            <View style={{ height: 1, backgroundColor: theme.cardBorder, marginHorizontal: 16 }} />
                            <SettingsRow
                                icon="rocket-outline"
                                iconColor={isDark ? '#34d399' : '#10b981'}
                                label="Show Getting Started Checklist"
                                onPress={handleRestoreChecklist}
                                isDark={isDark}
                                theme={theme}
                            />
                            <View style={{ height: 1, backgroundColor: theme.cardBorder, marginHorizontal: 16 }} />
                            <SettingsRow
                                icon="gift-outline"
                                iconColor={isDark ? '#f472b6' : '#db2777'}
                                label={APP_VERSION ? `What's New in v${APP_VERSION}` : "What's New"}
                                onPress={() => ChangelogService.open()}
                                isDark={isDark}
                                theme={theme}
                            />
                        </View>

                        {/* Account */}
                        <SectionLabel title="Account" theme={theme} />
                        {isGuest ? (
                            <View style={{
                                backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : '#eef2ff',
                                borderRadius: 20, borderWidth: 1,
                                borderColor: isDark ? 'rgba(99,102,241,0.2)' : '#c7d2fe',
                                padding: 20,
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                                    <View style={{
                                        width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                                        backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : '#e0e7ff', marginRight: 12,
                                    }}>
                                        <Ionicons name="school" size={22} color={theme.primary} />
                                    </View>
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: theme.text, flex: 1, lineHeight: 18 }}>
                                        Sign in to sync your progress across devices!
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => router.replace('/login')}
                                    style={{
                                        backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 16,
                                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                        ...(!isDark ? { shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 } : {}),
                                    }}
                                >
                                    <Ionicons name="log-in-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 16, color: '#fff' }}>Sign In / Register</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{
                                backgroundColor: theme.card, borderRadius: 20, borderWidth: 1, borderColor: theme.cardBorder,
                                overflow: 'hidden',
                                ...(!isDark ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 } : {}),
                            }}>
                                <TouchableOpacity
                                    onPress={handleLogout}
                                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 }}
                                >
                                    <Ionicons name="log-out-outline" size={18} color={theme.error} style={{ marginRight: 8 }} />
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 15, color: theme.error }}>Log Out</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </Animated.View>
              </View>
            </ScrollView>

            {/* Threshold Settings Modal */}
            <Modal visible={showThresholdSettings} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{
                        backgroundColor: theme.card, padding: 28, borderRadius: 28, width: '88%',
                        borderWidth: 1, borderColor: theme.cardBorder,
                    }}>
                        <Text style={{ ...Typography.heading, color: theme.text, textAlign: 'center' }}>Task Priority Display</Text>
                        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 13, color: theme.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 24 }}>
                            Set how many days in advance a task appears on your dashboard based on its priority.
                        </Text>

                        {([
                            { key: 'high' as const, label: 'High Priority', color: '#ef4444' },
                            { key: 'medium' as const, label: 'Medium Priority', color: '#f97316' },
                            { key: 'low' as const, label: 'Low Priority', color: '#22c55e' },
                        ]).map(({ key, label, color }) => (
                            <View key={key} style={{ marginBottom: 16 }}>
                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color, marginBottom: 6 }}>{label}</Text>
                                <View style={{
                                    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14,
                                    paddingHorizontal: 14, paddingVertical: 12,
                                    borderColor: theme.cardBorder, backgroundColor: isDark ? theme.surfaceSecondary : '#f8fafc',
                                }}>
                                    <Ionicons name="time-outline" size={18} color={theme.textTertiary} />
                                    <TextInput
                                        value={String(thresholds[key])}
                                        onChangeText={t => setThresholds({ ...thresholds, [key]: parseInt(t) || 0 })}
                                        keyboardType="numeric"
                                        style={{ flex: 1, marginLeft: 10, fontFamily: 'Nunito_700Bold', fontSize: 16, color: theme.text }}
                                    />
                                    <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 13, color: theme.textSecondary }}>days</Text>
                                </View>
                            </View>
                        ))}

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                            <TouchableOpacity
                                onPress={() => setShowThresholdSettings(false)}
                                style={{ flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' }}
                            >
                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 15, color: theme.text }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSaveThresholds}
                                style={{ flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', backgroundColor: '#8b5cf6' }}
                            >
                                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff' }}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Widget gallery — one page per widget, previewed at the size a
                home-screen cell actually gives it. */}
            <Modal
                visible={showWidgetPreview}
                transparent
                animationType="fade"
                onRequestClose={() => setShowWidgetPreview(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{
                        backgroundColor: theme.card, paddingVertical: 24, borderRadius: 28, width: '92%',
                        borderWidth: 1, borderColor: theme.cardBorder,
                    }}>
                        <Text style={{ ...Typography.heading, color: theme.text, textAlign: 'center' }}>Home Screen Widgets</Text>
                        <Text style={{
                            fontFamily: 'Nunito_400Regular', fontSize: 13, color: theme.textSecondary,
                            textAlign: 'center', marginTop: 8, paddingHorizontal: 24,
                        }}>
                            Swipe to browse. Each one updates itself as your day moves along.
                        </Text>

                        <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={(e) =>
                                setWidgetPage(Math.round(e.nativeEvent.contentOffset.x / galleryPageWidth))
                            }
                            style={{ marginTop: 20 }}
                        >
                            {WIDGET_GALLERY.map((item) => (
                                <View key={item.name} style={{ width: galleryPageWidth, alignItems: 'center', paddingHorizontal: 20 }}>
                                    <WidgetPreview
                                        renderWidget={(info) => renderWidgetPreview(item.name, demoSnapshot, info, isDark)}
                                        width={item.previewWidth}
                                        height={item.previewHeight}
                                    />
                                    <Text style={{
                                        fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: theme.text, marginTop: 18,
                                    }}>
                                        {item.title}
                                    </Text>
                                    <Text style={{
                                        fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: theme.textSecondary,
                                        textAlign: 'center', marginTop: 4,
                                    }}>
                                        {item.description}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 18 }}>
                            {WIDGET_GALLERY.map((item, idx) => (
                                <View
                                    key={item.name}
                                    style={{
                                        width: idx === widgetPage ? 18 : 6, height: 6, borderRadius: 3, marginHorizontal: 3,
                                        backgroundColor: idx === widgetPage ? theme.primary : theme.cardBorder,
                                    }}
                                />
                            ))}
                        </View>

                        <View style={{
                            marginTop: 20, marginHorizontal: 20, backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
                            padding: 14, borderRadius: 16,
                        }}>
                            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: theme.text, textAlign: 'center' }}>
                                💡 Long-press an empty spot on your home screen, tap "Widgets", then look for FinScholar.
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => setShowWidgetPreview(false)}
                            style={{
                                marginTop: 20, marginHorizontal: 20, backgroundColor: theme.primary,
                                paddingVertical: 13, borderRadius: 16, alignItems: 'center',
                            }}
                        >
                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff' }}>Got it!</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
