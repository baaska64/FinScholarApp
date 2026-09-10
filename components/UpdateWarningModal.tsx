import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Linking, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import Constants from 'expo-constants';
import { supabase } from '../services/supabaseClient';
import { getTheme, getTints, Radius, Typography } from '@/constants/Theme';
import { isNewerVersion } from '@/utils/appVersion';

/**
 * Remembers which remote version the user said "Later" to. Without it the sheet
 * reappeared on every cold start, which is how an update prompt teaches people
 * to dismiss it without reading.
 */
const SNOOZED_VERSION_KEY = '@update_snoozed_version';

const CURRENT_VERSION = Constants.expoConfig?.version || '1.0.0';

interface RemoteVersion {
  latest_version?: string;
  update_message?: string;
  store_url?: string;
  /** Optional; when true the sheet cannot be dismissed. */
  force_update?: boolean;
}

/**
 * "Update Available".
 *
 * Shown once per remote version unless the update is marked mandatory. Tells
 * the user which version they are on and which one is waiting — the old copy
 * said only "a new version is available", which is not enough to decide
 * anything, and it was never actually mounted, so nobody ever saw it.
 */
export default function UpdateWarningModal() {
  const [updateInfo, setUpdateInfo] = useState<RemoteVersion | null>(null);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);
  const tints = getTints(isDark);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data, error } = await supabase.from('app_versions').select('*').eq('id', 1).single();
        if (cancelled || error || !data) return;

        const latest = data.latest_version;
        if (!latest || !isNewerVersion(CURRENT_VERSION, latest)) return;

        // A mandatory update ignores the snooze; anything else asks once.
        if (!data.force_update) {
          const snoozed = await AsyncStorage.getItem(SNOOZED_VERSION_KEY);
          if (cancelled || snoozed === latest) return;
        }

        setUpdateInfo(data);
      } catch (e) {
        // Offline or the table is unreachable — never block the app on this.
        console.error('Failed to check for updates:', e);
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLater = useCallback(async () => {
    const latest = updateInfo?.latest_version;
    setUpdateInfo(null);
    if (!latest) return;
    try {
      await AsyncStorage.setItem(SNOOZED_VERSION_KEY, latest);
    } catch (e) {
      console.error('Failed to snooze update prompt:', e);
    }
  }, [updateInfo]);

  const handleUpdate = useCallback(() => {
    const url = updateInfo?.store_url;
    if (url) Linking.openURL(url).catch(() => {});
    setUpdateInfo(null);
  }, [updateInfo]);

  if (!updateInfo) return null;

  const mandatory = Boolean(updateInfo.force_update);
  const tint = tints.attendance;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={mandatory ? () => {} : handleLater}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlay }}>
        {!mandatory && (
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={handleLater}
            accessibilityRole="button"
            accessibilityLabel="Dismiss update prompt"
          />
        )}

        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: theme.background,
            borderTopLeftRadius: Radius['4xl'],
            borderTopRightRadius: Radius['4xl'],
            borderTopWidth: 1,
            borderColor: theme.cardBorder,
            maxHeight: '80%',
          }}
        >
          {!mandatory && (
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.cardBorder }} />
            </View>
          )}

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: Radius.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tint.fill,
                  borderWidth: 1,
                  borderColor: tint.line,
                  marginRight: 12,
                }}
              >
                <Ionicons name="cloud-download" size={21} color={tint.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...Typography.title, color: theme.text }}>
                  {mandatory ? 'Update Required' : 'Update Available'}
                </Text>
                <Text style={{ ...Typography.caption, color: theme.textSecondary, marginTop: 1 }}>
                  {mandatory ? 'This version is no longer supported' : 'A newer version is on the Play Store'}
                </Text>
              </View>
            </View>

            {/* The two versions, side by side. "A new version is available" on
                its own tells you nothing about how far behind you are. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(0,0,0,0.18)' : theme.surfaceSecondary,
                borderRadius: Radius['2xl'],
                borderWidth: 1,
                borderColor: theme.cardBorder,
                paddingVertical: 16,
                marginBottom: 16,
              }}
            >
              <VersionPill label="You have" value={CURRENT_VERSION} theme={theme} muted />
              <Ionicons
                name="arrow-forward"
                size={17}
                color={theme.textTertiary}
                style={{ marginHorizontal: 16 }}
              />
              <VersionPill label="Latest" value={updateInfo.latest_version ?? '—'} theme={theme} tintColor={tint.ink} />
            </View>

            {Boolean(updateInfo.update_message) && (
              <View
                style={{
                  backgroundColor: tint.fill,
                  borderRadius: Radius['2xl'],
                  borderWidth: 1,
                  borderColor: tint.line,
                  padding: 16,
                  marginBottom: 4,
                }}
              >
                <Text style={{ ...Typography.label, color: tint.ink, letterSpacing: 0.8, marginBottom: 6 }}>
                  WHAT'S IN IT
                </Text>
                <Text style={{ ...Typography.caption, color: theme.text, lineHeight: 20 }}>
                  {updateInfo.update_message}
                </Text>
              </View>
            )}
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 14),
              borderTopWidth: 1,
              borderColor: theme.cardBorder,
              backgroundColor: theme.surface,
            }}
          >
            {!mandatory && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Remind me later"
                accessibilityHint="Hides this until the next version is released"
                onPress={handleLater}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  paddingVertical: 15,
                  borderRadius: Radius.full,
                  alignItems: 'center',
                  backgroundColor: isDark ? theme.surfaceSecondary : theme.surface,
                  borderWidth: 1,
                  borderColor: theme.cardBorder,
                  borderBottomWidth: 2,
                  borderBottomColor: theme.lip,
                }}
              >
                <Text style={{ ...Typography.bodyBold, color: theme.text }}>Later</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Update to version ${updateInfo.latest_version ?? 'latest'}`}
              onPress={handleUpdate}
              activeOpacity={0.85}
              style={{
                flex: mandatory ? 1 : 1.3,
                paddingVertical: 15,
                borderRadius: Radius.full,
                alignItems: 'center',
                // A bright fill on a dark page cannot carry white text — the
                // emerald `solid` measures 2.2:1 against white. Dark mode takes
                // the bright fill with dark ink, light mode the deep fill with
                // white, and both land above 5:1.
                backgroundColor: isDark ? tint.solid : tint.ink,
                borderBottomWidth: 2,
                borderColor: isDark ? 'rgba(0,0,0,0.35)' : '#0b4d3a',
              }}
            >
              <Text style={{ ...Typography.bodyBold, color: isDark ? theme.textInverse : '#ffffff' }}>
                Update Now
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function VersionPill({
  label,
  value,
  theme,
  muted,
  tintColor,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof getTheme>;
  muted?: boolean;
  tintColor?: string;
}) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text
        style={{
          ...Typography.label,
          color: theme.textTertiary,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginBottom: 3,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: 'Nunito_900Black',
          fontSize: 20,
          color: muted ? theme.textSecondary : tintColor ?? theme.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
