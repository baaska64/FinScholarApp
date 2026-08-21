import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, Typography, Radius, Shadows } from '@/constants/Theme';
import { FlashcardStats } from './types';
import {
  calculateLevel,
  getWeekDaysActivity,
  getLocalDateString,
  isStreakLive,
} from './utils';

export interface StudyDashboardStatsProps {
  stats: FlashcardStats;
  totalCards: number;
  totalDueNow: number;
  totalMastered: number;
  nextDueIn: string;
  onStudyAllDue: () => void;
}

export default function StudyDashboardStats({
  stats,
  totalCards,
  totalDueNow,
  totalMastered,
  nextDueIn,
  onStudyAllDue,
}: StudyDashboardStatsProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  const levelInfo = calculateLevel(stats.totalXp || 0);
  const weekActivity = getWeekDaysActivity(stats.weeklyHistory || [], stats.lastStudyDate || '');

  const todayStr = getLocalDateString();
  const isStudiedToday = stats.lastStudyDate === todayStr;
  const dailyGoal = Math.max(1, stats.dailyGoal || 20);
  const cardsReviewedToday = isStudiedToday ? (stats.cardsReviewedToday ?? stats.masteredToday ?? 0) : 0;
  const dailyGoalProgress = Math.min(100, Math.max(0, Math.round((cardsReviewedToday / dailyGoal) * 100)));

  const masteryPercentage = Math.min(100, Math.max(0, totalCards > 0 ? Math.round((totalMastered / totalCards) * 100) : 0));
  const isLive = isStreakLive(stats.lastStudyDate);
  const streak = isLive ? Math.max(0, stats.currentStreak || 0) : 0;

  return (
    <View
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`Study Momentum: Streak ${streak} days, Level ${levelInfo.level} ${levelInfo.title}, ${totalDueNow} cards due`}
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#1a1a1b' : '#ffffff',
          borderColor: isDark ? theme.cardBorder : '#e2e8f0',
          ...Shadows.md,
        },
      ]}
    >
      {/* Top Bar: Streak & Level */}
      <View style={styles.topRow}>
        {/* Streak Badge */}
        <View
          style={[
            styles.streakBadge,
            {
              backgroundColor: streak > 0
                ? isDark
                  ? 'rgba(249, 115, 22, 0.15)'
                  : '#fff7ed'
                : isDark
                ? theme.surfaceSecondary
                : '#f1f5f9',
              borderColor: streak > 0
                ? isDark
                  ? 'rgba(249, 115, 22, 0.3)'
                  : '#fed7aa'
                : isDark
                ? theme.cardBorder
                : '#e2e8f0',
            },
          ]}
        >
          <Text style={styles.streakFlame}>{streak > 0 ? '🔥' : '⚡'}</Text>
          <Text
            style={[
              styles.streakText,
              { color: streak > 0 ? '#f97316' : theme.textSecondary },
            ]}
          >
            {streak} Day{streak !== 1 ? 's' : ''} Streak
          </Text>
        </View>

        {/* Level / XP Pill */}
        <View
          style={[
            styles.levelBadge,
            {
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff',
              borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : '#c7d2fe',
            },
          ]}
        >
          <Text style={styles.levelBadgeIcon}>{levelInfo.badge}</Text>
          <Text style={[styles.levelBadgeText, { color: theme.primary }]}>
            Lv. {levelInfo.level} · {stats.totalXp || 0} XP
          </Text>
        </View>
      </View>

      {/* Level Title & XP Progress */}
      <View style={styles.xpSection}>
        <View style={styles.xpTextRow}>
          <Text style={[styles.levelTitleText, { color: theme.text }]}>
            {levelInfo.title}
          </Text>
          <Text style={[styles.xpCounterText, { color: theme.textSecondary }]}>
            {levelInfo.isMaxLevel
              ? 'Max Level Achieved 🏆'
              : `${levelInfo.levelXpEarned} / ${levelInfo.levelXpRequired} XP to next level`}
          </Text>
        </View>
        <View
          style={[
            styles.xpProgressBarBg,
            { backgroundColor: isDark ? theme.surfaceSecondary : '#e2e8f0' },
          ]}
        >
          <View
            style={[
              styles.xpProgressBarFill,
              {
                width: `${Math.max(4, Math.round(levelInfo.progress * 100))}%`,
                backgroundColor: theme.primary,
              },
            ]}
          />
        </View>
      </View>

      {/* 4-Stat Metrics Grid */}
      <View style={styles.statsGrid}>
        {/* Due Now */}
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: totalDueNow > 0
                ? isDark
                  ? 'rgba(59, 130, 246, 0.12)'
                  : '#eff6ff'
                : isDark
                ? theme.surfaceSecondary
                : '#f8fafc',
              borderColor: totalDueNow > 0
                ? isDark
                  ? 'rgba(59, 130, 246, 0.35)'
                  : '#bfdbfe'
                : isDark
                ? theme.cardBorder
                : '#f1f5f9',
            },
          ]}
        >
          <Ionicons
            name="flash"
            size={14}
            color={totalDueNow > 0 ? '#3b82f6' : theme.textTertiary}
          />
          <Text
            style={[
              styles.statValue,
              { color: totalDueNow > 0 ? '#3b82f6' : theme.text },
            ]}
          >
            {totalDueNow}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Due Now</Text>
        </View>

        {/* Mastered */}
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#a7f3d0',
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={14} color="#10b981" />
          <Text style={[styles.statValue, { color: '#10b981' }]}>
            {totalMastered}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Mastered ({masteryPercentage}%)
          </Text>
        </View>

        {/* Daily Goal */}
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: dailyGoalProgress >= 100
                ? isDark
                  ? 'rgba(234, 179, 8, 0.12)'
                  : '#fefce8'
                : isDark
                ? theme.surfaceSecondary
                : '#f8fafc',
              borderColor: dailyGoalProgress >= 100
                ? isDark
                  ? 'rgba(234, 179, 8, 0.3)'
                  : '#fef08a'
                : isDark
                ? theme.cardBorder
                : '#f1f5f9',
            },
          ]}
        >
          <Ionicons
            name="trophy"
            size={14}
            color={dailyGoalProgress >= 100 ? '#eab308' : theme.textTertiary}
          />
          <Text
            style={[
              styles.statValue,
              { color: dailyGoalProgress >= 100 ? '#eab308' : theme.text },
            ]}
          >
            {cardsReviewedToday}/{dailyGoal}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Daily Goal</Text>
        </View>

        {/* Total Cards */}
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: isDark ? theme.surfaceSecondary : '#f8fafc',
              borderColor: isDark ? theme.cardBorder : '#f1f5f9',
            },
          ]}
        >
          <Ionicons name="albums-outline" size={14} color={theme.textTertiary} />
          <Text style={[styles.statValue, { color: theme.text }]}>
            {totalCards}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Cards</Text>
        </View>
      </View>

      {/* Weekly Activity Row */}
      <View
        style={[
          styles.weeklyRow,
          {
            borderTopColor: isDark ? theme.cardBorder : '#f1f5f9',
          },
        ]}
      >
        <Text style={[styles.weeklyLabel, { color: theme.textSecondary }]}>
          This Week:
        </Text>
        <View style={styles.daysContainer}>
          {weekActivity.map((day, idx) => (
            <View key={idx} style={styles.dayCol}>
              <View
                style={[
                  styles.dayDot,
                  {
                    backgroundColor: day.isCompleted
                      ? '#10b981'
                      : day.isToday
                      ? isDark
                        ? 'rgba(99, 102, 241, 0.3)'
                        : '#e0e7ff'
                      : isDark
                      ? '#334155'
                      : '#e2e8f0',
                    borderColor: day.isToday ? theme.primary : 'transparent',
                    borderWidth: day.isToday ? 1.5 : 0,
                  },
                ]}
              >
                {day.isCompleted && (
                  <Ionicons name="checkmark" size={10} color="#ffffff" />
                )}
              </View>
              <Text
                style={[
                  styles.dayText,
                  {
                    color: day.isToday
                      ? theme.primary
                      : day.isCompleted
                      ? '#10b981'
                      : theme.textTertiary,
                    fontFamily: day.isToday ? 'Nunito_800ExtraBold' : 'Nunito_700Bold',
                  },
                ]}
              >
                {day.dayLabel}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Action / Review Status Hero Banner */}
      {totalDueNow > 0 ? (
        <TouchableOpacity
          onPress={onStudyAllDue}
          activeOpacity={0.88}
          style={[
            styles.heroActionBtn,
            {
              backgroundColor: theme.primary,
              ...(!isDark
                ? {
                    shadowColor: theme.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  }
                : {}),
            },
          ]}
        >
          <Ionicons name="play-circle" size={20} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={styles.heroActionBtnText}>
            Study All Due ({totalDueNow} Card{totalDueNow !== 1 ? 's' : ''})
          </Text>
        </TouchableOpacity>
      ) : nextDueIn ? (
        <View
          style={[
            styles.statusNotice,
            {
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : '#f8fafc',
              borderColor: isDark ? theme.cardBorder : '#e2e8f0',
            },
          ]}
        >
          <Ionicons name="time-outline" size={16} color={theme.primary} />
          <Text style={[styles.statusNoticeText, { color: theme.textSecondary }]}>
            All caught up! Next review in{' '}
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', color: theme.primary }}>
              {nextDueIn}
            </Text>
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.statusNotice,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#a7f3d0',
            },
          ]}
        >
          <Ionicons name="sparkles" size={16} color="#10b981" />
          <Text style={[styles.statusNoticeText, { color: isDark ? '#34d399' : '#059669' }]}>
            {totalCards > 0
              ? 'Awesome! No pending cards due right now.'
              : 'Add cards or import decks to begin your study journey!'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius['3xl'],
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  streakFlame: {
    fontSize: 14,
    marginRight: 6,
  },
  streakText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 12,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  levelBadgeIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  levelBadgeText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 12,
  },
  xpSection: {
    marginBottom: 16,
  },
  xpTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  levelTitleText: {
    fontFamily: 'Nunito_900Black',
    fontSize: 15,
  },
  xpCounterText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
  },
  xpProgressBarBg: {
    height: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  xpProgressBarFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: Radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: 'Nunito_900Black',
    fontSize: 16,
    marginTop: 4,
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    textAlign: 'center',
  },
  weeklyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    marginBottom: 14,
  },
  weeklyLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
  },
  daysContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  dayCol: {
    alignItems: 'center',
    gap: 3,
  },
  dayDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 10,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.xl,
  },
  heroActionBtnText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 15,
    color: '#ffffff',
  },
  statusNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: 8,
  },
  statusNoticeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
  },
});
