import assert from 'node:assert';
import { analyzeImport, parseImport, parseCsvLine } from '../components/study/utils.ts';

export function runStudyImportTests(describe, test) {
  describe('Study Import Suite 1: What becomes a card', () => {
    test('SI1.1 Auto-detect handles each separator on its own line', () => {
      const a = analyzeImport('heart, pumps blood\nmitosis; cell division\nHTML\tmarkup\nQ | A', 'auto');
      assert.deepStrictEqual(a.notes.map((n) => [n.front, n.back]), [['heart', 'pumps blood'], ['mitosis', 'cell division'], ['HTML', 'markup'], ['Q', 'A']]);
      assert.strictEqual(a.skipped.length, 0);
    });

    test('SI1.2 A header row is recognised once, at the top, and left out', () => {
      const a = analyzeImport('Front,Back\nheart,pumps blood', 'comma');
      assert.strictEqual(a.headerSkipped, true);
      assert.strictEqual(a.notes.length, 1);
      const b = analyzeImport('heart,pumps blood\nterm,definition', 'comma');
      assert.strictEqual(b.headerSkipped, false, 'only the first data line can be a header');
      assert.strictEqual(b.notes.length, 2);
    });

    test('SI1.3 A front starting with an apostrophe is kept, single-quoted fields still work', () => {
      assert.deepStrictEqual(parseImport("'tis,it is", 'comma'), [{ front: "'tis", back: 'it is' }]);
      assert.deepStrictEqual(parseImport("'90s music, grunge", 'comma'), [{ front: "'90s music", back: 'grunge' }]);
      assert.deepStrictEqual(parseCsvLine("'a, b', c"), ['a, b', 'c']);
    });

    test('SI1.4 Tab files keep column 2 as the back and drop later columns', () => {
      const a = analyzeImport('heart\tpumps blood\tbio::cardio', 'tab');
      assert.deepStrictEqual(a.notes.map((n) => n.back), ['pumps blood']);
    });

    test('SI1.5 A byte-order mark does not end up in the first front', () => {
      assert.strictEqual(analyzeImport('﻿heart,pumps', 'comma').notes[0].front, 'heart');
    });

    test('SI1.6 Cloze lines need no separator and count one card per distinct number', () => {
      const a = analyzeImport('The {{c1::heart}} has {{c2::four}} {{c1::chambers}}', 'comma');
      assert.strictEqual(a.notes[0].kind, 'cloze');
      assert.strictEqual(a.cardCount, 2);
    });

    test('SI1.7 Card counts follow the kind', () => {
      assert.strictEqual(analyzeImport('a,b\nc,d', 'comma', 'reversed').cardCount, 4);
      assert.strictEqual(analyzeImport('a,b\nc,d', 'comma', 'typein').cardCount, 2);
    });
  });

  describe('Study Import Suite 2: What does not, and why', () => {
    test('SI2.1 Lines that cannot become cards are reported with a line number and reason', () => {
      const a = analyzeImport('heart,pumps\njust a line\nmitosis,\n', 'comma');
      assert.strictEqual(a.notes.length, 1);
      assert.deepStrictEqual(a.skipped.map((s) => [s.line, s.reason]), [[2, 'No "," on this line'], [3, 'The front or the back is empty']]);
    });

    test('SI2.2 The wrong separator is reported, not silently dropped', () => {
      const a = analyzeImport('mitosis; cell division', 'comma');
      assert.strictEqual(a.notes.length, 0);
      assert.strictEqual(a.skipped[0].reason, 'No "," on this line');
      assert.strictEqual(analyzeImport('just words', 'auto').skipped[0].reason, 'No separator between front and back');
    });

    test('SI2.3 Comments and blank lines are neither cards nor skips', () => {
      const a = analyzeImport('# deck export\n\n// note\nheart,pumps', 'comma');
      assert.strictEqual(a.notes.length, 1);
      assert.strictEqual(a.skipped.length, 0);
    });

    test('SI2.4 Cards already in the deck, and repeats inside the list, are counted and left out', () => {
      const a = analyzeImport('Heart,  pumps blood\nlung,breathes\nlung,breathes', 'comma', 'basic', [{ front: 'heart', back: 'pumps  blood' }]);
      assert.deepStrictEqual(a.notes.map((n) => n.front), ['lung']);
      assert.strictEqual(a.duplicates, 2, 'case and spacing do not make a card new');
    });

    test('SI2.5 Empty or non-text input is an empty analysis', () => {
      for (const v of ['', null, undefined, 42]) {
        const a = analyzeImport(v);
        assert.strictEqual(a.notes.length, 0);
        assert.strictEqual(a.skipped.length, 0);
      }
    });
  });
}
