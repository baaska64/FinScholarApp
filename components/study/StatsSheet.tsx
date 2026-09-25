import React from 'react';
import { View, Text } from 'react-native';
import { getTheme, getTints, getBrand, Radius } from '@/constants/Theme';
import KeyboardSheet from '@/components/ui/KeyboardSheet';
import ProgressBar from '@/components/ui/ProgressBar';
import { FlashcardDeck, FlashcardStats } from './types';
import { calculateLevel, trueRetention, getLocalDateString } from './utils';
import { composition, forecast, studyDayKey } from './scheduler';
import { queueTints } from './studyTheme';

interface StatsSheetProps {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  decks: FlashcardDeck[];
  stats: FlashcardStats;
}

const WEEKS = 14;

/**
 * Anki's statistics, cut to the four questions a student actually asks: am I
 * keeping it up (the heatmap), is it working (true retention), what is coming
 * (the forecast), and how much do I know (the card breakdown). Level and XP
 * live here too — the progress system is part of the app's character, but it
 * is a reward to look at, not something to manage from the main screen.
 */
export default function StatsSheet({ visible, onClose, isDark, decks, stats }: StatsSheetProps) {
  const theme = getTheme(isDark);
  const tints = getTints(isDark);
  const brand = getBrand(isDark);
  const qt = queueTints(isDark);

  const level = calculateLevel(stats.totalXp || 0);
  const retention = trueRetention(stats, 30);
  const log = stats.log || {};
  const today = log[studyDayKey()] || { reviews: 0, passed: 0, matureTried: 0, ms: 0 };
  const allCards = decks.flatMap((d) => (Array.isArray(d?.cards) ? d.cards : []));
  const comp = composition(allCards);
  const ahead = forecast(decks, 7);
  const maxAhead = Math.max(1, ...ahead);

  // Heatmap: WEEKS columns of Mon–Sun, ending with the current week.
  const now = new Date();
  const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - (WEEKS - 1) * 7);
  const studied = new Set(stats.weeklyHistory || []);
  const cells: { key: string; count: number; future: boolean }[][] = [];
  let maxCount = 1;
  for (let w = 0; w < WEEKS; w++) {
    const col: { key: string; count: number; future: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
      const key = getLocalDateString(day);
      const count = log[key]?.reviews ?? (studied.has(key) ? 1 : 0);
      maxCount = Math.max(maxCount, count);
      col.push({ key, count, future: day > now });
    }
    cells.push(col);
  }
  const activeDays = cells.flat().filter((c) => c.count > 0).length;

  const microLabel = {
    fontFamily: 'Nunito_800ExtraBold' as const,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: theme.textTertiary,
  };
  const panel = {
    padding: 14,
    borderRadius: Radius.xl,
    backgroundColor: isDark ? 'rgba(0,0,0,0.18)' : theme.surfaceSecondary,
    marginBottom: 12,
  };

  const mins = Math.round(today.ms / 60000);
  const legend = [
    { key: 'new', label: 'New', count: comp.new, color: qt.new.solid },
    { key: 'learning', label: 'Learning', count: comp.learning, color: qt.learn.solid },
    { key: 'young', label: 'Young', count: comp.young, color: brand.solid },
    { key: 'mature', label: 'Mature', count: comp.mature, color: qt.review.solid },
    { key: 'suspended', label: 'Suspended', count: comp.suspended, color: theme.textTertiary },
  ];

  return (
    <KeyboardSheet visible={visible} onClose={onClose} title="Statistics" subtitle="Across all your decks" icon="stats-chart-outline" tint={tints.schedule}>
      {/* Level */}
      <View style={{ ...panel, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: tints.grades.fill, marginRight: 12 }}>
          <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: tints.grades.ink }}>{level.level}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 15, color: theme.text }}>{level.title}</Text>
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: theme.textTertiary, marginBottom: 6 }}>
            {level.isMaxLevel ? `${stats.totalXp || 0} XP · top level` : `${level.levelXpEarned} / ${level.levelXpRequired} XP to level ${level.level + 1}`}
          </Text>
          <ProgressBar progress={level.progress} height={6} color={tints.grades.solid} accessibilityLabel="Progress to next level" />
        </View>
      </View>

      {/* Today + retention */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={{ ...panel, flex: 1, marginBottom: 0 }}>
          <Text style={microLabel}>Today</Text>
          <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 24, color: theme.text, marginTop: 4, letterSpacing: -0.6 }}>{today.reviews}</Text>
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: theme.textSecondary }}>
            card{today.reviews !== 1 ? 's' : ''}{mins > 0 ? ` · ${mins} min` : ''}
          </Text>
        </View>
        <View style={{ ...panel, flex: 1, marginBottom: 0 }}>
          <Text style={microLabel}>Retention · 30d</Text>
          <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 24, color: retention === null ? theme.textTertiary : theme.text, marginTop: 4, letterSpacing: -0.6 }}>
            {retention === null ? '—' : `${Math.round(retention * 100)}%`}
          </Text>
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: theme.textSecondary }}>
            {retention === null ? 'after your first reviews' : 'of reviews remembered'}
          </Text>
        </View>
      </View>

      {/* Heatmap */}
      <View style={panel}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 }}>
          <Text style={{ ...microLabel, flex: 1 }}>Activity</Text>
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: theme.textSecondary }}>
            {activeDays} day{activeDays !== 1 ? 's' : ''} in {WEEKS} weeks
          </Text>
        </View>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          accessible
          accessibilityLabel={`Studied on ${activeDays} of the last ${WEEKS * 7} days`}
        >
          {cells.map((col, wi) => (
            <View key={wi} style={{ gap: 3 }}>
              {col.map((cell) => {
                const level = cell.count === 0 ? 0 : Math.min(4, Math.ceil((cell.count / maxCount) * 4));
                const alpha = ['', '40', '70', 'a8', 'ff'][level];
                return (
                  <View
                    key={cell.key}
                    style={{
                      width: 15,
                      height: 15,
                      borderRadius: 4,
                      backgroundColor: cell.future ? 'transparent' : level === 0 ? (isDark ? 'rgba(255,255,255,0.06)' : '#dfe3ef') : brand.solid + alpha,
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* Forecast */}
      <View style={panel}>
        <Text style={{ ...microLabel, marginBottom: 10 }}>Due · next 7 days</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 86, gap: 8 }}>
          {ahead.map((n, i) => {
            const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
            const label = i === 0 ? 'Today' : day.toLocaleDateString('en-US', { weekday: 'short' });
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${label}: ${n} due`}>
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 10.5, color: theme.textSecondary, marginBottom: 3 }}>{n}</Text>
                <View
                  style={{
                    width: '100%',
                    height: Math.max(3, Math.round((n / maxAhead) * 52)),
                    borderRadius: 5,
                    backgroundColor: i === 0 ? qt.review.solid : qt.review.solid + '88',
                  }}
                />
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 9.5, color: theme.textTertiary, marginTop: 4 }}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Card breakdown */}
      <View style={panel}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 }}>
          <Text style={{ ...microLabel, flex: 1 }}>Cards</Text>
          <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: theme.textSecondary }}>{comp.total} total</Text>
        </View>
        <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: theme.cardBorder }}>
          {comp.total > 0 && legend.map((l) => (l.count > 0 ? <View key={l.key} style={{ flex: l.count, backgroundColor: l.color }} /> : null))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, rowGap: 6, columnGap: 14 }}>
          {legend.map((l) => (
            <View key={l.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color }} />
              <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11.5, color: theme.textSecondary }}>
                {l.label} <Text style={{ fontFamily: 'Nunito_900Black', color: theme.text }}>{l.count}</Text>
              </Text>
            </View>
          ))}
        </View>
        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11, color: theme.textTertiary, marginTop: 8, lineHeight: 15 }}>
          Mature cards have reached intervals of three weeks or more — that is long-term memory.
        </Text>
      </View>
    </KeyboardSheet>
  );
}
