import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { FaceSegment } from './types';

interface FaceTextProps {
  segments: FaceSegment[];
  /** Deck colour — hidden and revealed cloze deletions are drawn in it. */
  color: string;
  isDark: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/**
 * A card face as one `Text`, so a sentence with a blank in it wraps as a
 * sentence. Deletions are nested spans: a hidden one reads as a coloured
 * `[...]`, a revealed one as the answer in the deck colour on a soft wash —
 * the in-place highlight Anki uses on the back of a cloze card.
 */
/**
 * Deck colours are picked for light surfaces; the indigo and violet ones drop
 * to ~2.5:1 on the dark card. Mixing 45% white back in keeps the hue and
 * clears 4.5:1, so a hidden word is still the most legible thing on the card.
 */
function onDark(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.45);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export default function FaceText({ segments, color: base, isDark, style, numberOfLines }: FaceTextProps) {
  const color = isDark ? onDark(base) : base;
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((seg, i) =>
        seg.style === 'plain' ? (
          <Text key={i}>{seg.text}</Text>
        ) : (
          <Text
            key={i}
            style={{
              color,
              fontFamily: 'Nunito_900Black',
              backgroundColor: seg.style === 'hl' ? color + (isDark ? '33' : '1f') : undefined,
            }}
          >
            {seg.style === 'hl' ? ` ${seg.text} ` : seg.text}
          </Text>
        )
      )}
    </Text>
  );
}
