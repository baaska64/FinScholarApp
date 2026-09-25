import { getTints, getBrand } from '@/constants/Theme';
import { Rating } from './types';

/**
 * Anki's three queue colours, mapped onto the app's tints: new is blue, cards
 * being learned are orange, reviews are green. Every count on the study tab —
 * deck rows, the overview, the session counter — uses these, so a student
 * learns the code once and can read any number by its colour.
 */
export function queueTints(isDark: boolean) {
  const t = getTints(isDark);
  return { new: t.tools, learn: t.tasks, review: t.attendance };
}

/**
 * The same three colours, lightened to sit on the azure brand band, where the
 * tints' ink colours would drop below 3:1.
 */
export function queueOnBand(isDark: boolean) {
  return isDark
    ? { new: '#a6dcff', learn: '#ffd29a', review: '#9bf0c9' }
    : { new: '#c3e7ff', learn: '#ffdca8', review: '#b4f5d6' };
}

/** Again is red and Good is green in every flashcard app students have used. */
export function ratingTints(isDark: boolean): Record<Rating, { fill: string; line: string; ink: string; solid: string }> {
  const t = getTints(isDark);
  return { 1: t.danger, 2: t.tasks, 3: t.attendance, 4: t.tools };
}

export const RATING_LABELS: Record<Rating, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };

export { getBrand };
