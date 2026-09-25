import assert from 'node:assert';
import {
  DEFAULT_SR_SETTINGS,
  makeNewCard,
  applyRating,
  answerCard,
  previewIntervals,
  formatInterval,
  studyDayKey,
  studyDayStart,
  memoryFromSm2,
  cardState,
  deckDueCounts,
  buildQueue,
  pickNext,
  sessionRemaining,
  burySiblings,
  unburySiblings,
  resolveSettings,
  isBuried,
  bumpDaily,
  newLimitLeft,
  examDaysLeft,
  intervalCap,
  planExamReschedule,
  composition,
  forecast,
  parseSteps,
  recordAnswer,
  updateStudyStats,
  trueRetention,
  parseImportNotes,
  // notes
  parseCloze,
  clozeNumbers,
  renderCloze,
  clozeAnswer,
  clozeOverview,
  wrapCloze,
  buildNoteCards,
  replaceNote,
  groupNotes,
  validateNote,
  cardFaces,
  cardQA,
  typeDiff,
  typedMatches,
  SAMPLE_NOTES,
} from '../components/study/utils.ts';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
// Wednesday 23 Sep 2026, 2 PM local.
const T = new Date(2026, 8, 23, 14, 0).getTime();

let seq = 0;
const mkId = () => `id${++seq}`;

const card = (over = {}) => ({ ...makeNewCard('Q', 'A'), id: mkId(), ...over });
const review = (over = {}) =>
  card({ state: 'review', reviewCount: 3, interval: 5, stability: 5, difficulty: 5, lastReview: T - 5 * DAY, nextDue: T - HOUR, ...over });
const deck = (cards, over = {}) => ({ id: over.id || mkId(), name: 'D', subject: '', color: '#3b82f6', createdAt: 0, cards, ...over });

export function runStudyAnkiTests(describe, test) {
  describe('Study Anki Suite 1: Study days, intervals and previews', () => {
    test('A1.1 the study day rolls over at 4 AM, not midnight', () => {
      assert.strictEqual(studyDayKey(new Date(2026, 8, 23, 3, 59).getTime()), '2026-09-22');
      assert.strictEqual(studyDayKey(new Date(2026, 8, 23, 4, 0).getTime()), '2026-09-23');
      assert.strictEqual(studyDayKey(new Date(2026, 8, 23, 23, 30).getTime()), '2026-09-23');
      const tomorrow = new Date(studyDayStart(T, 1));
      assert.strictEqual(tomorrow.getDate(), 24);
      assert.strictEqual(tomorrow.getHours(), 4);
    });

    test('A1.2 a card answered late at night is not due again before 4 AM', () => {
      const late = new Date(2026, 8, 23, 23, 30).getTime();
      let c = card();
      c = applyRating(c, 3, DEFAULT_SR_SETTINGS, late);
      c = applyRating(c, 3, DEFAULT_SR_SETTINGS, late + 11 * MIN);
      assert.strictEqual(c.state, 'review');
      assert.ok(c.nextDue >= new Date(2026, 8, 24, 4, 0).getTime());
    });

    test('A1.3 formatInterval uses Anki\'s compact units', () => {
      assert.strictEqual(formatInterval(1), '1m');
      assert.strictEqual(formatInterval(5.5), '6m');
      assert.strictEqual(formatInterval(90), '1.5h');
      assert.strictEqual(formatInterval(3 * 1440), '3d');
      assert.strictEqual(formatInterval(45 * 1440), '1.5mo');
      assert.strictEqual(formatInterval(730 * 1440), '2y');
    });

    test('A1.4 a new card previews 1m / 6m / 10m / days, like Anki with default steps', () => {
      const p = previewIntervals(card(), DEFAULT_SR_SETTINGS, T);
      assert.strictEqual(p[1], '1m');
      assert.strictEqual(p[2], '6m');
      assert.strictEqual(p[3], '10m');
      assert.match(p[4], /^\d+d$/);
    });

    test('A1.5 the interval printed on a button is the interval that button applies', () => {
      for (let i = 0; i < 25; i++) {
        const c = review({ interval: 3 + i * 7, stability: 3 + i * 7, lastReview: T - (3 + i * 7) * DAY });
        const p = previewIntervals(c, DEFAULT_SR_SETTINGS, T);
        for (const g of [2, 3, 4]) {
          const res = answerCard(c, g, DEFAULT_SR_SETTINGS, T);
          assert.strictEqual(formatInterval(res.intervalDays * 1440), p[g], `card ${i}, rating ${g}`);
        }
      }
    });

    test('A1.6 parseSteps reads minutes and accepts h / d suffixes', () => {
      assert.deepStrictEqual(parseSteps('1 10', [9]), [1, 10]);
      assert.deepStrictEqual(parseSteps('10m 1h 1d', [9]), [10, 60, 1440]);
      assert.deepStrictEqual(parseSteps('junk -3 0', [9]), []);
      assert.deepStrictEqual(parseSteps(undefined, [9]), [9]);
    });

    test('A1.7 a higher target retention schedules sooner', () => {
      const c = review({ interval: 20, stability: 20, lastReview: T - 20 * DAY });
      const relaxed = answerCard(c, 3, { ...DEFAULT_SR_SETTINGS, desiredRetention: 0.8 }, T).intervalDays;
      const strict = answerCard(c, 3, { ...DEFAULT_SR_SETTINGS, desiredRetention: 0.95 }, T).intervalDays;
      assert.ok(strict < relaxed, `${strict} should be shorter than ${relaxed}`);
    });

    test('A1.8 the maximum interval caps every answer', () => {
      const c = review({ interval: 300, stability: 5000, lastReview: T - 300 * DAY });
      const res = answerCard(c, 4, { ...DEFAULT_SR_SETTINGS, maximumInterval: 60 }, T);
      assert.ok(res.intervalDays <= 60);
    });
  });

  describe('Study Anki Suite 2: Migrating SM-2 cards', () => {
    test('A2.1 memoryFromSm2 keeps the interval as stability and maps ease to difficulty', () => {
      const easy = memoryFromSm2(3.0, 30);
      const hard = memoryFromSm2(1.3, 30);
      assert.strictEqual(easy.stability, 30);
      assert.ok(easy.difficulty < hard.difficulty, 'a higher ease is an easier card');
      assert.ok(hard.difficulty <= 10 && easy.difficulty >= 1);
    });

    test('A2.2 a legacy card is read as review and keeps its progress', () => {
      const legacy = { id: 'L', front: 'q', back: 'a', interval: 30, easeFactor: 2.5, nextDue: T - 1000, reviewCount: 6 };
      assert.strictEqual(cardState(legacy), 'review');
      const res = answerCard(legacy, 3, DEFAULT_SR_SETTINGS, T);
      assert.ok(res.intervalDays > 30, `good on a 30-day card went to ${res.intervalDays}`);
      assert.ok(res.card.stability > 0 && res.card.difficulty > 0);
    });

    test('A2.3 cardState maps the old fields exactly as the old badges did', () => {
      assert.strictEqual(cardState({ id: 'a', front: '', back: '', interval: 0, easeFactor: 2.5, nextDue: 0, reviewCount: 0 }), 'new');
      assert.strictEqual(cardState({ id: 'b', front: '', back: '', interval: 0, easeFactor: 2.5, nextDue: 0, reviewCount: 2 }), 'learning');
      assert.strictEqual(cardState({ id: 'c', front: '', back: '', interval: 4, easeFactor: 2.5, nextDue: 0, reviewCount: 2 }), 'review');
    });
  });

  describe('Study Anki Suite 3: Cloze', () => {
    test('A3.1 numbers, hints and nesting parse', () => {
      assert.deepStrictEqual(clozeNumbers('{{c1::Paris}} is in {{c2::France}}, {{c1::yes}}'), [1, 2]);
      assert.deepStrictEqual(clozeNumbers('{{c1::Canberra was {{c2::founded}}}} in 1913'), [1, 2]);
      assert.deepStrictEqual(clozeNumbers('no deletions here'), []);
      const nodes = parseCloze('{{c3::mitochondria::organelle}}');
      assert.strictEqual(nodes[0].t, 'cloze');
      assert.strictEqual(nodes[0].ord, 3);
      assert.strictEqual(nodes[0].hint, 'organelle');
    });

    test('A3.2 malformed syntax stays literal instead of swallowing the note', () => {
      assert.deepStrictEqual(clozeNumbers('broken {{c1::open'), []);
      const segs = renderCloze('broken {{c1::open and text', 1, 'question');
      assert.strictEqual(segs.map((s) => s.text).join(''), 'broken {{c1::open and text');
    });

    test('A3.3 the question hides only the active deletion; the answer highlights it', () => {
      const src = 'The {{c1::heart}} has {{c2::four}} chambers';
      const q1 = renderCloze(src, 1, 'question');
      assert.strictEqual(q1.map((s) => s.text).join(''), 'The [...] has four chambers');
      assert.deepStrictEqual(q1.filter((s) => s.style === 'blank').map((s) => s.text), ['[...]']);
      const a1 = renderCloze(src, 1, 'answer');
      assert.deepStrictEqual(a1.filter((s) => s.style === 'hl').map((s) => s.text), ['heart']);
      assert.strictEqual(renderCloze('{{c1::x::hint here}}', 1, 'question')[0].text, '[hint here]');
    });

    test('A3.4 nested deletions blank correctly from either side', () => {
      const src = '{{c1::Canberra was {{c2::founded}}}} in 1913';
      assert.strictEqual(renderCloze(src, 2, 'question').map((s) => s.text).join(''), 'Canberra was [...] in 1913');
      assert.strictEqual(renderCloze(src, 1, 'question').map((s) => s.text).join(''), '[...] in 1913');
      assert.strictEqual(clozeAnswer(src, 1), 'Canberra was founded');
    });

    test('A3.5 wrapCloze numbers a new card, or reuses the last number for the same card', () => {
      const first = wrapCloze('Paris is the capital of France', 0, 5);
      assert.strictEqual(first.text, '{{c1::Paris}} is the capital of France');
      assert.strictEqual(first.ord, 1);
      const len = first.text.length;
      const second = wrapCloze(first.text, len - 6, len, false);
      assert.ok(second.text.endsWith('{{c2::France}}'));
      const same = wrapCloze(first.text, len - 6, len, true);
      assert.ok(same.text.endsWith('{{c1::France}}'));
      assert.deepStrictEqual(clozeNumbers(same.text), [1]);
    });

    test('A3.6 clozeOverview shows every deletion as highlighted text', () => {
      const segs = clozeOverview('{{c1::A}} and {{c2::B}}');
      assert.deepStrictEqual(segs.filter((s) => s.style === 'hl').map((s) => s.text), ['A', 'B']);
    });
  });

  describe('Study Anki Suite 4: Notes and their cards', () => {
    test('A4.1 each note type makes the right number of cards, siblings sharing a note id', () => {
      assert.strictEqual(buildNoteCards({ kind: 'basic', front: 'a', back: 'b' }, [], mkId, T).length, 1);
      const rev = buildNoteCards({ kind: 'reversed', front: 'a', back: 'b' }, [], mkId, T);
      assert.strictEqual(rev.length, 2);
      assert.strictEqual(rev[0].noteId, rev[1].noteId);
      assert.deepStrictEqual(rev.map((c) => c.ord), [0, 1]);
      const cz = buildNoteCards({ kind: 'cloze', front: '{{c1::a}} {{c2::b}} {{c3::c}}', back: '' }, [], mkId, T);
      assert.deepStrictEqual(cz.map((c) => c.ord), [1, 2, 3]);
      assert.ok(cz.every((c) => c.state === 'new'));
    });

    test('A4.2 editing a cloze keeps progress, adds new blanks and drops deleted ones', () => {
      const original = buildNoteCards({ kind: 'cloze', front: '{{c1::a}} {{c2::b}}', back: '' }, [], mkId, T);
      const studied = original.map((c) => (c.ord === 1 ? applyRating(c, 4, DEFAULT_SR_SETTINGS, T) : c));
      const edited = buildNoteCards({ kind: 'cloze', front: '{{c1::a!}} {{c3::c}}', back: 'x' }, studied, mkId, T);
      assert.deepStrictEqual(edited.map((c) => c.ord), [1, 3]);
      const c1 = edited.find((c) => c.ord === 1);
      assert.strictEqual(c1.id, studied.find((c) => c.ord === 1).id);
      assert.strictEqual(c1.state, 'review', 'the edited card kept its schedule');
      assert.strictEqual(c1.front, '{{c1::a!}} {{c3::c}}');
      assert.strictEqual(edited.find((c) => c.ord === 3).state, 'new');
    });

    test('A4.3 a legacy card becomes the first card of its note when turned two-way', () => {
      const legacy = { id: 'old', front: 'Q', back: 'A', interval: 12, easeFactor: 2.5, nextDue: T, reviewCount: 4 };
      const next = buildNoteCards({ kind: 'reversed', front: 'Q', back: 'A' }, [legacy], mkId, T);
      assert.strictEqual(next[0].id, 'old');
      assert.strictEqual(next[0].interval, 12);
      assert.strictEqual(next[0].noteId, 'old');
      assert.strictEqual(next[1].noteId, 'old');
      assert.strictEqual(cardState(next[1]), 'new');
    });

    test('A4.4 replaceNote keeps the note where it was in the list', () => {
      const a = card({ noteId: 'n1' });
      const b1 = card({ noteId: 'n2', ord: 0 });
      const b2 = card({ noteId: 'n2', ord: 1 });
      const c = card({ noteId: 'n3' });
      const nb = card({ noteId: 'n2', ord: 0 });
      const out = replaceNote([a, b1, b2, c], 'n2', [nb]);
      assert.deepStrictEqual(out.map((x) => x.id), [a.id, nb.id, c.id]);
      assert.strictEqual(groupNotes(out).length, 3);
    });

    test('A4.5 validateNote explains what is missing', () => {
      assert.match(validateNote({ kind: 'basic', front: 'a', back: '' }), /both/);
      assert.match(validateNote({ kind: 'cloze', front: 'no blanks', back: '' }), /Hide at least one/);
      assert.strictEqual(validateNote({ kind: 'cloze', front: '{{c1::x}}', back: '' }), null);
    });

    test('A4.6 faces: reversed ord 1 asks the back; flip swaps; cloze ignores flip', () => {
      const [fwd, back] = buildNoteCards({ kind: 'reversed', front: 'Hund', back: 'dog' }, [], mkId, T);
      assert.strictEqual(cardFaces(fwd).question[0].text, 'Hund');
      assert.strictEqual(cardFaces(back).question[0].text, 'dog');
      assert.strictEqual(cardFaces(fwd, true).question[0].text, 'dog');
      const [cz] = buildNoteCards({ kind: 'cloze', front: 'A {{c1::b}}', back: 'extra' }, [], mkId, T);
      assert.strictEqual(cardFaces(cz, true).question.map((s) => s.text).join(''), 'A [...]');
      assert.strictEqual(cardFaces(cz).extra, 'extra');
    });

    test('A4.7 cardQA gives practice modes plain strings for every type', () => {
      const [cz] = buildNoteCards({ kind: 'cloze', front: 'The {{c1::heart}} pumps', back: '' }, [], mkId, T);
      assert.deepStrictEqual(cardQA(cz), { question: 'The [...] pumps', answer: 'heart' });
      const [ti] = buildNoteCards({ kind: 'typein', front: 'Capital of Japan?', back: 'Tokyo' }, [], mkId, T);
      assert.deepStrictEqual(cardQA(ti), { question: 'Capital of Japan?', answer: 'Tokyo' });
      assert.strictEqual(cardFaces(ti).typeTarget, 'Tokyo');
    });

    test('A4.8 type-in comparison marks right, wrong and missing characters', () => {
      assert.ok(typedMatches('  tokyo ', 'Tokyo'));
      assert.ok(!typedMatches('', 'Tokyo'));
      const d = typeDiff('Tokio', 'Tokyo');
      assert.deepStrictEqual(d.typed, [
        { text: 'Tok', kind: 'good' },
        { text: 'i', kind: 'bad' },
        { text: 'o', kind: 'good' },
      ]);
      assert.deepStrictEqual(d.expected, [
        { text: 'Tok', kind: 'good' },
        { text: 'y', kind: 'missed' },
        { text: 'o', kind: 'good' },
      ]);
    });

    test('A4.9 the sample deck teaches every note type', () => {
      const kinds = new Set(SAMPLE_NOTES.map((n) => n.kind));
      assert.deepStrictEqual([...kinds].sort(), ['basic', 'cloze', 'reversed', 'typein']);
      assert.ok(SAMPLE_NOTES.every((n) => validateNote(n) === null));
    });
  });

  describe('Study Anki Suite 5: Daily limits, queues and sessions', () => {
    test('A5.1 new cards are capped at the daily limit; one per note only with burying on', () => {
      const cards = [];
      for (let i = 0; i < 30; i++) cards.push(card());
      const twoWay = buildNoteCards({ kind: 'reversed', front: 'a', back: 'b' }, [], mkId, T);
      const d = deck([...cards, ...twoWay]);
      assert.strictEqual(deckDueCounts(d, DEFAULT_SR_SETTINGS, T).new, 20);
      const small = deck(twoWay);
      assert.strictEqual(deckDueCounts(small, DEFAULT_SR_SETTINGS, T).new, 2, 'both directions count today by default');
      assert.strictEqual(deckDueCounts(small, { ...DEFAULT_SR_SETTINGS, burySiblings: true }, T).new, 1, 'with burying on, siblings wait for tomorrow');
    });

    test('A5.2 answering counts against today, and a new day resets it', () => {
      let d = deck([card(), card(), card()]);
      d = bumpDaily(d, 'new', T);
      d = bumpDaily(d, 'new', T);
      assert.strictEqual(newLimitLeft(d, { ...DEFAULT_SR_SETTINGS, newPerDay: 2 }, T), 0);
      assert.strictEqual(newLimitLeft(d, { ...DEFAULT_SR_SETTINGS, newPerDay: 2 }, T + DAY), 2);
      d = { ...d, daily: { ...d.daily, newBonus: 10 } };
      assert.strictEqual(newLimitLeft(d, { ...DEFAULT_SR_SETTINGS, newPerDay: 2 }, T), 10);
    });

    test('A5.3 learning, review and suspended/buried cards are counted correctly', () => {
      const d = deck([
        review(),
        review({ nextDue: T + 3 * DAY }),
        card({ state: 'learning', reviewCount: 1, nextDue: T + 5 * MIN, stability: 1, difficulty: 5 }),
        review({ suspended: true }),
        review({ buriedUntil: studyDayKey(T + DAY) }),
        card(),
      ]);
      assert.deepStrictEqual(deckDueCounts(d, DEFAULT_SR_SETTINGS, T), { new: 1, learn: 1, review: 1 });
    });

    test('A5.4 the queue puts reviews first by due date and mixes new cards in', () => {
      const r1 = review({ nextDue: T - 3 * DAY });
      const r2 = review({ nextDue: T - DAY });
      const n1 = card({ createdAt: 1 });
      const n2 = card({ createdAt: 2 });
      const d = deck([n2, r2, n1, r1]);
      const q = buildQueue([d], null, DEFAULT_SR_SETTINGS, T);
      const ids = q.map((x) => x.cardId);
      assert.strictEqual(ids.length, 4);
      assert.ok(ids.indexOf(r1.id) < ids.indexOf(r2.id), 'the most overdue review comes first');
      assert.ok(ids.indexOf(n1.id) < ids.indexOf(n2.id), 'new cards in the order they were added');
    });

    test('A5.5 pickNext shows due learning cards first, then the queue, then learns ahead', () => {
      const learning = card({ state: 'learning', reviewCount: 1, nextDue: T - MIN, stability: 1, difficulty: 5 });
      const r = review();
      const d = deck([learning, r]);
      const q = buildQueue([d], null, DEFAULT_SR_SETTINGS, T);
      assert.strictEqual(pickNext([d], null, q, 0, T).ref.cardId, learning.id);

      const later = card({ state: 'learning', reviewCount: 1, nextDue: T + 8 * MIN, stability: 1, difficulty: 5 });
      const d2 = deck([later]);
      const ahead = pickNext([d2], null, [], 0, T);
      assert.strictEqual(ahead.ref.cardId, later.id, 'within 20 minutes it is shown rather than ending the session');

      const muchLater = card({ state: 'learning', reviewCount: 1, nextDue: T + 45 * MIN, stability: 1, difficulty: 5 });
      const wait = pickNext([deck([muchLater])], null, [], 0, T);
      assert.strictEqual(wait.ref, null);
      assert.strictEqual(wait.nextLearningAt, muchLater.nextDue);
    });

    test('A5.6 cards suspended mid-session are skipped', () => {
      const a = review();
      const b = review();
      const d = deck([a, b]);
      const q = buildQueue([d], null, DEFAULT_SR_SETTINGS, T);
      const d2 = { ...d, cards: d.cards.map((c) => (c.id === q[0].cardId ? { ...c, suspended: true } : c)) };
      const pick = pickNext([d2], null, q, 0, T);
      assert.strictEqual(pick.ref.cardId, q[1].cardId);
    });

    test('A5.7 answering a card buries its new and due siblings until tomorrow', () => {
      const [fwd, back] = buildNoteCards({ kind: 'reversed', front: 'a', back: 'b' }, [], mkId, T);
      const answered = applyRating(fwd, 3, DEFAULT_SR_SETTINGS, T);
      const out = burySiblings([answered, back], answered, T);
      assert.strictEqual(out[1].buriedUntil, studyDayKey(T + DAY));
      assert.strictEqual(deckDueCounts(deck(out), DEFAULT_SR_SETTINGS, T).new, 0);
      assert.strictEqual(deckDueCounts(deck(out), DEFAULT_SR_SETTINGS, T + DAY).new, 1);
    });

    test('A5.7b with burying on, a three-cloze note gives c1 today and the rest on later days — none is lost', () => {
      const on = { ...DEFAULT_SR_SETTINGS, burySiblings: true };
      const cz = buildNoteCards({ kind: 'cloze', front: '{{c1::A}} {{c2::B}} {{c3::C}}', back: '' }, [], mkId, T);
      assert.strictEqual(cz.length, 3);
      let d = deck(cz);
      let q = buildQueue([d], null, on, T);
      assert.strictEqual(q.length, 1, 'one card of the note per day');
      const first = answerCard(d.cards.find((c) => c.id === q[0].cardId), 3, DEFAULT_SR_SETTINGS, T).card;
      d = { ...d, cards: burySiblings(d.cards.map((c) => (c.id === first.id ? first : c)), first, T) };
      assert.strictEqual(d.cards.filter((c) => c.buriedReason === 'sibling').length, 2);
      assert.strictEqual(buildQueue([d], null, on, T).length, 0);
      const next = buildQueue([d], null, on, T + DAY);
      assert.ok(next.some((r) => r.cardId !== first.id), 'a different cloze is due the next day');
    });

    test('A5.7c by default every cloze of a note is in the same session — the reported c1-only bug', () => {
      // The note from the report: c3 written first, c1 and c2 used twice.
      const cz = buildNoteCards({ kind: 'cloze', front: '{{c3::the}} {{c1::mitochondria}} is {{c2::the}} {{c1::powerhouse}} of the {{c2::cell}}', back: '' }, [], mkId, T);
      assert.strictEqual(cz.length, 3);
      assert.strictEqual(resolveSettings({}).burySiblings, false, 'off by default, as in current Anki');
      assert.strictEqual(resolveSettings({ burySiblings: true }).burySiblings, true);
      assert.strictEqual(deckDueCounts(deck(cz), DEFAULT_SR_SETTINGS, T).new, 3);
      let d = deck(cz);
      const seen = new Set();
      // Answer Good on whatever comes next until the session is empty.
      for (let i = 0; i < 20; i++) {
        const q = buildQueue([d], null, DEFAULT_SR_SETTINGS, T);
        const pick = pickNext([d], null, q, 0, T);
        if (!pick.ref) break;
        seen.add(pick.ref.cardId);
        const c = d.cards.find((x) => x.id === pick.ref.cardId);
        const res = answerCard(c, 3, DEFAULT_SR_SETTINGS, T);
        d = { ...d, cards: d.cards.map((x) => (x.id === c.id ? { ...res.card, nextDue: T + 2 * DAY } : x)) };
      }
      assert.strictEqual(seen.size, 3, 'c1, c2 and c3 are all shown today');
    });

    test('A5.7e with burying off, siblings are spread apart when other notes are due', () => {
      const a = buildNoteCards({ kind: 'cloze', front: '{{c1::A}} {{c2::B}}', back: '' }, [], mkId, T);
      const b = buildNoteCards({ kind: 'cloze', front: '{{c1::X}} {{c2::Y}}', back: '' }, [], mkId, T + 1);
      const q = buildQueue([deck([...a, ...b])], null, DEFAULT_SR_SETTINGS, T).map((r) => r.cardId);
      assert.deepStrictEqual(q, [a[0].id, b[0].id, a[1].id, b[1].id]);
    });

    test('A5.7d unburySiblings releases sibling holds but keeps hand-buried cards', () => {
      const [fwd, back] = buildNoteCards({ kind: 'reversed', front: 'a', back: 'b' }, [], mkId, T);
      const held = burySiblings([fwd, back], fwd, T);
      const hand = card({ buriedUntil: studyDayKey(T + DAY) });
      const legacy = buildNoteCards({ kind: 'reversed', front: 'c', back: 'd' }, [], mkId, T).map((c, i) => (i === 1 ? { ...c, buriedUntil: studyDayKey(T + DAY) } : c));
      const handSibling = buildNoteCards({ kind: 'reversed', front: 'e', back: 'f' }, [], mkId, T).map((c, i) => (i === 0 ? { ...c, buriedUntil: studyDayKey(T + DAY), buriedReason: 'manual' } : c));
      const out = unburySiblings([...held, hand, ...legacy, ...handSibling]);
      assert.strictEqual(isBuried(out[1], T), false, 'sibling released');
      assert.strictEqual(out[1].buriedReason, undefined);
      assert.strictEqual(isBuried(out[2], T), true, 'a single card buried by hand stays buried');
      assert.strictEqual(isBuried(out[4], T), false, 'an older sibling burial without a reason is released too');
      assert.strictEqual(isBuried(out[5], T), true, 'a hand burial inside a multi-card note is kept');
    });

    test('A5.8 sessionRemaining counts what is still to come', () => {
      const d = deck([review(), review(), card(), card({ state: 'learning', reviewCount: 1, nextDue: T + 5 * MIN, stability: 1, difficulty: 5 })]);
      const q = buildQueue([d], null, DEFAULT_SR_SETTINGS, T);
      const rem = sessionRemaining([d], null, q, 1, T);
      assert.strictEqual(rem.learn, 1);
      assert.strictEqual(rem.new + rem.review, q.length - 1);
    });

    test('A5.9 cram mode queues every unsuspended card and review-ahead reaches into next week', () => {
      const d = deck([review({ nextDue: T + 3 * DAY }), card(), review({ suspended: true })]);
      assert.strictEqual(buildQueue([d], null, DEFAULT_SR_SETTINGS, T, 'cram').length, 2);
      assert.strictEqual(buildQueue([d], null, DEFAULT_SR_SETTINGS, T, 'normal').filter((r) => r.cardId === d.cards[0].id).length, 0);
      assert.strictEqual(buildQueue([d], null, DEFAULT_SR_SETTINGS, T, 'ahead', 7).length, 1);
    });

    test('A5.10 eight lapses mark a leech', () => {
      let c = review({ lapses: 7 });
      const res = answerCard(c, 1, DEFAULT_SR_SETTINGS, T);
      assert.strictEqual(res.becameLeech, true);
      assert.strictEqual(res.card.leech, true);
      c = review({ lapses: 2 });
      assert.strictEqual(answerCard(c, 1, DEFAULT_SR_SETTINGS, T).becameLeech, false);
    });
  });

  describe('Study Anki Suite 6: Exam mode', () => {
    const exam = (days) => {
      const d = new Date(T + days * DAY);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    test('A6.1 intervals are capped so nothing lands after the exam', () => {
      assert.strictEqual(intervalCap(36500, exam(10), T), 9);
      assert.strictEqual(intervalCap(36500, exam(1), T), 1);
      assert.strictEqual(intervalCap(36500, exam(-3), T), 36500, 'a past exam no longer caps');
      const c = review({ interval: 60, stability: 200, lastReview: T - 60 * DAY });
      const res = answerCard(c, 4, DEFAULT_SR_SETTINGS, T, { examDate: exam(10) });
      assert.ok(res.intervalDays <= 9);
    });

    test('A6.2 reviews that would land after the exam are pulled forward and spread out', () => {
      const cards = [];
      for (let i = 0; i < 40; i++) cards.push(review({ nextDue: T + 30 * DAY }));
      cards.push(review({ nextDue: T + 2 * DAY }));
      const out = planExamReschedule(cards, exam(5), T);
      const examStart = studyDayStart(T, 5);
      assert.ok(out.every((c) => c.nextDue < examStart));
      assert.strictEqual(out[40].nextDue, cards[40].nextDue, 'reviews already before the exam are untouched');
      assert.ok(new Set(out.slice(0, 40).map((c) => c.nextDue)).size > 1, 'spread over several days');
    });

    test('A6.3 exam mode raises the new-card pace to finish before the exam', () => {
      const cards = [];
      for (let i = 0; i < 100; i++) cards.push(card());
      const d = deck(cards, { examDate: exam(4) });
      assert.strictEqual(examDaysLeft(d, T), 4);
      assert.strictEqual(newLimitLeft(d, DEFAULT_SR_SETTINGS, T), 25);
      assert.strictEqual(examDaysLeft(deck([], { examDate: exam(-1) }), T), null);
    });
  });

  describe('Study Anki Suite 7: Stats, composition and import', () => {
    test('A7.1 the review log counts true retention from review cards only', () => {
      let s = { lastStudyDate: '', currentStreak: 0, masteredToday: 0 };
      const key = studyDayKey(Date.now());
      s = recordAnswer(s, { dayKey: key, wasReview: true, passed: true, ms: 4000 });
      s = recordAnswer(s, { dayKey: key, wasReview: true, passed: false, ms: 6000 });
      s = recordAnswer(s, { dayKey: key, wasReview: false, passed: false, ms: 999999999 });
      assert.strictEqual(s.log[key].reviews, 3);
      assert.strictEqual(s.log[key].matureTried, 2);
      assert.strictEqual(trueRetention(s, 30), 0.5);
      assert.ok(s.log[key].ms <= 4000 + 6000 + 5 * 60 * 1000, 'an abandoned card cannot inflate time studied');
      assert.strictEqual(trueRetention({ lastStudyDate: '', currentStreak: 0, masteredToday: 0 }, 30), null);
    });

    test('A7.2 the log keeps a bounded window', () => {
      let s = undefined;
      for (let i = 0; i < 200; i++) {
        const d = new Date(2026, 0, 1 + i);
        s = recordAnswer(s, { dayKey: studyDayKey(d.getTime() + 12 * HOUR), wasReview: false, passed: true, ms: 1 });
      }
      assert.ok(Object.keys(s.log).length <= 120);
    });

    test('A7.3 composition splits young from mature at 21 days', () => {
      const comp = composition([card(), review({ interval: 5 }), review({ interval: 30 }), review({ suspended: true }), card({ state: 'relearning', reviewCount: 4 })]);
      assert.deepStrictEqual(comp, { new: 1, learning: 1, young: 1, mature: 1, suspended: 1, total: 5 });
    });

    test('A7.4 forecast buckets reviews by study day, overdue counting as today', () => {
      const f = forecast([deck([review({ nextDue: T - 5 * DAY }), review({ nextDue: studyDayStart(T, 2) }), card()])], 7, T);
      assert.strictEqual(f.length, 7);
      assert.strictEqual(f[0], 1);
      assert.strictEqual(f[2], 1);
    });

    test('A7.6 updating streak and XP keeps the review log', () => {
      const key = studyDayKey(Date.now());
      let s = recordAnswer(undefined, { dayKey: key, wasReview: true, passed: true, ms: 3000 });
      s = updateStudyStats(s, 1, 0, false);
      s = updateStudyStats(s, 0, 0, true, 1);
      assert.ok(s.log && s.log[key], 'the log survived both updates');
      assert.strictEqual(s.log[key].reviews, 1);
    });

    test('A7.5 import turns cloze lines into cloze notes and the rest into the chosen type', () => {
      const notes = parseImportNotes('Hund, dog\nThe {{c1::heart}} has four chambers\n# comment\nKatze, cat', 'comma', 'reversed');
      assert.strictEqual(notes.length, 3);
      assert.strictEqual(notes.filter((n) => n.kind === 'cloze').length, 1);
      assert.ok(notes.filter((n) => n.kind !== 'cloze').every((n) => n.kind === 'reversed'));
    });
  });
}
