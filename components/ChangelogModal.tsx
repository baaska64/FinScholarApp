import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useColorScheme } from 'nativewind';
import { getTheme, getTints, Radius, Typography } from '@/constants/Theme';
import { CHANGELOG, LATEST_RELEASE, releaseFor, type ChangelogEntry } from '@/constants/changelog';
import { triggerHaptic } from './tasks/utils';
import { OnboardingService } from '../services/OnboardingService';

const CHANGELOG_KEY = '@changelog_last_seen_version';
const CURRENT_VERSION = Constants.expoConfig?.version || LATEST_RELEASE.version;

/**
 * Lets Settings reopen the sheet on demand, the same imperative shape
 * `AlertService` uses. Without it "What's New" is a one-shot popup you can
 * never get back to — which is exactly where release notes go to die.
 */
class ChangelogManager {
  private listener: ((open: boolean) => void) | null = null;

  setListener(listener: (open: boolean) => void) {
    this.listener = listener;
  }

  open() {
    this.listener?.(true);
  }
}

export const ChangelogService = new ChangelogManager();

/**
 * "What's New" — the release notes sheet.
 *
 * Shows itself once per version, and can be reopened from Settings → Help.
 * Deliberately built on the app's own tokens rather than the glass/blur
 * treatment it used to have: that version was dark-only, so in light mode it
 * dropped a black slab over the app, and its stacked drop shadows were the
 * floating-template look the rest of the app moved away from.
 */
export default function ChangelogModal() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);
  const tints = getTints(isDark);
  const insets = useSafeAreaInsets();

  const release = releaseFor(CURRENT_VERSION);
  const older = CHANGELOG.filter((entry) => entry.version !== release.version);

  useEffect(() => {
    ChangelogService.setListener(setVisible);
    return () => ChangelogService.setListener(() => {});
  }, []);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const lastSeenVersion = await AsyncStorage.getItem(CHANGELOG_KEY);
        if (lastSeenVersion === CURRENT_VERSION) return;

        // Nothing is "new" on a fresh install — the intro already covered it.
        // Record the version silently so the changelog starts from the next update.
        if (await OnboardingService.isFirstRun()) {
          await AsyncStorage.setItem(CHANGELOG_KEY, CURRENT_VERSION);
          return;
        }

        setVisible(true);
      } catch (e) {
        console.error('Error reading changelog version', e);
      }
    };

    // Let the first screen settle before covering it.
    timer.current = setTimeout(checkVersion, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleClose = useCallback(async () => {
    triggerHaptic('success');
    setVisible(false);
    setExpanded(false);
    try {
      await AsyncStorage.setItem(CHANGELOG_KEY, CURRENT_VERSION);
    } catch (e) {
      console.error('Error saving changelog version', e);
    }
  }, []);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlay }}>
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close what's new"
        />

        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: theme.background,
            borderTopLeftRadius: Radius['4xl'],
            borderTopRightRadius: Radius['4xl'],
            borderTopWidth: 1,
            borderColor: theme.cardBorder,
            maxHeight: '86%',
          }}
        >
          {/* Grab handle — the sheet is dismissible by tapping outside, and this
              is the only thing that says so before you try. */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.cardBorder }} />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: Radius.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tints.schedule.fill,
                  borderWidth: 1,
                  borderColor: tints.schedule.line,
                  marginRight: 12,
                }}
              >
                <Ionicons name="sparkles" size={21} color={tints.schedule.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...Typography.title, color: theme.text }}>What's New</Text>
                <Text style={{ ...Typography.caption, color: theme.textSecondary, marginTop: 1 }}>
                  Version {release.version} · {release.date}
                </Text>
              </View>
            </View>

            <Text
              style={{
                ...Typography.bodyBold,
                color: theme.textSecondary,
                marginTop: 8,
                marginBottom: 16,
              }}
            >
              {release.headline}
            </Text>

            <ReleaseItems entry={release} theme={theme} tints={tints} isDark={isDark} />

            {older.length > 0 && (
              <>
                <TouchableOpacity
                  onPress={() => setExpanded((v) => !v)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={expanded ? 'Hide earlier updates' : 'Show earlier updates'}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 14,
                    marginTop: 6,
                  }}
                >
                  <Text style={{ ...Typography.captionBold, color: theme.textSecondary, marginRight: 6 }}>
                    {expanded ? 'Hide earlier updates' : 'Earlier updates'}
                  </Text>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>

                {expanded &&
                  older.map((entry) => (
                    <View key={entry.version} style={{ marginBottom: 18 }}>
                      <Text
                        style={{
                          ...Typography.label,
                          color: theme.textTertiary,
                          letterSpacing: 0.8,
                          textTransform: 'uppercase',
                          marginBottom: 8,
                        }}
                      >
                        Version {entry.version} · {entry.date}
                      </Text>
                      <ReleaseItems entry={entry} theme={theme} tints={tints} isDark={isDark} />
                    </View>
                  ))}
              </>
            )}
          </ScrollView>

          {/* Pinned, not scrolled. The old sheet kept its only button at the
              bottom of the scroll, so on a short screen you had to scroll a list
              you had already read just to get out. */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 14),
              borderTopWidth: 1,
              borderColor: theme.cardBorder,
              backgroundColor: theme.surface,
            }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Dismiss what's new"
              onPress={handleClose}
              activeOpacity={0.85}
              style={{
                paddingVertical: 15,
                borderRadius: Radius.full,
                alignItems: 'center',
                backgroundColor: theme.primary,
                borderBottomWidth: 2,
                borderColor: isDark ? 'rgba(0,0,0,0.35)' : theme.primaryDark,
              }}
            >
              {/* Dark `primary` is a light indigo meant as an accent on a dark
                  page — white on it measures 2.98:1, under AA for 16px bold.
                  Bright fill takes dark ink; the deep light-mode fill takes white. */}
              <Text style={{ ...Typography.bodyBold, color: isDark ? theme.textInverse : '#ffffff' }}>
                Got it
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ReleaseItems({
  entry,
  theme,
  tints,
  isDark,
}: {
  entry: ChangelogEntry;
  theme: ReturnType<typeof getTheme>;
  tints: ReturnType<typeof getTints>;
  isDark: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: isDark ? 'rgba(0,0,0,0.18)' : theme.surfaceSecondary,
        borderRadius: Radius['2xl'],
        borderWidth: 1,
        borderColor: theme.cardBorder,
        padding: 16,
      }}
    >
      {entry.items.map((item, idx) => {
        const tint = tints[item.tint];
        return (
          <View
            key={item.title}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              marginBottom: idx === entry.items.length - 1 ? 0 : 16,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: Radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: tint.fill,
                borderWidth: 1,
                borderColor: tint.line,
                marginRight: 12,
              }}
            >
              <Ionicons name={item.icon as any} size={18} color={tint.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...Typography.captionBold, fontSize: 15, lineHeight: 20, color: theme.text }}>
                {item.title}
              </Text>
              <Text style={{ ...Typography.caption, color: theme.textSecondary, marginTop: 2 }}>
                {item.desc}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
