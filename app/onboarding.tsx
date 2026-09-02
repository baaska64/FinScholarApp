import React, { useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    Image,
    ScrollView,
    TouchableOpacity,
    Animated,
    useWindowDimensions,
    Platform,
    ActivityIndicator,
    ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { router, useLocalSearchParams } from 'expo-router';
import { getTheme, Typography, Radius, Shadows } from '@/constants/Theme';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import { OnboardingService } from '@/services/OnboardingService';
import { NotificationService } from '@/services/NotificationService';
import { triggerHaptic } from '@/components/tasks/utils';

interface Highlight {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    title: string;
    desc: string;
}

interface Slide {
    key: string;
    image: ImageSourcePropType;
    imageScale: number;
    eyebrow: string;
    title: string;
    subtitle: string;
    highlights?: Highlight[];
    kind?: 'notifications';
}

const SLIDES: Slide[] = [
    {
        key: 'welcome',
        image: require('../assets/images/finanimated_opt.gif'),
        imageScale: 1.5,
        eyebrow: 'Welcome',
        title: 'Hi, I am Fin!',
        subtitle:
            'I will help you keep your grades, classes and deadlines in one calm little place — no spreadsheets required.',
    },
    {
        key: 'features',
        image: require('../assets/images/studying.png'),
        imageScale: 1,
        eyebrow: 'What you get',
        title: 'Your whole semester,\none app',
        subtitle: 'Everything below shares the same subjects, so you only type things once.',
        highlights: [
            { icon: 'school', color: '#4f46e5', title: 'Grades & GWA', desc: 'Track scores and see your GWA update live.' },
            { icon: 'time', color: '#0ea5e9', title: 'Class schedule', desc: 'Scan a printed timetable or add classes by hand.' },
            { icon: 'list', color: '#f59e0b', title: 'Tasks & exams', desc: 'Deadlines sorted by what is actually urgent.' },
            { icon: 'layers', color: '#ec4899', title: 'Flashcards', desc: 'Study decks with streaks and spaced repetition.' },
        ],
    },
    {
        key: 'reminders',
        image: require('../assets/images/happy.png'),
        imageScale: 1,
        eyebrow: 'Stay on time',
        title: 'A nudge before\nit matters',
        subtitle:
            'Fin can remind you about your next class and your study session. You can change this any time in your phone settings.',
        kind: 'notifications',
    },
    {
        key: 'privacy',
        image: require('../assets/images/FinLogo.png'),
        imageScale: 1,
        eyebrow: 'Yours to keep',
        title: 'Works offline,\nsyncs if you want',
        subtitle:
            'Everything is saved on your phone first. Signing in is optional — it only adds cloud backup so you can pick up on another device.',
        highlights: [
            { icon: 'phone-portrait', color: '#10b981', title: 'Local first', desc: 'Use the whole app without an account.' },
            { icon: 'cloud-done', color: '#0ea5e9', title: 'Optional sync', desc: 'Sign in later and your data comes with you.' },
        ],
    },
];

export default function OnboardingScreen() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const theme = getTheme(isDark);
    const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
    // Replaying from Settings should drop the user back where they came from,
    // not into the sign-in screen.
    const { replay } = useLocalSearchParams<{ replay?: string }>();
    const isReplay = replay === '1';

    const scrollRef = useRef<ScrollView>(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const [index, setIndex] = useState(0);
    const [askingNotifications, setAskingNotifications] = useState(false);
    const [notifChoice, setNotifChoice] = useState<'granted' | 'denied' | 'skipped' | null>(null);

    const isLast = index === SLIDES.length - 1;
    const slide = SLIDES[index];

    const finish = useCallback(async () => {
        triggerHaptic('success');
        await OnboardingService.complete();
        if (isReplay && router.canGoBack()) {
            router.back();
        } else {
            router.replace('/welcome');
        }
    }, [isReplay]);

    const goTo = useCallback(
        (next: number) => {
            const clamped = Math.max(0, Math.min(SLIDES.length - 1, next));
            scrollRef.current?.scrollTo({ x: clamped * SCREEN_W, animated: true });
            setIndex(clamped);
        },
        [SCREEN_W]
    );

    const handleNext = useCallback(() => {
        triggerHaptic('light');
        if (isLast) {
            finish();
        } else {
            goTo(index + 1);
        }
    }, [isLast, index, goTo, finish]);

    const handleEnableNotifications = useCallback(async () => {
        triggerHaptic('light');
        setAskingNotifications(true);
        let granted = false;
        try {
            granted = await NotificationService.initNotifications();
        } catch {
            granted = false;
        }
        setAskingNotifications(false);
        const choice = granted ? 'granted' : 'denied';
        setNotifChoice(choice);
        await OnboardingService.setNotificationChoice(choice);
        goTo(index + 1);
    }, [index, goTo]);

    const handleSkipNotifications = useCallback(async () => {
        triggerHaptic('light');
        setNotifChoice('skipped');
        await OnboardingService.setNotificationChoice('skipped');
        // Create the channel anyway so reminders work instantly if they allow it later.
        NotificationService.ensureAndroidChannel();
        goTo(index + 1);
    }, [index, goTo]);

    // Artwork shrinks on short screens so the copy always fits without scrolling.
    const artSize = Math.min(SCREEN_W * 0.55, SCREEN_H * 0.26);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'bottom']}>
            {/* Skip */}
            <View style={{ height: 44, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 20 }}>
                {!isLast && (
                    <TouchableOpacity
                        onPress={finish}
                        hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
                        accessibilityRole="button"
                        accessibilityLabel="Skip the introduction"
                    >
                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: theme.textTertiary }}>Skip</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Slides */}
            <Animated.ScrollView
                ref={scrollRef as any}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(e) => {
                    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                    if (next !== index) setIndex(next);
                }}
                style={{ flex: 1 }}
            >
                {SLIDES.map((s, i) => (
                    <SlideView
                        key={s.key}
                        slide={s}
                        width={SCREEN_W}
                        artSize={artSize}
                        theme={theme}
                        isDark={isDark}
                        scrollX={scrollX}
                        index={i}
                    />
                ))}
            </Animated.ScrollView>

            {/* Controls */}
            <View style={{ paddingHorizontal: 28, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 8 : 20 }}>
                {/* Page dots */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 22 }}>
                    {SLIDES.map((s, i) => {
                        const active = i === index;
                        return (
                            <TouchableOpacity
                                key={s.key}
                                onPress={() => goTo(i)}
                                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                                accessibilityRole="button"
                                accessibilityLabel={`Go to step ${i + 1} of ${SLIDES.length}`}
                            >
                                <View
                                    style={{
                                        width: active ? 24 : 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: active ? theme.primary : theme.cardBorder,
                                    }}
                                />
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {slide.kind === 'notifications' && notifChoice === null ? (
                    <>
                        <AnimatedPressable
                            onPress={handleEnableNotifications}
                            disabled={askingNotifications}
                            accessibilityRole="button"
                            style={{
                                height: 54,
                                borderRadius: Radius.full,
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'row',
                                backgroundColor: theme.primary,
                                opacity: askingNotifications ? 0.7 : 1,
                                ...Platform.select({
                                    ios: { shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
                                    android: { elevation: 5 },
                                }),
                            }}
                        >
                            {askingNotifications ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="notifications" size={18} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: '#fff' }}>
                                        Turn on reminders
                                    </Text>
                                </>
                            )}
                        </AnimatedPressable>
                        <TouchableOpacity
                            onPress={handleSkipNotifications}
                            disabled={askingNotifications}
                            style={{ paddingVertical: 14, alignItems: 'center' }}
                            accessibilityRole="button"
                        >
                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: theme.textSecondary }}>
                                Maybe later
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <AnimatedPressable
                            onPress={handleNext}
                            accessibilityRole="button"
                            style={{
                                height: 54,
                                borderRadius: Radius.full,
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'row',
                                backgroundColor: theme.primary,
                                ...Platform.select({
                                    ios: { shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
                                    android: { elevation: 5 },
                                }),
                            }}
                        >
                            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: '#fff' }}>
                                {isLast ? 'Get started' : 'Next'}
                            </Text>
                            <Ionicons
                                name={isLast ? 'sparkles' : 'arrow-forward'}
                                size={18}
                                color="#fff"
                                style={{ marginLeft: 8 }}
                            />
                        </AnimatedPressable>
                        <View style={{ height: 48, justifyContent: 'center', alignItems: 'center' }}>
                            {index > 0 && !isLast && (
                                <TouchableOpacity
                                    onPress={() => goTo(index - 1)}
                                    hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}
                                    accessibilityRole="button"
                                >
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: theme.textTertiary }}>Back</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}

interface SlideViewProps {
    slide: Slide;
    width: number;
    artSize: number;
    theme: ReturnType<typeof getTheme>;
    isDark: boolean;
    scrollX: Animated.Value;
    index: number;
}

/** One page of the intro. The artwork parallaxes slightly as you swipe. */
function SlideView({ slide, width, artSize, theme, isDark, scrollX, index }: SlideViewProps) {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    const artTranslate = scrollX.interpolate({
        inputRange,
        outputRange: [width * 0.25, 0, -width * 0.25],
        extrapolate: 'clamp',
    });
    const artScale = scrollX.interpolate({
        inputRange,
        outputRange: [0.85, 1, 0.85],
        extrapolate: 'clamp',
    });
    const copyOpacity = scrollX.interpolate({
        inputRange,
        outputRange: [0, 1, 0],
        extrapolate: 'clamp',
    });

    return (
        <ScrollView
            style={{ width }}
            contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 12, flexGrow: 1, justifyContent: 'center' }}
            showsVerticalScrollIndicator={false}
        >
            {/* Artwork */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <Animated.View
                    style={{
                        width: artSize,
                        height: artSize,
                        borderRadius: artSize / 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        backgroundColor: isDark ? 'rgba(129,140,248,0.12)' : '#eef2ff',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(129,140,248,0.25)' : '#e0e7ff',
                        transform: [{ translateX: artTranslate }, { scale: artScale }],
                    }}
                >
                    <Image
                        source={slide.image}
                        style={{ width: artSize * slide.imageScale, height: artSize * slide.imageScale }}
                        resizeMode="contain"
                    />
                </Animated.View>
            </View>

            {/* Copy */}
            <Animated.View style={{ opacity: copyOpacity }}>
                <Text
                    style={{
                        ...Typography.label,
                        textTransform: 'uppercase',
                        letterSpacing: 1.4,
                        color: theme.primary,
                        textAlign: 'center',
                        marginBottom: 8,
                    }}
                >
                    {slide.eyebrow}
                </Text>
                <Text
                    style={{
                        ...Typography.heading,
                        fontSize: 28,
                        lineHeight: 34,
                        color: theme.text,
                        textAlign: 'center',
                        marginBottom: 10,
                    }}
                >
                    {slide.title}
                </Text>
                <Text
                    style={{
                        ...Typography.body,
                        fontSize: 15,
                        lineHeight: 22,
                        color: theme.textSecondary,
                        textAlign: 'center',
                    }}
                >
                    {slide.subtitle}
                </Text>

                {slide.highlights && (
                    <View style={{ marginTop: 22, gap: 10 }}>
                        {slide.highlights.map((h) => (
                            <View
                                key={h.title}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    padding: 12,
                                    borderRadius: Radius.xl,
                                    backgroundColor: theme.surface,
                                    borderWidth: 1,
                                    borderColor: theme.cardBorder,
                                    ...(!isDark ? Shadows.sm : {}),
                                }}
                            >
                                <View
                                    style={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: Radius.md,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: h.color + (isDark ? '30' : '1a'),
                                        marginRight: 12,
                                    }}
                                >
                                    <Ionicons name={h.icon} size={19} color={h.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: theme.text }}>
                                        {h.title}
                                    </Text>
                                    <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 17, color: theme.textSecondary }}>
                                        {h.desc}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </Animated.View>
        </ScrollView>
    );
}
