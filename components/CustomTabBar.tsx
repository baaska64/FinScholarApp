import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme } from '@/constants/Theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  // Sliding indicator animation
  const slideAnim = useRef(new Animated.Value(visualIndex * tabWidth)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visualIndex * tabWidth,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [visualIndex, tabWidth]);

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderTopWidth: 1,
        borderTopColor: isDark ? theme.tabBorder : '#f1f5f9',
        paddingBottom: Platform.OS === 'ios' ? Math.max(28, insets.bottom) : Math.max(12, insets.bottom + 8),
        paddingTop: 8,
        ...Platform.select({
          ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12 },
          android: { elevation: 12 },
        }),
      }}
    >
      {/* Sliding active indicator */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: tabWidth,
          height: 3,
          borderRadius: 2,
          transform: [{ translateX: slideAnim }],
        }}
      >
        <View
          style={{
            flex: 1,
            marginHorizontal: tabWidth * 0.25,
            borderRadius: 2,
            backgroundColor: theme.tabActive,
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
            <TabButton
              key={tab.key}
              tab={tab}
              isFocused={isFocused}
              isDark={isDark}
              theme={theme}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityLabel={descriptor?.options?.tabBarAccessibilityLabel}
              testID={descriptor?.options?.tabBarButtonTestID}
            />
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
      toValue: isFocused ? 1.1 : 1,
      useNativeDriver: true,
      friction: 6,
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
        paddingVertical: 6,
      }}
      activeOpacity={0.7}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={isFocused ? tab.iconFocused : tab.icon}
          size={22}
          color={isFocused ? theme.tabActive : theme.tabInactive}
        />
      </Animated.View>
      <Text
        style={{
          marginTop: 4,
          fontSize: 10,
          fontFamily: isFocused ? 'Nunito_700Bold' : 'Nunito_400Regular',
          color: isFocused ? theme.tabActive : theme.tabInactive,
        }}
      >
        {tab.title}
      </Text>
    </TouchableOpacity>
  );
});
