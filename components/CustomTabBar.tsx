import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme } from '@/constants/Theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SpotlightTarget from '@/components/spotlight/SpotlightTarget';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TabItem {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
}

const TABS: TabItem[] = [
  { key: 'index', title: 'Home', icon: 'home-outline', iconFocused: 'home' },
  { key: 'grades', title: 'Grades', icon: 'school-outline', iconFocused: 'school' },
  { key: 'schedule', title: 'Schedule', icon: 'time-outline', iconFocused: 'time' },
  { key: 'calendar', title: 'Calendar', icon: 'calendar-outline', iconFocused: 'calendar' },
  { key: 'requirements', title: 'Tasks', icon: 'list-outline', iconFocused: 'list' },
  { key: 'flashcards', title: 'Study', icon: 'layers-outline', iconFocused: 'layers' },
];

/** paddingTop (8) + the tab button's minHeight (52). */
const TAB_BAR_CONTENT_HEIGHT = 60;

/** The bar's own bottom padding. One definition, used by the bar and by callers. */
function tabBarBottomPadding(bottomInset: number) {
  return Platform.OS === 'ios' ? Math.max(28, bottomInset) : Math.max(12, bottomInset + 8);
}

/**
 * Total height the tab bar occupies.
 *
 * The bar is `position: 'absolute'`, so any screen with content at the bottom
 * has to reserve this height itself. Screens used to hand-tune a number for it,
 * which drifts from the bar and silently clips the last row — that is what hid
 * the practice-test options and the bottom of Profile. Use this instead.
 */
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_CONTENT_HEIGHT + tabBarBottomPadding(insets.bottom);
}

interface CustomTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

export default function CustomTabBar({ state, descriptors, navigation }: CustomTabBarProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);
  const insets = useSafeAreaInsets();

  const currentRouteName = state.routes[state.index]?.name;
  const activeTabIndex = TABS.findIndex(t => t.key === currentRouteName);
  const visualIndex = activeTabIndex >= 0 ? activeTabIndex : 0;
  
  const tabWidth = SCREEN_WIDTH / TABS.length;
  const PILL_WIDTH = Math.min(52, tabWidth - 8);
  const PILL_HEIGHT = 30;

  // The active pill slides between tabs rather than a hairline sitting above
  // them: it reads as the selection itself, not a separate decoration.
  const slideAnim = useRef(new Animated.Value(visualIndex * tabWidth)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visualIndex * tabWidth,
      useNativeDriver: true,
      friction: 9,
      tension: 70,
    }).start();
  }, [visualIndex, tabWidth]);

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: theme.tabBg,
        borderTopWidth: 1,
        borderTopColor: theme.tabBorder,
        paddingBottom: tabBarBottomPadding(insets.bottom),
        paddingTop: 8,
        ...Platform.select({
          ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.04, shadowRadius: 3 },
          android: { elevation: 8 },
        }),
      }}
    >
      {/* Sliding active pill, painted behind the icons */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 10,
          left: 0,
          width: tabWidth,
          height: PILL_HEIGHT,
          alignItems: 'center',
          transform: [{ translateX: slideAnim }],
        }}
      >
        <View
          style={{
            width: PILL_WIDTH,
            height: PILL_HEIGHT,
            borderRadius: PILL_HEIGHT / 2,
            backgroundColor: isDark ? 'rgba(129,140,248,0.18)' : 'rgba(79,70,229,0.10)',
          }}
        />
      </Animated.View>

      <View style={{ flexDirection: 'row' }}>
        {TABS.map((tab, index) => {
          const route = state.routes.find((r: any) => r.name === tab.key);
          const isFocused = currentRouteName === tab.key;
          const descriptor = route ? descriptors[route.key] : null;

          const onPress = () => {
            if (!route) return;
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            if (!route) return;
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <SpotlightTarget key={tab.key} id={`tab.${tab.key}`} style={{ flex: 1 }}>
              <TabButton
                tab={tab}
                isFocused={isFocused}
                isDark={isDark}
                theme={theme}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityLabel={descriptor?.options?.tabBarAccessibilityLabel}
                testID={descriptor?.options?.tabBarButtonTestID}
              />
            </SpotlightTarget>
          );
        })}
      </View>
    </View>
  );
}

interface TabButtonProps {
  tab: TabItem;
  isFocused: boolean;
  isDark: boolean;
  theme: any;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

const TabButton = React.memo(function TabButton({ tab, isFocused, isDark, theme, onPress, onLongPress, accessibilityLabel, testID }: TabButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isFocused ? 1.08 : 1,
      useNativeDriver: true,
      friction: 5,
      tension: 90,
    }).start();
  }, [isFocused]);

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 4,
        paddingBottom: 6,
        minHeight: 52,
      }}
      activeOpacity={0.7}
    >
      <Animated.View style={{ height: 30, justifyContent: 'center', transform: [{ scale }] }}>
        <Ionicons
          name={isFocused ? tab.iconFocused : tab.icon}
          size={21}
          color={isFocused ? theme.tabActive : theme.tabInactive}
        />
      </Animated.View>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 3,
          fontSize: 10,
          letterSpacing: isFocused ? 0 : 0.1,
          fontFamily: isFocused ? 'Nunito_800ExtraBold' : 'Nunito_400Regular',
          color: isFocused ? theme.tabActive : theme.tabInactive,
        }}
      >
        {tab.title}
      </Text>
    </TouchableOpacity>
  );
});
