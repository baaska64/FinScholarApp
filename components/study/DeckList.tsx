import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import { DeckNode } from './types';
import { DueCounts } from './scheduler';
import { getDeckThematicIcon } from './utils';
import { queueTints } from './studyTheme';

interface DeckListProps {
  nodes: DeckNode[];
  isDark: boolean;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onOpen: (node: DeckNode) => void;
  onLongPress: (node: DeckNode) => void;
  countsFor: (node: DeckNode) => DueCounts;
  totalFor: (node: DeckNode) => number;
  examLabelFor: (node: DeckNode) => string | null;
}

/**
 * The deck list as Anki draws it: one row per deck with its three numbers —
 * new, learning, to review — in their queue colours, folders expanding in
 * place. It is one panel with hairlines rather than a stack of cards, because
 * a student scans it for "which deck has work", and a column of numbers is
 * faster to scan than a column of boxes.
 */
export default function DeckList({ nodes, isDark, expanded, onToggle, onOpen, onLongPress, countsFor, totalFor, examLabelFor }: DeckListProps) {
  const theme = getTheme(isDark);
  const tints = getTints(isDark);
  const qt = queueTints(isDark);

  const rows: { node: DeckNode; depth: number }[] = [];
  const walk = (list: DeckNode[], depth: number) => {
    for (const n of list) {
      rows.push({ node: n, depth });
      if (n.children.size > 0 && expanded.has(n.fullPath)) walk(Array.from(n.children.values()), depth + 1);
    }
  };
  walk(nodes, 0);
  // Leaf decks reserve the chevron's width whenever any row has one, so every icon sits in one column.
  const anyFolder = rows.some((r) => r.node.children.size > 0);

  const count = (n: number, tint: { ink: string }) => (
    <Text
      style={{
        width: 38,
        textAlign: 'right',
        fontFamily: 'Nunito_900Black',
        fontSize: 13.5,
        color: n > 0 ? tint.ink : theme.textTertiary,
        opacity: n > 0 ? 1 : 0.45,
      }}
    >
      {n}
    </Text>
  );

  return (
    <View
      style={{
        borderRadius: Radius['2xl'],
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.cardBorder,
        borderBottomWidth: 2,
        borderBottomColor: theme.lip,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 }}>
        <Text style={{ flex: 1, fontFamily: 'Nunito_800ExtraBold', fontSize: 10, letterSpacing: 0.8, color: theme.textTertiary }}>DECK</Text>
        {[
          { label: 'NEW', tint: qt.new },
          { label: 'LEARN', tint: qt.learn },
          { label: 'DUE', tint: qt.review },
        ].map((h) => (
          <Text key={h.label} style={{ width: 38, textAlign: 'right', fontFamily: 'Nunito_800ExtraBold', fontSize: 8.5, letterSpacing: 0.3, color: h.tint.ink }}>
            {h.label}
          </Text>
        ))}
        <View style={{ width: 22 }} />
      </View>

      {rows.map(({ node, depth }) => {
        const isFolder = node.children.size > 0;
        const open = expanded.has(node.fullPath);
        const deck = node.deck;
        const color = deck?.color || theme.primary;
        const c = countsFor(node);
        const total = totalFor(node);
        const exam = examLabelFor(node);
        const icon = isFolder && !deck ? (open ? 'folder-open-outline' : 'folder-outline') : deck?.icon || getDeckThematicIcon(deck?.subject, node.name);
        return (
          <TouchableOpacity
            key={node.fullPath}
            onPress={() => onOpen(node)}
            onLongPress={() => onLongPress(node)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${isFolder ? 'Folder' : 'Deck'} ${node.name}. ${c.new} new, ${c.learn} learning, ${c.review} to review.`}
            accessibilityHint="Opens the deck. Long press for options."
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 11,
              paddingRight: 14,
              paddingLeft: 14 + depth * 18,
              borderTopWidth: 1,
              borderTopColor: theme.cardBorder,
            }}
          >
            {isFolder ? (
              <TouchableOpacity
                onPress={() => onToggle(node.fullPath)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
                style={{ width: 18, marginRight: 4, alignItems: 'center' }}
              >
                <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={15} color={theme.textTertiary} />
              </TouchableOpacity>
            ) : anyFolder ? (
              <View style={{ width: 22 }} />
            ) : null}

            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                marginRight: 11,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: color + (isDark ? '2e' : '1a'),
              }}
            >
              <Ionicons name={icon as any} size={17} color={color} />
            </View>

            <View style={{ flex: 1, marginRight: 6 }}>
              <Text numberOfLines={1} style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: theme.text }}>
                {node.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary }}>
                  {total} card{total !== 1 ? 's' : ''}
                </Text>
                {exam ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.full, backgroundColor: tints.danger.fill }}>
                    <Ionicons name="calendar" size={9} color={tints.danger.ink} />
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 9.5, color: tints.danger.ink }}>{exam}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {count(c.new, qt.new)}
            {count(c.learn, qt.learn)}
            {count(c.review, qt.review)}
            <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} style={{ marginLeft: 8, opacity: 0.6 }} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
