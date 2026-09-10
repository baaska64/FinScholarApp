import assert from 'node:assert';
import { getSubjectStyle, getSubjectIcon, getThemeTokens, SUBJECT_PALETTE } from '../widget/subjectUtils.ts';
import { FinScholarWidget } from '../widget/FinScholarWidget.tsx';
import { AgendaWidget } from '../widget/AgendaWidget.tsx';
import { DeadlinesWidget } from '../widget/DeadlinesWidget.tsx';
import { FocusWidget } from '../widget/FocusWidget.tsx';
import { StatsWidget } from '../widget/StatsWidget.tsx';
import { buildWidgetSnapshot, buildDemoSnapshot, emptySnapshot } from '../widget/widgetData.ts';
import { getMetrics } from '../widget/widgetLayout.ts';
import { getWidgetPalette } from '../widget/widgetTheme.ts';
import { collect, requiredHeight, textNodes, texts, typeOf } from './helpers/widgetTree.js';

const FAMILY = [
  ['FinScholarWidget', FinScholarWidget, 110, 110],
  ['FinScholarAgendaWidget', AgendaWidget, 180, 110],
  ['FinScholarDeadlinesWidget', DeadlinesWidget, 110, 110],
  ['FinScholarFocusWidget', FocusWidget, 180, 40],
  ['FinScholarStatsWidget', StatsWidget, 110, 110],
];

/** Thursday 3 Sep 2026, 08:12 — the same clock the other widget suites use. */
const NOW = new Date(2026, 8, 3, 8, 12, 0);

function ledgerOf(classCount, taskCount = 0) {
  return {
    settings: { gradingSystem: '1_IS_BEST' },
    years: [
      {
        id: 'y1',
        semesters: [
          {
            id: 's1',
            name: '1st Semester',
            startDate: '2026-08-31',
            endDate: '2026-12-11',
            classes: Array.from({ length: classCount }, (_, i) => ({
              id: `c${i}`,
              name: i === 0 ? 'CS 101 - Intro to CS' : `Subject ${i} - Advanced Topic`,
              room: `Room ${100 + i}`,
              day: i === 0 ? 3 : i % 7,
              startHour: i === 0 ? 7.5 : 8 + (i % 10),
              duration: i === 0 ? 1.5 : 1,
              colorIdx: i % 6,
            })),
            subjects: [
              {
                id: 'sub1',
                name: 'CS 101',
                colorIdx: 0,
                requirements: Array.from({ length: taskCount }, (_, i) => ({
                  id: `t${i}`,
                  title: `Task ${i}`,
                  status: 'pending',
                  priority: ['high', 'medium', 'low'][i % 3],
                  dueDate: new Date(2026, 8, 1 + i).toISOString(),
                })),
              },
            ],
            attendanceLog: {},
          },
        ],
      },
    ],
  };
}

function snapshotOf(classCount, taskCount = 0) {
  return buildWidgetSnapshot(ledgerOf(classCount, taskCount), { yearId: 'y1', semId: 's1', now: NOW });
}

export function runEmpiricalStressHarness(describe, test) {
  describe('Challenger Stress Suite 1: getSubjectStyle Robustness & Determinism', () => {
    test('1.1 Extreme Large Inputs (10KB to 1MB strings)', () => {
      const sizes = [10_000, 100_000, 1_000_000];
      for (const size of sizes) {
        const largeString = 'A'.repeat(size);
        const t0 = performance.now();
        const style = getSubjectStyle(largeString);
        const elapsed = performance.now() - t0;

        assert(style, 'Should return valid style object');
        assert(/^#[0-9a-fA-F]{6}$/.test(style.color), `Valid color hex required, got ${style.color}`);
        assert(/^#[0-9a-fA-F]{6}$/.test(style.lightBg), `Valid lightBg hex required, got ${style.lightBg}`);
        assert(/^#[0-9a-fA-F]{6}$/.test(style.darkBg), `Valid darkBg hex required, got ${style.darkBg}`);
        assert(elapsed < 100, `Execution for ${size} chars should be < 100ms, took ${elapsed.toFixed(2)}ms`);
      }
    });

    test('1.2 Empty, Whitespace & Boundary Strings', () => {
      const emptyInputs = ['', ' ', '   ', '\t\n\r', ' \v\f\t '];
      const defaultStyle = SUBJECT_PALETTE[0];

      for (const input of emptyInputs) {
        const style = getSubjectStyle(input);
        assert.deepStrictEqual(style, defaultStyle, `Empty input '${JSON.stringify(input)}' should resolve to palette index 0`);
      }
    });

    test('1.3 Untyped & Primitive Non-String Inputs', () => {
      const nonStrings = [null, undefined, 0, 12345, NaN, Infinity, -1, true, false, {}, []];
      const defaultStyle = SUBJECT_PALETTE[0];

      for (const input of nonStrings) {
        const style = getSubjectStyle(input);
        assert.deepStrictEqual(style, defaultStyle, `Non-string input ${input} should safely resolve to palette index 0`);
      }
    });

    test('1.4 Special Characters, Emojis, Unicode & Injections', () => {
      const adversarialInputs = [
        '<script>alert(1)</script>',
        "' OR '1'='1",
        '🔥🎨🤖💻📚🎓',
        'こんにちは世界',
        'مرحبا بالعالم',
        '\0￿',
        '😀😂',
        'C++ / C# / .NET 9.0 (Advanced)'
      ];

      for (const input of adversarialInputs) {
        const style = getSubjectStyle(input);
        const icon = getSubjectIcon(input);
        assert(style && style.color, `Adversarial input "${input}" should return valid style`);
        assert(typeof icon === 'string' && icon.length > 0, `Adversarial input "${input}" should return valid icon`);
      }
    });

    test('1.5 Hash Determinism & Palette Distribution (1,000,000 iterations & 10,000 random inputs)', () => {
      const testSubject = 'CSIT 321 - Advanced Mobile Development';
      const referenceStyle = getSubjectStyle(testSubject);

      // Determinism across 1,000,000 iterations
      for (let i = 0; i < 1_000_000; i++) {
        const currentStyle = getSubjectStyle(testSubject);
        if (currentStyle.color !== referenceStyle.color) {
          assert.fail(`Non-deterministic result at iteration ${i}: expected ${referenceStyle.color}, got ${currentStyle.color}`);
        }
      }

      // Palette distribution check over 10,000 generated course strings
      const counts = new Array(SUBJECT_PALETTE.length).fill(0);
      for (let i = 0; i < 10_000; i++) {
        const course = `Course_${i}_${(i * 1664525 + 1013904223) % 4294967296}`;
        const style = getSubjectStyle(course);
        const idx = SUBJECT_PALETTE.findIndex(p => p.color === style.color);
        assert(idx >= 0, `Returned style color ${style.color} must exist in SUBJECT_PALETTE`);
        counts[idx]++;
      }

      // Check that all 8 palette entries were hit
      for (let j = 0; j < SUBJECT_PALETTE.length; j++) {
        assert(counts[j] > 0, `Palette entry index ${j} was never selected in 10,000 samples`);
      }
    });
  });

  describe('Challenger Stress Suite 2: Widget family tree stability', () => {
    test('2.1 Every widget survives 0, 1, 2, 4, 10 and 50 classes', () => {
      for (const count of [0, 1, 2, 4, 10, 50]) {
        const snapshot = snapshotOf(count, count);
        for (const [name, Component] of FAMILY) {
          const tree = Component({ snapshot, widgetInfo: { width: 280, height: 220 } });
          assert.strictEqual(typeOf(tree), 'FlexWidget', `${name} lost its card root at ${count} classes`);
          assert.strictEqual(tree.props.style.flex, 1);
          assert.strictEqual(tree.props.style.width, 'match_parent');
          assert(requiredHeight(tree) <= 220, `${name} overflowed at ${count} classes`);
          assert(textNodes(tree).length > 0, `${name} rendered no text at ${count} classes`);
        }
      }
    });

    test('2.2 A list never draws more rows than the data has', () => {
      for (const count of [1, 2, 3, 4, 5, 9]) {
        const snapshot = snapshotOf(count, count);
        const tree = FinScholarWidget({ snapshot, widgetInfo: { width: 300, height: 400 } });
        const rows = collect(
          tree,
          (n) =>
            n.props?.style?.flexDirection === 'row' &&
            n.props?.style?.width === 'match_parent' &&
            typeof n.props?.style?.height === 'number'
        );
        // The header and the hero's status line share the row shape, so the
        // bound is loose; what matters is that it never invents a class.
        assert(
          rows.length <= Math.max(1, snapshot.upcoming.length) + 2,
          `Drew ${rows.length} rows for ${snapshot.upcoming.length} classes`
        );
      }
    });

    test('2.3 Row keys are stable so a redraw does not shuffle the list', () => {
      const snapshot = snapshotOf(6, 6);
      for (const [name, Component] of FAMILY) {
        const first = Component({ snapshot, widgetInfo: { width: 300, height: 340 } });
        const second = Component({ snapshot, widgetInfo: { width: 300, height: 340 } });
        const keysOf = (tree) => collect(tree, (n) => n.key != null).map((n) => n.key);
        assert.deepStrictEqual(keysOf(first), keysOf(second), `${name} produced unstable keys`);
      }
    });
  });

  describe('Challenger Stress Suite 3: Theme toggling', () => {
    test('3.1 Theme token parity & contract completeness', () => {
      const light = getThemeTokens(false);
      const dark = getThemeTokens(true);

      const requiredKeys = [
        'bgColor', 'cardColor', 'cardBorder',
        'textColor', 'textSecondary', 'textTertiary',
        'primaryColor', 'successColor', 'successBg'
      ];

      for (const key of requiredKeys) {
        assert(key in light, `Light theme token missing key: ${key}`);
        assert(key in dark, `Dark theme token missing key: ${key}`);
        assert.notStrictEqual(light[key], dark[key], `Light and Dark theme tokens for ${key} should differ`);
      }
    });

    test('3.2 High-frequency toggle loop keeps every widget deterministic', () => {
      const snapshot = snapshotOf(6, 6);
      const lightSurface = getWidgetPalette(false).surface;
      const darkSurface = getWidgetPalette(true).surface;

      for (let i = 0; i < 2000; i++) {
        const isDark = i % 2 === 0;
        for (const [name, Component] of FAMILY) {
          const tree = Component({ snapshot, isDark, widgetInfo: { width: 280, height: 220 } });
          assert.strictEqual(
            tree.props.style.backgroundColor,
            isDark ? darkSurface : lightSurface,
            `${name} drew the wrong surface at iteration ${i}`
          );
        }
      }
    });

    test('3.3 Empty-state toggle loop stays on-palette', () => {
      const blank = emptySnapshot(NOW);
      for (let i = 0; i < 2000; i++) {
        const isDark = i % 2 === 0;
        const palette = getWidgetPalette(isDark);
        const tree = FinScholarWidget({ snapshot: blank, isDark, widgetInfo: { width: 280, height: 220 } });
        assert.strictEqual(tree.props.style.backgroundColor, palette.surface);
        assert.strictEqual(tree.props.style.backgroundGradient.to, palette.surfaceTo);
        assert(texts(tree).includes('No classes coming up'));
      }
    });
  });

  describe('Challenger Stress Suite 4: Geometry breakpoints & zero clipping', () => {
    test('4.1 Multi-dimensional breakpoint matrix', () => {
      const heights = [40, 60, 95, 96, 110, 130, 149, 150, 180, 200, 229, 230, 250, 320, 400, 600];
      const widths = [110, 140, 180, 200, 240, 280, 320, 360, 480];
      const snapshot = snapshotOf(9, 9);

      for (const [name, Component, minWidth, minHeight] of FAMILY) {
        for (const height of heights) {
          for (const width of widths) {
            if (height < minHeight || width < minWidth) continue;
            const tree = Component({ snapshot, widgetInfo: { width, height } });
            assert(tree, `${name} must render at ${width}x${height}`);
            assert(requiredHeight(tree) <= height, `${name} clipped at ${width}x${height}`);
            const metrics = getMetrics({ width, height });
            assert.strictEqual(tree.props.style.padding, metrics.gutter, `${name} padding drifted at ${width}x${height}`);
          }
        }
      }
    });

    test('4.2 Malformed widgetInfo falls back to a drawable default', () => {
      const snapshot = snapshotOf(6, 6);
      const edgeInfos = [
        undefined,
        null,
        {},
        { width: NaN, height: NaN },
        { width: -100, height: -50 },
        { width: '300', height: '250' },
        { width: 0, height: 0 },
        { width: Infinity, height: Infinity },
        { width: [], height: {} },
      ];

      for (const info of edgeInfos) {
        for (const [name, Component] of FAMILY) {
          const tree = Component({ snapshot, isDark: true, widgetInfo: info });
          assert(tree, `${name} should render for widgetInfo: ${JSON.stringify(info)}`);
          assert.strictEqual(tree.props.style.flex, 1);
          const metrics = getMetrics(info);
          assert(requiredHeight(tree) <= metrics.height, `${name} overflowed its fallback box`);
        }
      }
    });

    test('4.3 No child is ever bigger than the card it sits in', () => {
      const snapshot = snapshotOf(6, 6);
      for (const size of [
        { width: 140, height: 120 },
        { width: 250, height: 200 },
        { width: 320, height: 400 },
      ]) {
        const metrics = getMetrics(size);
        assert(metrics.gutter >= 10 && metrics.gutter <= 14, `gutter ${metrics.gutter} out of range`);
        assert(metrics.radius >= 18 && metrics.radius <= 28, `radius ${metrics.radius} out of range`);

        for (const [name, Component] of FAMILY) {
          const tree = Component({ snapshot, widgetInfo: size });
          for (const node of collect(tree, () => true)) {
            const style = node.props?.style ?? {};
            if (typeof style.height === 'number') {
              assert(style.height <= size.height, `${name}: a child is ${style.height}dp inside a ${size.height}dp card`);
            }
            if (typeof style.width === 'number') {
              assert(style.width <= size.width, `${name}: a child is ${style.width}dp inside a ${size.width}dp card`);
            }
          }
        }
      }
    });

    test('4.4 Every text node is single line and unscaled, at every size', () => {
      const snapshot = snapshotOf(9, 9);
      for (const size of [
        { width: 180, height: 110 },
        { width: 280, height: 220 },
        { width: 320, height: 400 },
      ]) {
        for (const [name, Component] of FAMILY) {
          for (const node of textNodes(Component({ snapshot, widgetInfo: size }))) {
            assert.strictEqual(node.props.maxLines, 1, `${name}: "${node.props.text}" may wrap`);
            assert.strictEqual(node.props.allowFontScaling, false, `${name}: "${node.props.text}" would rescale`);
            assert(typeof node.props.text === 'string', `${name}: a non-string reached a TextWidget`);
          }
        }
      }
    });
  });

  describe('Challenger Stress Suite 5: Extreme input scaling & fuzzing', () => {
    test('5.1 Ten thousand classes still draw one card, quickly', () => {
      const snapshot = snapshotOf(10000, 0);
      const started = performance.now();
      const tree = FinScholarWidget({ snapshot, widgetInfo: { width: 300, height: 300 } });
      const elapsed = performance.now() - started;

      assert(tree, 'Widget must render for a 10,000-class timetable');
      assert(elapsed < 100, `Rendering took ${elapsed.toFixed(2)}ms`);
      assert(snapshot.upcoming.length <= 6, 'The snapshot caps the list long before the renderer sees it');
      assert(requiredHeight(tree) <= 300);
    });

    test('5.2 Adversarial ledgers never take a widget down', () => {
      const malformed = [
        null,
        undefined,
        12345,
        'random_string',
        true,
        [],
        {},
        { years: null },
        { years: [{ semesters: [{ classes: 'nope', subjects: 'nope' }] }] },
        { years: [{ id: 'y1', semesters: [{ id: 's1', classes: [{ name: 'A'.repeat(50000), day: 3, startHour: 8 }] }] }] },
        { years: [{ id: 'y1', semesters: [{ id: 's1', classes: [{ name: '<script>alert(1)</script>', day: 3, startHour: 8 }] }] }] },
        { years: [{ id: 'y1', semesters: [{ id: 's1', subjects: [{ requirements: [{ title: 'x'.repeat(20000), status: 'pending' }] }] }] }] },
      ];

      for (const ledger of malformed) {
        const snapshot = buildWidgetSnapshot(ledger, { yearId: 'y1', semId: 's1', now: NOW });
        for (const [name, Component] of FAMILY) {
          const tree = Component({ snapshot, widgetInfo: { width: 280, height: 220 } });
          assert(tree, `${name} failed on a malformed ledger`);
          assert.strictEqual(tree.props.style.flex, 1);
          for (const value of texts(tree)) {
            assert(value.length <= 200, `${name} passed a ${value.length}-char string to a bitmap`);
          }
        }
      }
    });

    test('5.3 Every widget renders inside its own frame budget', () => {
      const snapshot = buildDemoSnapshot(NOW);
      for (const [name, Component] of FAMILY) {
        const started = performance.now();
        for (let i = 0; i < 500; i++) {
          Component({ snapshot, isDark: i % 2 === 0, widgetInfo: { width: 300, height: 300 } });
        }
        const perRender = (performance.now() - started) / 500;
        assert(perRender < 2, `${name} takes ${perRender.toFixed(3)}ms per render`);
      }
    });

    test('5.4 Unicode and multilingual class names pass through intact', () => {
      const names = [
        'CS 101',
        '🎨 ART 101',
        '🇵🇭 HIST 101',
        'こんにちは',
        'مرحبا',
        'C++ / C# / .NET 9.0 (Advanced)',
      ];
      for (const name of names) {
        const ledger = ledgerOf(1, 0);
        ledger.years[0].semesters[0].classes[0].name = name;
        const snapshot = buildWidgetSnapshot(ledger, { yearId: 'y1', semId: 's1', now: NOW });
        const tree = FinScholarWidget({ snapshot, widgetInfo: { width: 300, height: 240 } });
        assert(
          texts(tree).some((t) => t === snapshot.upcoming[0].courseName),
          `"${name}" did not survive to the widget`
        );
      }
    });
  });
}
