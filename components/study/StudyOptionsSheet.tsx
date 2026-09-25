import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTheme, getTints, Radius } from '@/constants/Theme';
import KeyboardSheet from '@/components/ui/KeyboardSheet';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import { SRSettings } from './types';
import { parseSteps, resolveSettings } from './scheduler';

const RETENTION_CHOICES = [
  { value: 0.8, label: '80%', note: 'Relaxed' },
  { value: 0.85, label: '85%', note: 'Lighter' },
  { value: 0.9, label: '90%', note: 'Recommended' },
  { value: 0.95, label: '95%', note: 'Intense' },
];
const GOAL_PRESETS = [10, 20, 30, 50];

interface StudyOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  settings: SRSettings;
  dailyGoal: number;
  onSave: (settings: SRSettings, dailyGoal: number) => void;
}

type Theme = ReturnType<typeof getTheme>;

function Stepper({
  theme,
  label,
  hint,
  value,
  onChange,
  step,
  min,
  max,
  unit,
}: {
  theme: Theme;
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
  min: number;
  max: number;
  unit: string;
}) {
  const button = (icon: 'remove' | 'add', next: number, a11y: string) => (
    <TouchableOpacity
      onPress={() => onChange(next)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{
        width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.cardBorder,
      }}
    >
      <Ionicons name={icon} size={18} color={theme.text} />
    </TouchableOpacity>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14.5, color: theme.text }}>{label}</Text>
        <Text style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, color: theme.textTertiary, marginTop: 1, lineHeight: 16 }}>{hint}</Text>
      </View>
      {button('remove', Math.max(min, value - step), `Fewer ${unit}, ${label}`)}
      <View style={{ width: 58, alignItems: 'center' }} accessible accessibilityLabel={`${label}: ${value} ${unit}`}>
        <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 18, color: theme.text }}>{value}</Text>
        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 9.5, color: theme.textTertiary }}>{unit}</Text>
      </View>
      {button('add', Math.min(max, value + step), `More ${unit}, ${label}`)}
    </View>
  );
}

/**
 * Study options, after Anki's deck options but cut to what changes a
 * student's day: how many new cards, how many reviews, and how much they want
 * to remember. FSRS makes the last one the only scheduling knob that matters;
 * steps and the interval ceiling are still here for people coming from Anki,
 * folded under Advanced.
 *
 * A sheet over the study tab, not a pushed route. As a route, going back on
 * Android blanked the page before the native pop animation ran, so the
 * student saw a white screen and then the tab sliding in from the left. Every
 * other study control is already a sheet; this one now behaves the same.
 */
export default function StudyOptionsSheet({ visible, onClose, isDark, settings, dailyGoal, onSave }: StudyOptionsSheetProps) {
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
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from what is saved every time the sheet opens, so closing it without
  // saving really does throw the edits away.
  useEffect(() => {
    if (!visible) return;
    const s = resolveSettings(settings);
    setForm({
      newPerDay: s.newPerDay,
      reviewsPerDay: s.reviewsPerDay,
      desiredRetention: s.desiredRetention,
      dailyGoal: Math.max(1, Math.floor(dailyGoal || 20)),
      learningSteps: s.learningSteps,
      relearningSteps: s.relearningSteps,
      maximumInterval: String(s.maximumInterval),
    });
    setShowAdvanced(false);
    setError(null);
  }, [visible]);

  const handleSave = () => {
    if (parseSteps(form.learningSteps, []).length === 0) {
      setShowAdvanced(true);
      setError('Learning steps need at least one number of minutes, e.g. "1 10".');
      return;
    }
    onSave(
      {
        ...settings,
        newPerDay: form.newPerDay,
        reviewsPerDay: form.reviewsPerDay,
        desiredRetention: form.desiredRetention,
        learningSteps: form.learningSteps.trim() || '1 10',
        relearningSteps: form.relearningSteps.trim(),
        maximumInterval: Math.max(1, Math.floor(Number(form.maximumInterval) || 36500)),
      },
      Math.max(1, Math.floor(Number(form.dailyGoal) || 20))
    );
  };

  const microLabel = {
    fontFamily: 'Nunito_800ExtraBold' as const,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: theme.textTertiary,
  };
  // Sunken panels: raised cards would be the same colour as the sheet itself.
  const panel = {
    borderRadius: Radius.xl,
    backgroundColor: isDark ? 'rgba(0,0,0,0.18)' : theme.surfaceSecondary,
    marginBottom: 18,
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
  const hairline = <View style={{ height: 1, backgroundColor: theme.cardBorder }} />;

  return (
    <KeyboardSheet
      visible={visible}
      onClose={onClose}
      title="Study options"
      subtitle="Apply to every deck"
      icon="options-outline"
      tint={tints.schedule}
      footer={
        <AnimatedPressable
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save study options"
          style={{
            paddingVertical: 14, borderRadius: Radius.lg, alignItems: 'center',
            backgroundColor: theme.primary, borderBottomWidth: 3, borderBottomColor: theme.primaryDark,
          }}
        >
          <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15.5, color: '#ffffff' }}>Save</Text>
        </AnimatedPressable>
      }
    >
      <Text style={{ ...microLabel, marginBottom: 8 }}>Each day</Text>
      <View style={{ ...panel, paddingHorizontal: 14 }}>
        <Stepper
          theme={theme}
          label="New cards"
          hint="Introduced per deck. Each new card brings reviews for weeks after."
          value={form.newPerDay}
          onChange={(n) => setForm((f) => ({ ...f, newPerDay: n }))}
          step={5}
          min={0}
          max={200}
          unit="per day"
        />
        {hairline}
        <Stepper
          theme={theme}
          label="Maximum reviews"
          hint="A ceiling per deck, for days after a break."
          value={form.reviewsPerDay}
          onChange={(n) => setForm((f) => ({ ...f, reviewsPerDay: n }))}
          step={50}
          min={50}
          max={9999}
          unit="per day"
        />
        {hairline}
        <Stepper
          theme={theme}
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
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Daily goal ${p} cards`}
                style={{
                  flex: 1, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: active ? tints.attendance.fill : theme.surface,
                  borderWidth: 1, borderColor: active ? tints.attendance.line : theme.cardBorder,
                }}
              >
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 12, color: active ? tints.attendance.ink : theme.textSecondary }}>{p}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Text style={{ ...microLabel, marginBottom: 8 }}>Memory</Text>
      <View style={{ ...panel, padding: 14 }}>
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
                activeOpacity={0.75}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${c.label}, ${c.note}`}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: Radius.lg, alignItems: 'center',
                  backgroundColor: active ? tints.schedule.fill : theme.surface,
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
      </View>

      <TouchableOpacity
        onPress={() => setShowAdvanced((v) => !v)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: showAdvanced }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, marginBottom: 8 }}
      >
        <Text style={microLabel}>Advanced</Text>
        <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={13} color={theme.textTertiary} />
      </TouchableOpacity>
      {showAdvanced && (
        <View style={{ ...panel, padding: 14 }}>
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
        </View>
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
    </KeyboardSheet>
  );
}
