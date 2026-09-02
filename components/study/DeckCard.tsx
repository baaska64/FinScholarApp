import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, Typography, Radius, Shadows } from '@/constants/Theme';
import { DeckNode, NodeStats } from './types';
import { getDeckThematicIcon, getNodeStats, getNextDueText, getColorWithAlpha } from './utils';

export interface DeckCardProps {
  node: DeckNode;
  onPress: (node: DeckNode) => void;
  onLongPress: (node: DeckNode) => void;
  onQuickStudy: (node: DeckNode) => void;
  onMoreActions: (node: DeckNode) => void;
}

export default function DeckCard({
  node,
  onPress,
  onLongPress,
  onQuickStudy,
  onMoreActions,
}: DeckCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  const stats: NodeStats = getNodeStats(node);
  const deck = node.deck;
  const deckColor = deck?.color || '#4f46e5';
  const deckIcon = deck?.icon || getDeckThematicIcon(deck?.subject, node.name);
  const dueCount = stats.due + stats.learning;
  const nextDueText = dueCount === 0 && stats.new === 0 ? getNextDueText(node) : '';
  const masteredPercentage = Math.min(100, Math.max(0, stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0));

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onPress(node)}
      onLongPress={() => onLongPress(node)}
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.surface,
          borderColor: isDark ? theme.cardBorder : '#e2e8f0',
          ...Shadows.sm,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Deck ${node.name}, ${stats.total} cards, ${dueCount} due, ${masteredPercentage}% mastered`}
    >
      {/* Top Accent Strip */}
      <View style={[styles.accentStrip, { backgroundColor: deckColor }]} />

      {/* Main Content Area */}
      <View style={styles.contentArea}>
        <View style={styles.headerRow}>
          {/* Deck Icon Avatar */}
          <View
            style={[
              styles.iconAvatar,
              {
                backgroundColor: getColorWithAlpha(deckColor, isDark ? 0.2 : 0.12),
                borderColor: getColorWithAlpha(deckColor, 0.3),
              },
            ]}
          >
            <Ionicons name={deckIcon as any} size={22} color={deckColor} />
          </View>

          {/* Deck Title & Subject Tag */}
          <View style={styles.titleContainer}>
            {deck?.subject ? (
              <View
                style={[
                  styles.subjectPill,
                  {
                    backgroundColor: getColorWithAlpha(deckColor, isDark ? 0.18 : 0.08),
                    borderColor: getColorWithAlpha(deckColor, 0.25),
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.subjectText, { color: deckColor }]}
                >
                  {deck.subject.toUpperCase()}
                </Text>
              </View>
            ) : null}

            <Text
              numberOfLines={1}
              style={[
                styles.deckTitle,
                { color: isDark ? '#f8fafc' : '#1e293b' },
              ]}
            >
              {node.name}
            </Text>

            <Text style={[styles.deckSubText, { color: theme.textTertiary }]}>
              {stats.total} Card{stats.total !== 1 ? 's' : ''}
              {nextDueText ? ` · Next in ${nextDueText}` : ''}
            </Text>
          </View>

          {/* More actions (ellipsis) */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onMoreActions(node)}
            style={[
              styles.moreBtn,
              {
                backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Deck options"
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={18}
              color={isDark ? '#94a3b8' : '#64748b'}
            />
          </TouchableOpacity>
        </View>

        {/* Mastery Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
              Mastery
            </Text>
            <Text style={[styles.progressValue, { color: deckColor }]}>
              {masteredPercentage}%
            </Text>
          </View>
          <View
            style={[
              styles.progressBarBg,
              { backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9' },
            ]}
          >
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${masteredPercentage}%`,
                  backgroundColor: deckColor,
                },
              ]}
            />
          </View>
        </View>

        {/* Footer Row: Status Badges & Quick Study CTA */}
        <View style={styles.footerRow}>
          {/* Status Badges */}
          <View style={styles.badgesContainer}>
            {stats.due > 0 && (
              <View
                style={[
                  styles.badgePill,
                  {
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
                    borderColor: isDark ? 'rgba(59, 130, 246, 0.4)' : '#bfdbfe',
                  },
                ]}
              >
                <Ionicons name="flash" size={11} color="#3b82f6" style={{ marginRight: 3 }} />
                <Text style={[styles.badgeText, { color: '#3b82f6' }]}>
                  {stats.due} Due
                </Text>
              </View>
            )}

            {stats.learning > 0 && (
              <View
                style={[
                  styles.badgePill,
                  {
                    backgroundColor: isDark ? 'rgba(249, 115, 22, 0.2)' : '#fff7ed',
                    borderColor: isDark ? 'rgba(249, 115, 22, 0.4)' : '#fed7aa',
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: '#f97316' }]}>
                  {stats.learning} Learning
                </Text>
              </View>
            )}

            {stats.new > 0 && (
              <View
                style={[
                  styles.badgePill,
                  {
                    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : '#f5f3ff',
                    borderColor: isDark ? 'rgba(139, 92, 246, 0.4)' : '#ddd6fe',
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: '#8b5cf6' }]}>
                  {stats.new} New
                </Text>
              </View>
            )}

            {dueCount === 0 && stats.new === 0 && stats.total > 0 && (
              <View
                style={[
                  styles.badgePill,
                  {
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                    borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
                  },
                ]}
              >
                <Ionicons name="checkmark-circle" size={12} color="#10b981" style={{ marginRight: 3 }} />
                <Text style={[styles.badgeText, { color: '#10b981' }]}>
                  Mastered
                </Text>
              </View>
            )}
          </View>

          {/* Quick Study Button */}
          {stats.total > 0 && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onQuickStudy(node)}
              style={[
                styles.quickStudyBtn,
                {
                  backgroundColor: dueCount > 0 ? deckColor : isDark ? theme.surfaceSecondary : '#f1f5f9',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Study ${node.name}`}
            >
              <Ionicons
                name="play"
                size={12}
                color={dueCount > 0 ? '#ffffff' : isDark ? '#cbd5e1' : '#475569'}
              />
              <Text
                style={[
                  styles.quickStudyText,
                  {
                    color: dueCount > 0 ? '#ffffff' : isDark ? '#cbd5e1' : '#475569',
                  },
                ]}
              >
                Study
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  accentStrip: {
    height: 4,
    width: '100%',
  },
  contentArea: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 8,
  },
  subjectPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    marginBottom: 3,
  },
  subjectText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  deckTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 15,
    lineHeight: 20,
  },
  deckSubText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    marginTop: 2,
  },
  moreBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
  },
  progressValue: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 10.5,
  },
  progressBarBg: {
    height: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    marginRight: 10,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 10.5,
  },
  quickStudyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    gap: 4,
  },
  quickStudyText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 11,
  },
});
