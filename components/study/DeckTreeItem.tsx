import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { getTheme, Typography, Radius, Shadows } from '@/constants/Theme';
import { DeckNode, NodeStats } from './types';
import { getNodeStats, getNextDueText } from './utils';
import DeckCard from './DeckCard';

export interface DeckTreeItemProps {
  node: DeckNode;
  depth?: number;
  expandedNodes: Set<string>;
  onToggleNode: (path: string) => void;
  onPressDeck: (node: DeckNode) => void;
  onLongPressDeck: (node: DeckNode) => void;
  onQuickStudy: (node: DeckNode) => void;
  onMoreActions: (node: DeckNode) => void;
}

export default function DeckTreeItem({
  node,
  depth = 0,
  expandedNodes,
  onToggleNode,
  onPressDeck,
  onLongPressDeck,
  onQuickStudy,
  onMoreActions,
}: DeckTreeItemProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);

  const hasChildren = node.children.size > 0;
  const isExpanded = expandedNodes.has(node.fullPath);
  const stats: NodeStats = getNodeStats(node);
  const isFolder = hasChildren && !node.deck;
  const dueNowCount = stats.due + stats.learning;
  const nextText = dueNowCount === 0 && stats.new === 0 ? getNextDueText(node) : '';

  // If top-level single deck (not a folder with children), render rich DeckCard
  if (!hasChildren && depth === 0) {
    return (
      <DeckCard
        node={node}
        onPress={onPressDeck}
        onLongPress={onLongPressDeck}
        onQuickStudy={onQuickStudy}
        onMoreActions={onMoreActions}
      />
    );
  }

  // If node has children (is a Folder node or hybrid Deck+Children)
  if (hasChildren) {
    return (
      <View
        style={[
          styles.folderWrapper,
          {
            marginLeft: depth > 0 ? 14 : 0,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onPressDeck(node)}
          onLongPress={() => onLongPressDeck(node)}
          style={[
            styles.folderHeader,
            {
              backgroundColor: theme.surface,
              borderColor: isDark ? theme.cardBorder : '#e2e8f0',
              ...Shadows.sm,
            },
          ]}
        >
          {/* Folder Indicator strip */}
          <View
            style={[
              styles.folderStrip,
              {
                backgroundColor: node.deck?.color || (isDark ? '#6366f1' : '#4f46e5'),
              },
            ]}
          />

          {/* Expand / Collapse Chevron */}
          <TouchableOpacity
            onPress={() => onToggleNode(node.fullPath)}
            style={[
              styles.chevronBox,
              {
                backgroundColor: isDark ? theme.surfaceSecondary : '#f1f5f9',
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={isExpanded ? 'Collapse folder' : 'Expand folder'}
          >
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={15}
              color={isDark ? '#cbd5e1' : '#475569'}
            />
          </TouchableOpacity>

          {/* Folder Icon & Info */}
          <View style={styles.folderInfo}>
            <View style={styles.folderTitleRow}>
              <Ionicons
                name="folder-outline"
                size={16}
                color={node.deck?.color || theme.primary}
                style={{ marginRight: 6 }}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.folderTitle,
                  { color: isDark ? '#f8fafc' : '#1e293b' },
                ]}
              >
                {node.name}
              </Text>
            </View>

            <Text style={[styles.folderSub, { color: theme.textTertiary }]}>
              {node.children.size} sub-folder/deck{node.children.size !== 1 ? 's' : ''} · {stats.total} card{stats.total !== 1 ? 's' : ''}
              {nextText ? ` · in ${nextText}` : ''}
            </Text>
          </View>

          {/* Status Badges */}
          <View style={styles.folderBadges}>
            {stats.due > 0 && (
              <View
                style={[
                  styles.folderBadge,
                  { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff' },
                ]}
              >
                <Text style={[styles.folderBadgeText, { color: '#3b82f6' }]}>
                  {stats.due}
                </Text>
              </View>
            )}

            {stats.new > 0 && (
              <View
                style={[
                  styles.folderBadge,
                  { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : '#f5f3ff' },
                ]}
              >
                <Text style={[styles.folderBadgeText, { color: '#8b5cf6' }]}>
                  {stats.new}
                </Text>
              </View>
            )}

            {dueNowCount === 0 && stats.new === 0 && stats.total > 0 && (
              <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            )}

            {/* Ellipsis menu button */}
            <TouchableOpacity
              onPress={() => onMoreActions(node)}
              style={styles.folderMenuBtn}
              accessibilityRole="button"
              accessibilityLabel="Folder actions"
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={16}
                color={isDark ? '#94a3b8' : '#64748b'}
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Children Render */}
        {isExpanded && (
          <View
            style={[
              styles.childrenContainer,
              {
                borderLeftColor: isDark ? theme.surfaceSecondary : '#e2e8f0',
              },
            ]}
          >
            {Array.from(node.children.values()).map((child) => (
              <DeckTreeItem
                key={child.fullPath}
                node={child}
                depth={depth + 1}
                expandedNodes={expandedNodes}
                onToggleNode={onToggleNode}
                onPressDeck={onPressDeck}
                onLongPressDeck={onLongPressDeck}
                onQuickStudy={onQuickStudy}
                onMoreActions={onMoreActions}
              />
            ))}
          </View>
        )}
      </View>
    );
  }

  // Nested child deck (depth > 0)
  return (
    <View style={{ marginLeft: depth > 0 ? 10 : 0 }}>
      <DeckCard
        node={node}
        onPress={onPressDeck}
        onLongPress={onLongPressDeck}
        onQuickStudy={onQuickStudy}
        onMoreActions={onMoreActions}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  folderWrapper: {
    marginBottom: 12,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  folderStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginLeft: 4,
  },
  folderInfo: {
    flex: 1,
    marginRight: 8,
  },
  folderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 14.5,
    flex: 1,
  },
  folderSub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    marginTop: 2,
  },
  folderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  folderBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  folderBadgeText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 11,
  },
  folderMenuBtn: {
    padding: 4,
    marginLeft: 2,
  },
  childrenContainer: {
    marginLeft: 18,
    paddingLeft: 10,
    borderLeftWidth: 2,
    paddingTop: 8,
  },
});
