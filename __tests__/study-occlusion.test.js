import assert from 'node:assert';
import {
  LOCATE_ORD_BASE, occlusionGroups, groupLabel, occlusionOrds, maskStates, rectFromDrag, moveMask, resizeMask,
  hitTest, maskAt, nextGroup, groupMasks, ungroupMasks, compactGroups, validateOcclusion, isLocateOrd, groupOfOrd,
} from '../components/study/occlusion.ts';
import { buildNoteCards, cardFaces, cardQA, validateNote, notePreview, groupNotes } from '../components/study/notes.ts';
import { buildQueue, deckDueCounts, DEFAULT_SR_SETTINGS } from '../components/study/scheduler.ts';

const mask = (id, group, extra = {}) => ({ id, shape: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.2, group, ...extra });
const data = (masks, extra = {}) => ({ imageId: 'img1', width: 800, height: 600, mode: 'hideAll', masks, ...extra });
let n = 0;
const makeId = () => `id${++n}`;

export function runStudyOcclusionTests(describe, test) {
  describe('Image Occlusion Suite 1: Cards from masks', () => {
    test('IO1.0 every box and every find-it card is queued in one session', () => {
      const d = data([mask('a', 1, { label: 'Aorta' }), mask('b', 2, { label: 'Atrium' }), mask('c', 3)], { locate: true });
      const cards = buildNoteCards({ kind: 'occlusion', front: 'Heart', back: '', occlusion: d }, [], makeId, 0);
      assert.strictEqual(cards.length, 5, 'three boxes plus two named find-it cards');
      const deck = { id: 'dk', name: 'D', subject: '', color: '#000', createdAt: 0, cards };
      assert.strictEqual(deckDueCounts(deck, DEFAULT_SR_SETTINGS, 1000).new, 5);
      assert.strictEqual(buildQueue([deck], null, DEFAULT_SR_SETTINGS, 1000).length, 5);
    });

    test('IO1.1 One card per group, grouped masks share a card', () => {
      const d = data([mask('a', 1), mask('b', 2), mask('c', 2)]);
      assert.deepStrictEqual(occlusionOrds(d), [1, 2]);
    });

    test('IO1.2 Locate cards are added only for labelled groups, above the base', () => {
      const d = data([mask('a', 1, { label: 'Aorta' }), mask('b', 2)], { locate: true });
      assert.deepStrictEqual(occlusionOrds(d), [1, 2, LOCATE_ORD_BASE + 1]);
      assert.ok(isLocateOrd(LOCATE_ORD_BASE + 1) && !isLocateOrd(1));
      assert.strictEqual(groupOfOrd(LOCATE_ORD_BASE + 1), 1);
    });

    test('IO1.3 A group label joins its masks labels once each', () => {
      const ms = [mask('a', 1, { label: 'Atrium' }), mask('b', 1, { label: 'Atrium' }), mask('c', 1, { label: 'Valve' })];
      assert.strictEqual(groupLabel(ms, 1), 'Atrium, Valve');
      assert.deepStrictEqual(occlusionGroups(ms), [1]);
    });

    test('IO1.4 buildNoteCards makes the cards and keeps a group schedule across edits', () => {
      const d1 = data([mask('a', 1), mask('b', 2)]);
      const cards = buildNoteCards({ kind: 'occlusion', front: 'Heart', back: '', occlusion: d1 }, [], makeId, 0);
      assert.deepStrictEqual(cards.map((c) => c.ord), [1, 2]);
      cards[1].reviewCount = 5;
      const d2 = data([mask('b', 2), mask('c', 3)]);
      const next = buildNoteCards({ kind: 'occlusion', front: 'Heart', back: '', occlusion: d2 }, cards, makeId, 0);
      assert.deepStrictEqual(next.map((c) => c.ord), [2, 3], 'group 1 removed, group 3 added');
      assert.strictEqual(next[0].reviewCount, 5, 'group 2 kept its progress');
      assert.strictEqual(next[0].occlusion.masks.length, 2, 'every card carries the note data');
    });

    test('IO1.5 Validation needs an image and a mask, and a label when locate is on', () => {
      assert.match(validateOcclusion(null), /image/);
      assert.match(validateOcclusion(data([])), /Draw/);
      assert.match(validateOcclusion(data([mask('a', 1)], { locate: true })), /name at least one box/i);
      assert.strictEqual(validateOcclusion(data([mask('a', 1)])), null);
      assert.strictEqual(validateNote({ kind: 'occlusion', front: '', back: '', occlusion: data([mask('a', 1)]) }), null);
    });

    test('IO1.6 Image cards stay out of text-only modes and read sensibly as text', () => {
      const [c] = buildNoteCards({ kind: 'occlusion', front: 'Label the heart', back: 'Chapter 3', occlusion: data([mask('a', 1, { label: 'Aorta' })], { locate: true }) }, [], makeId, 0);
      assert.deepStrictEqual(cardQA(c), { question: '', answer: '' });
      const f = cardFaces(c);
      assert.strictEqual(f.question[0].text, 'Label the heart');
      assert.strictEqual(f.answer[0].text, 'Aorta');
      assert.strictEqual(f.extra, 'Chapter 3');
      const loc = buildNoteCards({ kind: 'occlusion', front: '', back: '', occlusion: data([mask('a', 1, { label: 'Aorta' })], { locate: true }) }, [], makeId, 0)[1];
      assert.strictEqual(cardFaces(loc).question[0].text, 'Find Aorta');
      const row = groupNotes([c])[0];
      assert.match(notePreview(row).sub, /1 hidden part/);
    });
  });

  describe('Image Occlusion Suite 2: What each side shows', () => {
    const d = data([mask('a', 1), mask('b', 2), mask('c', 2)]);

    test('IO2.1 Hide all, guess one: the asked group is the target, the rest stay covered', () => {
      assert.deepStrictEqual(maskStates(d, 2, 'question'), { a: 'covered', b: 'target', c: 'target' });
      assert.deepStrictEqual(maskStates(d, 2, 'answer'), { a: 'covered', b: 'revealed', c: 'revealed' });
    });

    test('IO2.2 Hide one, guess one: only the asked group is covered', () => {
      const h = { ...d, mode: 'hideOne' };
      assert.deepStrictEqual(maskStates(h, 1, 'question'), { a: 'target', b: 'open', c: 'open' });
    });

    test('IO2.3 A locate card keeps every box covered, whatever the mode, and opens the right one on the answer', () => {
      for (const mode of ['hideAll', 'hideOne']) {
        const dd = { ...d, mode };
        assert.deepStrictEqual(maskStates(dd, LOCATE_ORD_BASE + 2, 'question'), { a: 'covered', b: 'covered', c: 'covered' }, 'no target highlight either: that would point at the answer');
        assert.deepStrictEqual(maskStates(dd, LOCATE_ORD_BASE + 2, 'answer'), { a: 'covered', b: 'revealed', c: 'revealed' });
      }
    });
  });

  describe('Image Occlusion Suite 3: Drawing', () => {
    test('IO3.1 A drag in any direction makes a clamped rectangle; a tap makes none', () => {
      assert.deepStrictEqual(rectFromDrag(0.5, 0.5, 0.2, 0.3), { x: 0.2, y: 0.3, w: 0.3, h: 0.2 });
      const edge = rectFromDrag(0.9, 0.9, 1.4, 1.2);
      assert.ok(Math.abs(edge.w - 0.1) < 1e-9 && edge.x + edge.w <= 1, 'a drag past the edge is clamped to it');
      assert.strictEqual(rectFromDrag(0.99, 0.5, 1.4, 0.9), null, 'clamped down to a sliver, so dropped');
      assert.strictEqual(rectFromDrag(0.5, 0.5, 0.51, 0.51), null);
    });

    test('IO3.2 Moving and resizing keep the mask inside the image and above the minimum', () => {
      const m = mask('a', 1, { x: 0.7, y: 0.7, w: 0.2, h: 0.2 });
      const moved = moveMask(m, 0.5, -1);
      assert.deepStrictEqual([moved.x, moved.y], [0.8, 0]);
      const r = resizeMask(m, 1, -1);
      assert.ok(Math.abs(r.w - 0.3) < 1e-9 && Math.abs(r.h - 0.03) < 1e-9);
    });

    test('IO3.3 Hit testing respects the oval shape and picks the topmost mask', () => {
      const oval = mask('o', 1, { shape: 'ellipse', x: 0, y: 0, w: 1, h: 1 });
      assert.ok(hitTest(oval, 0.5, 0.5));
      assert.ok(!hitTest(oval, 0.05, 0.05), 'the corner of the box is outside the oval');
      const under = mask('u', 1, { x: 0, y: 0, w: 1, h: 1 });
      const over = mask('v', 2, { x: 0.4, y: 0.4, w: 0.2, h: 0.2 });
      assert.strictEqual(maskAt([under, over], 0.5, 0.5).id, 'v');
      assert.strictEqual(maskAt([under, over], 0.1, 0.1).id, 'u');
      assert.strictEqual(maskAt([over], 0.1, 0.1), null);
      assert.strictEqual(maskAt([under, over], NaN, NaN), null, 'a missing tap coordinate hits nothing');
      assert.strictEqual(hitTest(under, undefined, 0.5), false);
    });

    test('IO3.4 Grouping, ungrouping and compacting', () => {
      const ms = [mask('a', 1), mask('b', 2), mask('c', 3)];
      assert.strictEqual(nextGroup(ms), 4);
      const g = groupMasks(ms, ['b', 'c']);
      assert.deepStrictEqual(g.map((m) => m.group), [1, 2, 2]);
      assert.deepStrictEqual(groupMasks(ms, ['a']), ms, 'one mask is not a group');
      const u = ungroupMasks(g, ['b', 'c']);
      assert.deepStrictEqual(u.map((m) => m.group), [1, 3, 4]);
      assert.deepStrictEqual(compactGroups(u).map((m) => m.group), [1, 2, 3]);
    });
  });
}
