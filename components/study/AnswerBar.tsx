import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius } from '@/constants/Theme';
import AnimatedPressable from '@/components/ui/AnimatedPressable';
import { Rating } from './types';
import { ratingTints, RATING_LABELS } from './studyTheme';

interface AnswerBarProps {
  revealed: boolean;
  onShow: () => void;
  onRate: (g: Rating) => void;
  /** Next interval per button, e.g. `{1:'1m', 2:'6m', 3:'10m', 4:'8d'}`. */
  previews: Record<Rating, string> | null;
  color: string;
  isDark: boolean;
  /** Cram sessions do not reschedule, so they only ask "again, or got it". */
  cram?: boolean;
  checkLabel?: string;
}

/**
 * The one control area of a review. Before the answer it is a single wide
 * "Show answer" — the same place every time, so the thumb learns it. After,
 * it becomes Anki's four buttons with the interval each one sets printed on
 * it, which is what makes the grades mean something: "Good" is not a feeling,
 * it is "see this again in 13 days".
 */
export default function AnswerBar({ revealed, onShow, onRate, previews, color, isDark, cram, checkLabel }: AnswerBarProps) {
  const rt = ratingTints(isDark);

  if (!revealed) {
    return (
      <AnimatedPressable
        onPress={onShow}
        accessibilityRole="button"
        accessibilityLabel={checkLabel || 'Show answer'}
        style={{
          height: 58,
          borderRadius: Radius.xl,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          backgroundColor: color,
          borderBottomWidth: 3,
          borderBottomColor: 'rgba(0,0,0,0.25)',
        }}
      >
        <Ionicons name={checkLabel ? 'checkmark-done' : 'eye-outline'} size={19} color="#ffffff" />
        <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 16.5, color: '#ffffff' }}>{checkLabel || 'Show answer'}</Text>
      </AnimatedPressable>
    );
  }

  const buttons: Rating[] = cram ? [1, 3] : [1, 2, 3, 4];

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {buttons.map((g) => {
        const tint = rt[g];
        const sub = cram ? (g === 1 ? 'see again' : 'got it') : previews?.[g] || '';
        return (
          <AnimatedPressable
            key={g}
            onPress={() => onRate(g)}
            accessibilityRole="button"
            accessibilityLabel={cram ? `${RATING_LABELS[g]}, ${sub}` : `${RATING_LABELS[g]}, next review in ${sub}`}
            style={{
              flex: 1,
              height: 58,
              borderRadius: Radius.xl,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tint.fill,
              borderWidth: 1,
              borderColor: tint.line,
              borderBottomWidth: 3,
              borderBottomColor: tint.line,
            }}
          >
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: tint.ink, opacity: 0.85 }}>{sub}</Text>
            <Text style={{ fontFamily: 'Nunito_900Black', fontSize: 15, color: tint.ink, marginTop: 1 }}>{RATING_LABELS[g]}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}
