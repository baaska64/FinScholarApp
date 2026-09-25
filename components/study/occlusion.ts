import { OcclusionData, OcclusionMask } from './types';

/**
 * Image occlusion, after Anki's built-in note type (rectangles and ovals,
 * "hide all, guess one" or "hide one, guess one", masks grouped into one card)
 * plus Quizlet's diagram idea of asking the other way round: show the name,
 * tap the place. Pure logic only; the editor and review card draw from here.
 */

/** "Where is it?" cards use ords above this, so they never collide with group numbers. */
export const LOCATE_ORD_BASE = 1000;

/** Smallest mask side, as a fraction of the image, so a stray tap never makes a sliver. */
export const MIN_MASK = 0.03;

export const isLocateOrd = (ord: number | undefined) => (ord || 0) > LOCATE_ORD_BASE;
export const groupOfOrd = (ord: number | undefined) => (isLocateOrd(ord) ? (ord as number) - LOCATE_ORD_BASE : ord || 0);

/** Distinct groups, ascending. Each is one "what is hidden here?" card. */
export function occlusionGroups(masks: OcclusionMask[]): number[] {
  return Array.from(new Set((masks || []).map((m) => m.group))).sort((a, b) => a - b);
}

/** The label a group answers to: its masks' labels, in drawing order, de-duplicated. */
export function groupLabel(masks: OcclusionMask[], group: number): string {
  const labels = (masks || []).filter((m) => m.group === group).map((m) => (m.label || '').trim()).filter(Boolean);
  return Array.from(new Set(labels)).join(', ');
}

/** Card ords for a note: every group, plus a locate card for each labelled group when asked for. */
export function occlusionOrds(data: OcclusionData | undefined | null): number[] {
  if (!data) return [];
  const groups = occlusionGroups(data.masks);
  const locate = data.locate ? groups.filter((g) => groupLabel(data.masks, g)).map((g) => LOCATE_ORD_BASE + g) : [];
  return [...groups, ...locate];
}

export type MaskState = 'target' | 'covered' | 'open' | 'revealed';

/**
 * How each mask draws on a card side.
 *   question: the asked group is 'target' (highlighted); others are 'covered'
 *             in hide-all mode and 'open' (not drawn) in hide-one mode.
 *   answer:   the asked group is 'revealed' (outlined, picture visible);
 *             the rest stay as they were, so the answer is read in context.
 * Locate cards keep every box covered (the question is the label, and the
 * printed labels would give it away); the answer opens the right box.
 */
export function maskStates(data: OcclusionData, ord: number, side: 'question' | 'answer'): Record<string, MaskState> {
  const out: Record<string, MaskState> = {};
  const group = groupOfOrd(ord);
  const locate = isLocateOrd(ord);
  for (const m of data.masks || []) {
    // Every box stays covered on a locate card: an uncovered labelled diagram
    // would print the answer right next to the question.
    if (locate) out[m.id] = side === 'answer' && m.group === group ? 'revealed' : 'covered';
    else if (m.group === group) out[m.id] = side === 'question' ? 'target' : 'revealed';
    else out[m.id] = data.mode === 'hideAll' ? 'covered' : 'open';
  }
  return out;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** A rectangle from two drag points, clamped into the image and kept above the minimum size. */
export function rectFromDrag(x0: number, y0: number, x1: number, y1: number): { x: number; y: number; w: number; h: number } | null {
  const ax = clamp01(Math.min(x0, x1));
  const ay = clamp01(Math.min(y0, y1));
  const bx = clamp01(Math.max(x0, x1));
  const by = clamp01(Math.max(y0, y1));
  if (bx - ax < MIN_MASK || by - ay < MIN_MASK) return null;
  return { x: ax, y: ay, w: bx - ax, h: by - ay };
}

/** Moves a mask by a delta, keeping it wholly inside the image. */
export function moveMask(m: OcclusionMask, dx: number, dy: number): OcclusionMask {
  return { ...m, x: clamp01(Math.min(1 - m.w, m.x + dx)), y: clamp01(Math.min(1 - m.h, m.y + dy)) };
}

/** Resizes from the bottom-right corner, never below the minimum or past the edge. */
export function resizeMask(m: OcclusionMask, dw: number, dh: number): OcclusionMask {
  return { ...m, w: Math.max(MIN_MASK, Math.min(1 - m.x, m.w + dw)), h: Math.max(MIN_MASK, Math.min(1 - m.y, m.h + dh)) };
}

/** Whether a point (0-1) falls on a mask, respecting its shape. */
export function hitTest(m: OcclusionMask, px: number, py: number): boolean {
  // NaN fails every comparison, so without this a missing coordinate would
  // "hit" the first rectangle it met.
  if (!Number.isFinite(px) || !Number.isFinite(py)) return false;
  if (px < m.x || px > m.x + m.w || py < m.y || py > m.y + m.h) return false;
  if (m.shape === 'rect') return true;
  const rx = m.w / 2;
  const ry = m.h / 2;
  const dx = (px - (m.x + rx)) / rx;
  const dy = (py - (m.y + ry)) / ry;
  return dx * dx + dy * dy <= 1;
}

/** The topmost mask under a point (later masks draw on top), or null. */
export function maskAt(masks: OcclusionMask[], px: number, py: number): OcclusionMask | null {
  for (let i = (masks || []).length - 1; i >= 0; i--) if (hitTest(masks[i], px, py)) return masks[i];
  return null;
}

/** A group number no mask uses yet. */
export function nextGroup(masks: OcclusionMask[]): number {
  return (masks || []).reduce((n, m) => Math.max(n, m.group), 0) + 1;
}

/** Puts the given masks into one group (the lowest of theirs), so they become one card. */
export function groupMasks(masks: OcclusionMask[], ids: string[]): OcclusionMask[] {
  const chosen = masks.filter((m) => ids.includes(m.id));
  if (chosen.length < 2) return masks;
  const g = Math.min(...chosen.map((m) => m.group));
  return masks.map((m) => (ids.includes(m.id) ? { ...m, group: g } : m));
}

/** Gives each of the given masks its own new group again. */
export function ungroupMasks(masks: OcclusionMask[], ids: string[]): OcclusionMask[] {
  let g = nextGroup(masks);
  return masks.map((m) => (ids.includes(m.id) ? { ...m, group: g++ } : m));
}

/**
 * Renumbers groups 1..n in the order they were first drawn. Editing keeps each
 * group's number (so its card keeps its schedule); this is only for a note
 * being created, where there is no schedule to keep.
 */
export function compactGroups(masks: OcclusionMask[]): OcclusionMask[] {
  const map = new Map<number, number>();
  for (const m of masks) if (!map.has(m.group)) map.set(m.group, map.size + 1);
  return masks.map((m) => ({ ...m, group: map.get(m.group)! }));
}

/** Why an occlusion note cannot be saved, or null when it can. */
export function validateOcclusion(data: OcclusionData | undefined | null): string | null {
  if (!data || !data.imageId) return 'Pick an image first.';
  if (!data.masks || data.masks.length === 0) return 'Draw at least one box over something to hide.';
  if (data.locate && !data.masks.some((m) => (m.label || '').trim())) return 'To quiz yourself the other way, name at least one box (tap it, then fill in "Name of what\'s hidden"), or turn that option off.';
  return null;
}
