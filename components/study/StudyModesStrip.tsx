import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, Radius } from '@/constants/Theme';

export interface StudyModeOption {
  id: 'flashcards' | 'spaced' | 'match' | 'quiz' | 'exam';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  badge?: string;
  color: string;
}

export interface StudyModesStripProps {
  onSelectMode: (modeId: StudyModeOption['id']) => void;
  activeMode?: string;
}

const STUDY_MODES: StudyModeOption[] = [
  {
    id: 'flashcards',
    icon: 'albums-outline',
    title: 'Flashcards',
    badge: 'Classic',
    color: '#6366f1',
  },
  {
    id: 'spaced',
    icon: 'refresh-outline',
    title: 'Spaced Rep.',
    badge: 'SM-2',
    color: '#3b82f6',
  },
  {
    id: 'match',
    icon: 'grid-outline',
    title: 'Speed Match',
    badge: 'Game',
    color: '#f97316',
  },
  {
    id: 'quiz',
    icon: 'document-text-outline',
    title: 'Practice Test',
    badge: 'Quiz',
    color: '#10b981',
  },
  {
    id: 'exam',
    icon: 'calendar-outline',
    title: 'Exam Prep',
    badge: 'Smart',
    color: '#ec4899',
  },
];

export default function StudyModesStrip({ onSelectMode, activeMode }: StudyModesStripProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Study Modes</Text>
        <Text style={[styles.sectionSub, { color: theme.textTertiary }]}>Select an activity</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {STUDY_MODES.map((mode) => {
          const isSelected = activeMode === mode.id;

          return (
            <TouchableOpacity
              key={mode.id}
              activeOpacity={0.8}
              onPress={() => onSelectMode(mode.id)}
              style={[
                styles.modeCard,
                {
                  backgroundColor: isSelected
                    ? isDark
                      ? 'rgba(99, 102, 241, 0.2)'
                      : '#eef2ff'
                    : isDark
                    ? '#1a1a1b'
                    : '#ffffff',
                  borderColor: isSelected
                    ? mode.color
                    : isDark
                    ? theme.cardBorder
                    : '#e2e8f0',
                },
              ]}
            >
              {/* Icon Container */}
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: mode.color + (isDark ? '25' : '15'),
                  },
                ]}
              >
                <Ionicons name={mode.icon} size={20} color={mode.color} />
              </View>

              {/* Title & Badge */}
              <View style={styles.textContainer}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.modeTitle,
                    { color: isDark ? '#f8fafc' : '#1e293b' },
                  ]}
                >
                  {mode.title}
                </Text>
                {mode.badge && (
                  <View
                    style={[
                      styles.badgeBox,
                      {
                        backgroundColor: mode.color + (isDark ? '25' : '15'),
                      },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: mode.color }]}>
                      {mode.badge}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Nunito_900Black',
    fontSize: 16,
  },
  sectionSub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
  },
  scrollContent: {
    gap: 10,
    paddingRight: 8,
  },
  modeCard: {
    width: 124,
    padding: 12,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    alignItems: 'center',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  textContainer: {
    alignItems: 'center',
    gap: 4,
  },
  modeTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 12,
    textAlign: 'center',
  },
  badgeBox: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.2,
  },
});
