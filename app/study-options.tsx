import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncService } from '@/services/SyncService';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import Card from '@/components/ui/Card';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import { DEFAULT_SR_SETTINGS, parseSteps, resolveSettings, unburySiblings } from '@/components/study/scheduler';

const RETENTION_CHOICES = [
  { value: 0.8, label: '80%', note: 'Relaxed' },
  { value: 0.85, label: '85%', note: 'Lighter' },
  { value: 0.9, label: '90%', note: 'Recommended' },
  { value: 0.95, label: '95%', note: 'Intense' },
];
const GOAL_PRESETS = [10, 20, 30, 50];

/**
 * Study options, after Anki's deck options but cut to what changes a
 * student's day: how many new cards, how many reviews, and how much they want
 * to remember. FSRS makes the last one the only scheduling knob that matters;
 * steps and the interval ceiling are still here for people coming from Anki,
 * folded under Advanced.
 */
export default function StudyOptionsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getTheme(isDark);
  const tints = getTints(isDark);

  const [form, setForm] = useState({
    newPerDay: 20,
    reviewsPerDay: 200,
    desiredRetention: 0.9,
    dailyGoal: 20,
    learningSteps: '1 10',
    relearningSteps: '10',
    maximumInterval: '36500',
    burySiblings: false,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('grade_ledger_v2_data');
        if (!raw) return;
        const ledger = JSON.parse(raw);
        const s = resolveSettings(ledger.flashcards?.settings);
        const goal =
          typeof ledger.flashcards?.stats?.dailyGoal === 'number'
            ? ledger.flashcards.stats.dailyGoal
            : typeof ledger.flashcards?.settings?.dailyGoal === 'number'
            ? ledger.flashcards.settings.dailyGoal
            : 20;
        setForm({
          newPerDay: s.newPerDay,
          reviewsPerDay: s.reviewsPerDay,
          desiredRetention: s.desiredRetention,
          dailyGoal: goal,
          learningSteps: s.learningSteps,
          relearningSteps: s.relearningSteps,
          maximumInterval: String(s.maximumInterval),
          burySiblings: s.burySiblings,
        });
      } catch (e) {
        console.error('Failed to load study options:', e);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (parseSteps(form.learningSteps, []).length === 0) {
      setShowAdvanced(true);
      setError('Learning steps need at least one number of minutes, e.g. "1 10".');
      return;
    }
    try {
      const raw = await AsyncStorage.getItem('grade_ledger_v2_data');
      const ledger = raw ? JSON.parse(raw) : { settings: {}, years: [] };
      if (!ledger.flashcards) ledger.flashcards = { decks: [], stats: {} };
      const goal = Math.max(1, Math.floor(Number(form.dailyGoal) || 20));
      ledger.flashcards.settings = {
        ...DEFAULT_SR_SETTINGS,
        ...ledger.flashcards.settings,
        newPerDay: form.newPerDay,
        reviewsPerDay: form.reviewsPerDay,
        desiredRetention: form.desiredRetention,
        learningSteps: form.learningSteps.trim() || '1 10',
        relearningSteps: form.relearningSteps.trim(),
        maximumInterval: Math.max(1, Math.floor(Number(form.maximumInterval) || 36500)),
        dailyGoal: goal,
        burySiblings: form.burySiblings,
      };
      // Turning holding off should show the held siblings today, not after
      // tomorrow's rollover. Hand-buried cards stay buried.
      if (!form.burySiblings) {
        for (const d of ledger.flashcards.decks || []) if (Array.isArray(d?.cards)) d.cards = unburySiblings(d.cards);
      }
      ledger.flashcards.stats = { ...(ledger.flashcards.stats || {}), dailyGoal: goal };
      await SyncService.pushLocalChanges(ledger);
      router.back();
    } catch (e) {
      console.error('Failed to save study options:', e);
    }
  };

  const microLabel = {
    fontFamily: 'Nunito_800ExtraBold' as const,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: theme.textTertiary,
  };
  const field = {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    backgroundColor: theme.inputBg,
    color: theme.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Nunito_700Bold' as const,
    fontSize: 15,
  };

  const Stepper = ({
    label,
    hint,
    value,
    onChange,
    step,
    min,
    max,
    unit,
  }: {
    label: string;
    hint: string;
    value: number;
    onChange: (n: number) => void;
    step: number;
    min: number;
    max: number;
    unit: string;
  }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: theme.text }}>{label}</Text>
        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary, marginTop: 1, lineHeight: 16 }}>{hint}</Text>
      </View>
      <TouchableOpacity
        onPress={() => onChange(Math.max(min, value - step))}
        accessibilityRole="button"
        accessibilityLabel={`Fewer ${unit}`}
        style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceSecondary }}
      >
        <Ionicons name="remove" size={18} color={theme.text} />
      </TouchableOpacity>
      <View style={{ width: 58, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: theme.text }}>{value}</Text>
        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 9.5, color: theme.textTertiary }}>{unit}</Text>
      </View>
      <TouchableOpacity
        onPress={() => onChange(Math.min(max, value + step))}
        accessibilityRole="button"
        accessibilityLabel={`More ${unit}`}
        style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceSecondary }}
      >
        <Ionicons name="add" size={18} color={theme.text} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 10 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{
            width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
            backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.cardBorder, borderBottomWidth: 2, borderBottomColor: theme.lip,
          }}
        >
          <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ fontFamily: 'Nunito_900Black', fontSize: 19, color: theme.text, letterSpacing: -0.4 }}>
            Study options
          </Text>
          <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary }}>Apply to every deck</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={{ ...microLabel, marginTop: 6, marginBottom: 8, marginLeft: 2 }}>Each day</Text>
        <Card padding={0} radius={Radius['2xl']} style={{ paddingHorizontal: 14, marginBottom: 20 }}>
          <Stepper
            label="New cards"
            hint="Introduced per deck. Each new card brings reviews for weeks after."
            value={form.newPerDay}
            onChange={(n) => setForm((f) => ({ ...f, newPerDay: n }))}
            step={5}
            min={0}
            max={200}
            unit="per day"
          />
          <View style={{ height: 1, backgroundColor: theme.cardBorder }} />
          <Stepper
            label="Maximum reviews"
            hint="A ceiling per deck, for days after a break."
            value={form.reviewsPerDay}
            onChange={(n) => setForm((f) => ({ ...f, reviewsPerDay: n }))}
            step={50}
            min={50}
            max={9999}
            unit="per day"
          />
          <View style={{ height: 1, backgroundColor: theme.cardBorder }} />
          <Stepper
            label="Daily goal"
            hint="Cards to answer each day to keep your streak going."
            value={form.dailyGoal}
            onChange={(n) => setForm((f) => ({ ...f, dailyGoal: n }))}
            step={5}
            min={5}
            max={500}
            unit="cards"
          />
          <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 14 }}>
            {GOAL_PRESETS.map((p) => {
              const active = form.dailyGoal === p;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setForm((f) => ({ ...f, dailyGoal: p }))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    flex: 1, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: active ? tints.attendance.fill : theme.surfaceSecondary,
                    borderWidth: 1, borderColor: active ? tints.attendance.line : theme.cardBorder,
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: active ? tints.attendance.ink : theme.textSecondary }}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <Text style={{ ...microLabel, marginBottom: 8, marginLeft: 2 }}>Notes with several cards</Text>
        <Card padding={14} radius={Radius['2xl']} style={{ marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => setForm((f) => ({ ...f, burySiblings: !f.burySiblings }))}
            activeOpacity={0.7}
            accessibilityRole="switch"
            accessibilityState={{ checked: form.burySiblings }}
            accessibilityLabel="Space out cards from the same note"
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: theme.text }}>Space out cards from the same note</Text>
              <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary, marginTop: 1, lineHeight: 16 }}>
                A cloze with c1, c2 and c3 makes three cards. Off, you're quizzed on all three today. On, after you answer one the others wait until the next day, so one answer can't give away the next.
              </Text>
            </View>
            <View
              style={{
                width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center',
                alignItems: form.burySiblings ? 'flex-end' : 'flex-start',
                backgroundColor: form.burySiblings ? theme.primary : theme.surfaceSecondary,
                borderWidth: 1, borderColor: form.burySiblings ? theme.primary : theme.cardBorder,
              }}
            >
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#ffffff' }} />
            </View>
          </TouchableOpacity>
          {form.burySiblings && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12 }}>
              <Ionicons name="information-circle-outline" size={15} color={theme.textTertiary} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, lineHeight: 16 }}>
                A note with many cards, like an image with 10 boxes, will take several days to see in full.
              </Text>
            </View>
          )}
        </Card>

        <Text style={{ ...microLabel, marginBottom: 8, marginLeft: 2 }}>Memory</Text>
        <Card padding={14} radius={Radius['2xl']} style={{ marginBottom: 20 }}>
          <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: theme.text }}>Target retention</Text>
          <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary, marginTop: 1, marginBottom: 12, lineHeight: 16 }}>
            How likely you are to still remember a card when it comes back. Higher means you forget less, but review more often.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {RETENTION_CHOICES.map((c) => {
              const active = Math.abs(form.desiredRetention - c.value) < 0.001;
              return (
                <TouchableOpacity
                  key={c.value}
                  onPress={() => setForm((f) => ({ ...f, desiredRetention: c.value }))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${c.label}, ${c.note}`}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: Radius.lg, alignItems: 'center',
                    backgroundColor: active ? tints.schedule.fill : theme.surfaceSecondary,
                    borderWidth: 1, borderColor: active ? tints.schedule.line : theme.cardBorder,
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 16, color: active ? tints.schedule.ink : theme.text }}>{c.label}</Text>
                  <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 9.5, color: active ? tints.schedule.ink : theme.textTertiary, marginTop: 1 }}>{c.note}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12 }}>
            <Ionicons name="information-circle-outline" size={15} color={theme.textTertiary} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: theme.textTertiary, lineHeight: 16 }}>
              Scheduling uses FSRS, the algorithm Anki recommends. Rate honestly — the schedule is only as good as your answers.
            </Text>
          </View>
        </Card>

        <TouchableOpacity
          onPress={() => setShowAdvanced((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showAdvanced }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, marginBottom: 8, marginLeft: 2 }}
        >
          <Text style={microLabel}>Advanced</Text>
          <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={13} color={theme.textTertiary} />
        </TouchableOpacity>
        {showAdvanced && (
          <Card padding={14} radius={Radius['2xl']} style={{ marginBottom: 20 }}>
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: theme.text }}>Learning steps</Text>
            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary, marginTop: 1, marginBottom: 8 }}>
              Minutes between the first showings of a new card. "1 10" = again in 1 minute, then 10.
            </Text>
            <TextInput
              value={form.learningSteps}
              onChangeText={(t) => {
                setForm((f) => ({ ...f, learningSteps: t }));
                setError(null);
              }}
              autoCapitalize="none"
              accessibilityLabel="Learning steps in minutes"
              style={{ ...field, marginBottom: 14 }}
            />
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: theme.text }}>Relearning steps</Text>
            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary, marginTop: 1, marginBottom: 8 }}>
              When you forget a review card. Leave empty to skip straight back to days.
            </Text>
            <TextInput
              value={form.relearningSteps}
              onChangeText={(t) => setForm((f) => ({ ...f, relearningSteps: t }))}
              autoCapitalize="none"
              accessibilityLabel="Relearning steps in minutes"
              style={{ ...field, marginBottom: 14 }}
            />
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: theme.text }}>Maximum interval</Text>
            <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary, marginTop: 1, marginBottom: 8 }}>
              The longest a card can go unseen, in days.
            </Text>
            <TextInput
              value={form.maximumInterval}
              onChangeText={(t) => setForm((f) => ({ ...f, maximumInterval: t.replace(/[^0-9]/g, '') }))}
              keyboardType="number-pad"
              accessibilityLabel="Maximum interval in days"
              style={field}
            />
          </Card>
        )}

        {error ? (
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 7, padding: 12, borderRadius: Radius.md, marginBottom: 12,
              backgroundColor: tints.danger.fill, borderWidth: 1, borderColor: tints.danger.line,
            }}
          >
            <Ionicons name="alert-circle-outline" size={15} color={tints.danger.ink} />
            <Text style={{ flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: tints.danger.ink }}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 24,
          backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.cardBorder,
        }}
      >
        <AnimatedPressable
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save study options"
          style={{
            paddingVertical: 15, borderRadius: Radius.lg, alignItems: 'center',
            backgroundColor: theme.primary, borderBottomWidth: 3, borderBottomColor: theme.primaryDark,
          }}
        >
          <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15.5, color: '#ffffff' }}>Save</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}
