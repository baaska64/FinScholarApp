import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, Typography, Radius, Shadows } from '@/constants/Theme';
import { TaskItem } from './types';
import { parseDueDate } from './utils';

export interface TaskProgressIslandProps {
  tasks: TaskItem[];
  nowMs: number;
}

export default function TaskProgressIsland({ tasks, nowMs }: TaskProgressIslandProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  const total = tasks.length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const submitted = tasks.filter((t) => t.status === 'submitted').length;
  const graded = tasks.filter((t) => t.status === 'graded').length;
  const completed = submitted + graded;

  // Check overdue
  const overdueCount = tasks.filter((t) => {
    if (t.status !== 'pending') return false;
    const due = parseDueDate(t.dueDate);
    if (!due) return false;
    return due.getTime() <= nowMs;
  }).length;

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Encouraging motivational message
  const getMotivationalMessage = () => {
    if (total === 0) return 'No tasks yet. Create one to kick off your productivity!';
    if (percent === 100) return '🎉 Incredible work! All tasks are submitted and done!';
    if (overdueCount > 0) return `⚠️ You have ${overdueCount} overdue ${overdueCount === 1 ? 'task' : 'tasks'}. Let's tackle them first!`;
    if (percent >= 75) return '🔥 You are crushing it! Almost done with all tasks!';
    if (percent >= 50) return '🚀 Halfway through! Keep the momentum going!';
    if (percent > 0) return '🌱 Great start! Focus on one task at a time.';
    return `📋 ${pending} ${pending === 1 ? 'task' : 'tasks'} waiting for your focus today.`;
  };

  return (
    <View
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel={`Tasks Overview: ${percent}% completed. ${total} total tasks, ${pending} pending, ${submitted} submitted, ${graded} graded.`}
      style={{
        borderRadius: 24,
        padding: 18,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: isDark ? theme.cardBorder : '#e2e8f0',
        ...Shadows.sm,
        marginBottom: 20,
      }}
    >
      {/* Header Row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
            }}
          >
            <Ionicons name="pie-chart" size={16} color={theme.primary} />
          </View>
          <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 15, color: theme.text }}>
            Tasks Overview
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 10,
            backgroundColor: percent === 100 ? (isDark ? 'rgba(52, 211, 153, 0.15)' : '#dcfce7') : (isDark ? theme.surfaceSecondary : '#f1f5f9'),
          }}
        >
          <Text
            style={{
              fontFamily: 'Nunito_900Black',
              fontSize: 12,
              color: percent === 100 ? theme.success : theme.primary,
            }}
          >
            {percent}% Completed
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View
        accessible={true}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        accessibilityLabel={`Overall task progress: ${percent} percent completed`}
        style={{
          height: 8,
          borderRadius: 999,
          backgroundColor: isDark ? theme.surfaceSecondary : '#e2e8f0',
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${percent}%`,
            backgroundColor: percent === 100 ? theme.success : theme.primary,
            borderRadius: 999,
          }}
        />
      </View>

      {/* 4 Stat Cards Row */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {/* Total */}
        <View
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`${total} total tasks`}
          style={{
            flex: 1,
            paddingVertical: 10,
            paddingHorizontal: 4,
            borderRadius: 14,
            backgroundColor: isDark ? theme.surfaceSecondary : '#f8fafc',
            borderWidth: 1,
            borderColor: isDark ? theme.cardBorder : '#f1f5f9',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: theme.text }}>{total}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'Nunito_700Bold', fontSize: 10, color: theme.textTertiary, marginTop: 2 }}>Total</Text>
        </View>

        {/* Pending */}
        <View
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`${pending} pending tasks`}
          style={{
            flex: 1,
            paddingVertical: 10,
            paddingHorizontal: 4,
            borderRadius: 14,
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: '#f59e0b' }}>{pending}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'Nunito_700Bold', fontSize: 10, color: '#f59e0b', marginTop: 2 }}>Pending</Text>
        </View>

        {/* Submitted */}
        <View
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`${submitted} submitted tasks`}
          style={{
            flex: 1,
            paddingVertical: 10,
            paddingHorizontal: 4,
            borderRadius: 14,
            backgroundColor: isDark ? 'rgba(79, 70, 229, 0.1)' : '#eef2ff',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(79, 70, 229, 0.3)' : '#c7d2fe',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: theme.primary }}>{submitted}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'Nunito_700Bold', fontSize: 10, color: theme.primary, marginTop: 2 }}>Submitted</Text>
        </View>

        {/* Graded */}
        <View
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`${graded} graded tasks`}
          style={{
            flex: 1,
            paddingVertical: 10,
            paddingHorizontal: 4,
            borderRadius: 14,
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: theme.success }}>{graded}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'Nunito_700Bold', fontSize: 10, color: theme.success, marginTop: 2 }}>Graded</Text>
        </View>
      </View>

      {/* Motivational Prompt / Urgency Banner */}
      <View
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel={getMotivationalMessage()}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: overdueCount > 0
            ? (isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2')
            : (isDark ? theme.surfaceSecondary : '#f8fafc'),
        }}
      >
        <Ionicons
          name={overdueCount > 0 ? 'warning' : 'sparkles'}
          size={14}
          color={overdueCount > 0 ? theme.error : theme.primary}
          style={{ marginRight: 6 }}
        />
        <Text
          numberOfLines={2}
          style={{
            flex: 1,
            fontFamily: 'Nunito_700Bold',
            fontSize: 11,
            color: overdueCount > 0 ? theme.error : theme.textSecondary,
          }}
        >
          {getMotivationalMessage()}
        </Text>
      </View>
    </View>
  );
}
