import assert from 'node:assert';
import { readFileSync } from 'node:fs';

import { FinScholarWidget } from '../widget/FinScholarWidget.tsx';
import { AgendaWidget, windowAgenda } from '../widget/AgendaWidget.tsx';
import { DeadlinesWidget, urgencyTone } from '../widget/DeadlinesWidget.tsx';
import { FocusWidget } from '../widget/FocusWidget.tsx';
import { StatsWidget, attendanceTone } from '../widget/StatsWidget.tsx';
import { buildDemoSnapshot, emptySnapshot } from '../widget/widgetData.ts';
import { fitCount, getMetrics, normalizeBox, resolveScale, distributeRowHeight, listSpace } from '../widget/widgetLayout.ts';
import { WidgetClassPalette, getWidgetAccent, getWidgetPalette, resolveAccentIndex } from '../widget/widgetTheme.ts';
import { ClassPalette } from '../constants/Theme.ts';
import { childrenOf, collect, requiredHeight, textNodes, texts, typeOf, styleNumbers } from './helpers/widgetTree.js';

const WIDGETS = [
  { name: 'FinScholarWidget', Component: FinScholarWidget, minWidth: 110, minHeight: 110 },
  { name: 'FinScholarAgendaWidget', Component: AgendaWidget, minWidth: 180, minHeight: 110 },
  { name: 'FinScholarDeadlinesWidget', Component: DeadlinesWidget, minWidth: 110, minHeight: 110 },
  { name: 'FinScholarFocusWidget', Component: FocusWidget, minWidth: 180, minHeight: 40 },
  { name: 'FinScholarStatsWidget', Component: StatsWidget, minWidth: 110, minHeight: 110 },
];

const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

export function runWidgetTests(describe, test) {
  const demo = buildDemoSnapshot(new Date('2026-09-03T08:12:00'));

  describe('Widget Family Suite 1: Card shell contract', () => {
    test('1.1 Every widget roots in a full-bleed FlexWidget card', () => {
      for (const { name, Component } of WIDGETS) {
        const tree = Component({ snapshot: demo, widgetInfo: { width: 280, height: 200 } });
        assert.strictEqual(typeOf(tree), 'FlexWidget', `${name} must root in a FlexWidget`);
        assert.strictEqual(tree.props.style.flex, 1, `${name} root must flex`);
        assert.strictEqual(tree.props.style.width, 'match_parent', `${name} root must fill width`);
        assert.strictEqual(tree.props.style.height, 'match_parent', `${name} root must fill height`);
        assert.strictEqual(tree.props.style.overflow, 'hidden', `${name} root must clip to its corners`);
      }
    });

    test('1.2 Card padding is the metric gutter on all four sides', () => {
      for (const { name, Component } of WIDGETS) {
        for (const size of [
          { width: 140, height: 140 },
          { width: 280, height: 200 },
          { width: 320, height: 330 },
        ]) {
          const metrics = getMetrics(size);
          const tree = Component({ snapshot: demo, widgetInfo: size });
          assert.strictEqual(
            tree.props.style.padding,
            metrics.gutter,
            `${name} at ${size.width}x${size.height} must pad by the gutter, not a hard-coded value`
          );
          // A single `padding` and no per-side override is what keeps the four
          // edges equal — the old widget mixed 12/10/2/8 and read lopsided.
          const style = tree.props.style;
          for (const key of ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingHorizontal', 'paddingVertical']) {
            assert.strictEqual(style[key], undefined, `${name} must not override ${key} on the card`);
          }
        }
      }
    });

    test('1.3 Corner radius scales with the widget instead of a fixed 32', () => {
      const small = FinScholarWidget({ snapshot: demo, widgetInfo: { width: 140, height: 120 } });
      const large = FinScholarWidget({ snapshot: demo, widgetInfo: { width: 320, height: 330 } });
      assert.strictEqual(small.props.style.borderRadius, getMetrics({ width: 140, height: 120 }).radius);
      assert.strictEqual(large.props.style.borderRadius, getMetrics({ width: 320, height: 330 }).radius);
      assert(large.props.style.borderRadius > small.props.style.borderRadius, 'Bigger card, bigger radius');
    });

    test('1.4 Every widget deep links with OPEN_URI, not OPEN_APP', () => {
      // OPEN_APP ignores clickActionData in the native provider, so the old
      // schedule deep link never actually landed on the schedule.
      for (const { name, Component } of WIDGETS) {
        const tree = Component({ snapshot: demo, widgetInfo: { width: 280, height: 200 } });
        assert.strictEqual(tree.props.clickAction, 'OPEN_URI', `${name} must use OPEN_URI`);
        const uri = tree.props.clickActionData?.uri;
        assert(typeof uri === 'string' && uri.startsWith('finscholarapp://'), `${name} needs an app deep link, got ${uri}`);
      }
    });

    test('1.5 Deep links point at the screen the widget is about', () => {
      const linkOf = (Component) =>
        Component({ snapshot: demo, widgetInfo: { width: 280, height: 200 } }).props.clickActionData.uri;

      assert(linkOf(FinScholarWidget).includes('schedule?viewMode=grid'), 'Up Next opens the timetable');
      assert(linkOf(AgendaWidget).includes('schedule?viewMode=attendance'), 'Today opens the attendance day view');
      assert(linkOf(AgendaWidget).includes('targetDate=2026-09-03'), 'Today carries the date it drew');
      assert(linkOf(DeadlinesWidget).includes('requirements'), 'Deadlines opens the tasks screen');
      assert(linkOf(StatsWidget), 'Semester Pulse opens the app root');
    });

    test('1.6 Every widget is labelled for screen readers', () => {
      for (const { name, Component } of WIDGETS) {
        const tree = Component({ snapshot: demo, widgetInfo: { width: 280, height: 200 } });
        assert(
          typeof tree.props.accessibilityLabel === 'string' && tree.props.accessibilityLabel.length > 0,
          `${name} must carry an accessibilityLabel`
        );
      }
    });
  });

  describe('Widget Family Suite 2: Geometry never overflows the card', () => {
    const heights = [40, 70, 95, 96, 110, 128, 149, 150, 180, 210, 229, 230, 260, 300, 340, 400];
    const widths = [110, 140, 180, 199, 200, 239, 240, 280, 320, 400];

    test('2.1 Composed height fits the widget across the size matrix', () => {
      let checked = 0;
      for (const { name, Component, minWidth, minHeight } of WIDGETS) {
        for (const height of heights) {
          for (const width of widths) {
            // Android will not hand a widget less than its declared minimum;
            // 10dp of slack covers launchers that round down.
            if (height < minHeight - 10 || width < minWidth - 10) continue;
            for (const isDark of [false, true]) {
              const tree = Component({ snapshot: demo, isDark, widgetInfo: { width, height } });
              const needed = requiredHeight(tree);
              assert(
                needed <= height,
                `${name} at ${width}x${height} (dark=${isDark}) needs ${needed}dp — content would clip`
              );
              checked++;
            }
          }
        }
      }
      assert(checked > 600, `Expected a broad sweep, only checked ${checked} combinations`);
    });

    test('2.2 Empty states also fit, at every size', () => {
      const blank = emptySnapshot(new Date('2026-09-03T08:12:00'));
      for (const { name, Component, minWidth, minHeight } of WIDGETS) {
        for (const height of heights) {
          for (const width of widths) {
            if (height < minHeight - 10 || width < minWidth - 10) continue;
            const tree = Component({ snapshot: blank, widgetInfo: { width, height } });
            const needed = requiredHeight(tree);
            assert(needed <= height, `${name} empty state at ${width}x${height} needs ${needed}dp`);
          }
        }
      }
    });

    test('2.3 No negative, fractional or NaN box dimensions reach the renderer', () => {
      for (const { name, Component } of WIDGETS) {
        for (const size of [
          { width: 140, height: 140 },
          { width: 280, height: 200 },
          { width: 320, height: 400 },
        ]) {
          const tree = Component({ snapshot: demo, widgetInfo: size });
          for (const [key, value] of styleNumbers(tree)) {
            assert(Number.isFinite(value), `${name}: ${key} is ${value}`);
            if (['width', 'height', 'padding', 'paddingHorizontal', 'paddingVertical', 'borderRadius'].includes(key)) {
              assert(value >= 0, `${name}: ${key} is negative (${value})`);
              assert(Number.isInteger(value), `${name}: ${key} must be whole dp, got ${value}`);
            }
          }
        }
      }
    });

    test('2.4 Only the gaps between rows carry margin — never the last one', () => {
      for (const { name, Component } of WIDGETS) {
        const tree = Component({ snapshot: demo, widgetInfo: { width: 300, height: 330 } });
        // The list container is the flex:1 column holding the rows.
        const lists = collect(tree, (n) => {
          const kids = childrenOf(n);
          return (
            n.props?.style?.flexDirection === 'column' &&
            kids.length > 1 &&
            kids.every((k) => k.props?.style?.flexDirection === 'row' && typeof k.props?.style?.height === 'number')
          );
        });
        for (const list of lists) {
          const rows = childrenOf(list);
          const last = rows[rows.length - 1];
          assert.strictEqual(
            last.props.style.marginBottom ?? 0,
            0,
            `${name}: last row keeps a bottom margin, which reads as uneven padding`
          );
          rows.slice(0, -1).forEach((row, idx) => {
            assert(
              (row.props.style.marginBottom ?? 0) > 0,
              `${name}: row ${idx} has no separation from the next`
            );
          });
        }
      }
    });

    test('2.5 Rows grow to share leftover space instead of leaving a dead band', () => {
      const short = FinScholarWidget({ snapshot: demo, widgetInfo: { width: 300, height: 210 } });
      const tall = FinScholarWidget({ snapshot: demo, widgetInfo: { width: 300, height: 340 } });
      const rowHeight = (tree) => {
        const rows = collect(tree, (n) => n.props?.style?.flexDirection === 'row' && n.props?.style?.width === 'match_parent');
        return rows.length ? rows[rows.length - 1].props.style.height : 0;
      };
      assert(rowHeight(tall) >= rowHeight(short), 'A taller card should not use shorter rows');
      assert(rowHeight(tall) <= Math.round(getMetrics({ width: 300, height: 340 }).rowHeight * 1.45), 'Rows must stay rows, not banners');
    });
  });

  describe('Widget Family Suite 3: Typography and colour hygiene', () => {
    test('3.1 All widget text opts out of system font scaling', () => {
      // The library maps a scaling font to SP; a phone on "largest" text would
      // otherwise push rows straight out of a fixed-height card.
      for (const { name, Component } of WIDGETS) {
        const tree = Component({ snapshot: demo, widgetInfo: { width: 300, height: 300 } });
        for (const node of textNodes(tree)) {
          assert.strictEqual(
            node.props.allowFontScaling,
            false,
            `${name}: "${node.props.text}" would rescale with the system font`
          );
        }
      }
    });

    test('3.2 All widget text is single line and truncates rather than wraps', () => {
      for (const { name, Component } of WIDGETS) {
        const tree = Component({ snapshot: demo, widgetInfo: { width: 300, height: 300 } });
        for (const node of textNodes(tree)) {
          assert.strictEqual(node.props.maxLines, 1, `${name}: "${node.props.text}" may wrap to a second line`);
        }
      }
    });

    test('3.3 Text stays inside the loaded Nunito faces', () => {
      const allowed = ['Nunito_400Regular', 'Nunito_700Bold', 'Nunito_800ExtraBold'];
      for (const { name, Component } of WIDGETS) {
        const tree = Component({ snapshot: demo, widgetInfo: { width: 300, height: 300 } });
        for (const node of textNodes(tree)) {
          assert(
            allowed.includes(node.props.style.fontFamily),
            `${name}: "${node.props.text}" uses ${node.props.style.fontFamily}, which is not bundled`
          );
        }
      }
    });

    test('3.4 No symbol glyphs — a custom typeface has no per-glyph fallback', () => {
      // Everything outside Latin-1 plus the few punctuation marks Nunito's latin
      // subset guarantees would render as a tofu box on device.
      const allowedNonAscii = new Set(['·', '–', '—', '…', '’']);
      for (const { name, Component } of WIDGETS) {
        for (const snapshot of [demo, emptySnapshot(new Date('2026-09-03T08:12:00'))]) {
          const tree = Component({ snapshot, widgetInfo: { width: 300, height: 300 } });
          for (const value of texts(tree)) {
            for (const char of String(value)) {
              if (char.charCodeAt(0) < 128) continue;
              assert(allowedNonAscii.has(char), `${name}: "${value}" contains unsupported glyph ${char}`);
            }
          }
        }
      }
    });

    test('3.5 Every colour is a valid hex the library can convert', () => {
      for (const { name, Component } of WIDGETS) {
        for (const isDark of [false, true]) {
          const tree = Component({ snapshot: demo, isDark, widgetInfo: { width: 300, height: 300 } });
          collect(tree, () => true).forEach((node) => {
            const style = node.props?.style ?? {};
            for (const key of ['color', 'backgroundColor', 'borderColor']) {
              if (style[key] !== undefined) {
                assert(HEX.test(style[key]), `${name}: ${key} is "${style[key]}"`);
              }
            }
            if (style.backgroundGradient) {
              assert(HEX.test(style.backgroundGradient.from), `${name}: gradient from is "${style.backgroundGradient.from}"`);
              assert(HEX.test(style.backgroundGradient.to), `${name}: gradient to is "${style.backgroundGradient.to}"`);
            }
          });
        }
      }
    });
  });

  describe('Widget Family Suite 4: Theming', () => {
    test('4.1 Light and dark are genuinely different surfaces', () => {
      for (const { name, Component } of WIDGETS) {
        const light = Component({ snapshot: demo, isDark: false, widgetInfo: { width: 280, height: 220 } });
        const dark = Component({ snapshot: demo, isDark: true, widgetInfo: { width: 280, height: 220 } });
        assert.notStrictEqual(
          light.props.style.backgroundColor,
          dark.props.style.backgroundColor,
          `${name} draws the same card colour in both themes`
        );
      }
    });

    test('4.2 Light mode is a light card; dark mode is a dark card', () => {
      const light = getWidgetPalette(false);
      const dark = getWidgetPalette(true);
      const luminance = (hex) => {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      assert(luminance(light.surface) > 200, 'Light surface should be near-white');
      assert(luminance(dark.surface) < 80, 'Dark surface should be near-black');
      assert(luminance(light.text) < 80, 'Light-mode text should be dark');
      assert(luminance(dark.text) > 200, 'Dark-mode text should be light');
    });

    test('4.3 Widget class colours mirror the app timetable palette', () => {
      // A class the student painted indigo in the app must be indigo on the home
      // screen; these two tables drifting apart is a silent design bug.
      assert.deepStrictEqual(WidgetClassPalette.light, ClassPalette.light);
      assert.deepStrictEqual(WidgetClassPalette.dark, ClassPalette.dark);
    });

    test('4.4 Accent resolution is deterministic and survives junk input', () => {
      const len = WidgetClassPalette.light.length;
      for (const input of [0, 3, 5, -1, -7, 11, 2.9]) {
        const idx = resolveAccentIndex(input, 'CS 101');
        assert(Number.isInteger(idx) && idx >= 0 && idx < len, `colorIdx ${input} resolved to ${idx}`);
      }
      for (const input of [null, undefined, NaN, 'abc', {}, []]) {
        const idx = resolveAccentIndex(input, 'CSIT 227');
        assert(Number.isInteger(idx) && idx >= 0 && idx < len, `junk ${String(input)} resolved to ${idx}`);
        assert.strictEqual(idx, resolveAccentIndex(input, 'CSIT 227'), 'Name fallback must be stable');
      }
      assert.strictEqual(resolveAccentIndex(undefined, ''), 0, 'Nameless, colourless classes take slot 0');
    });

    test('4.5 Accents carry a legible foreground and a translucent wash', () => {
      for (const isDark of [false, true]) {
        const accent = getWidgetAccent(2, isDark, 'CS 101');
        assert(HEX.test(accent.solid) && HEX.test(accent.edge) && HEX.test(accent.soft));
        assert.strictEqual(accent.on, '#ffffff', 'Class blocks are solid with white text, as in the app');
        assert.strictEqual(accent.soft.length, 9, 'The wash must carry an alpha suffix');
      }
    });
  });

  describe('Widget Family Suite 5: Layout maths', () => {
    test('5.1 normalizeBox falls back per axis on junk input', () => {
      assert.deepStrictEqual(normalizeBox({ width: 300, height: 250 }), { width: 300, height: 250 });
      assert.deepStrictEqual(normalizeBox({ width: '300', height: '250' }), { width: 300, height: 250 });
      assert.deepStrictEqual(normalizeBox(undefined), { width: 250, height: 200 });
      assert.deepStrictEqual(normalizeBox(null), { width: 250, height: 200 });
      assert.deepStrictEqual(normalizeBox({}), { width: 250, height: 200 });
      assert.deepStrictEqual(normalizeBox({ width: NaN, height: NaN }), { width: 250, height: 200 });
      assert.deepStrictEqual(normalizeBox({ width: -100, height: 0 }), { width: 250, height: 200 });
      assert.deepStrictEqual(normalizeBox({ width: Infinity, height: 1e9 }), { width: 250, height: 2000 },
        'Infinity is not a size — fall back; a merely absurd number is clamped');
    });

    test('5.2 Scale steps up with the box and never skips a rung', () => {
      assert.strictEqual(resolveScale({ width: 300, height: 80 }), 'xs');
      assert.strictEqual(resolveScale({ width: 90, height: 300 }), 'xs');
      assert.strictEqual(resolveScale({ width: 300, height: 96 }), 'sm');
      assert.strictEqual(resolveScale({ width: 300, height: 149 }), 'sm');
      assert.strictEqual(resolveScale({ width: 300, height: 150 }), 'md');
      assert.strictEqual(resolveScale({ width: 300, height: 229 }), 'md');
      assert.strictEqual(resolveScale({ width: 300, height: 230 }), 'lg');
    });

    test('5.3 fitCount never returns a row that does not fit', () => {
      assert.strictEqual(fitCount(0, 30, 6, 5), 0);
      assert.strictEqual(fitCount(29, 30, 6, 5), 0);
      assert.strictEqual(fitCount(30, 30, 6, 5), 1);
      assert.strictEqual(fitCount(65, 30, 6, 5), 1);
      assert.strictEqual(fitCount(66, 30, 6, 5), 2);
      assert.strictEqual(fitCount(1000, 30, 6, 3), 3, 'Caps at the number of items');
      assert.strictEqual(fitCount(NaN, 30, 6, 5), 0);
      assert.strictEqual(fitCount(-50, 30, 6, 5), 0);

      // The invariant that matters: the rows it approves always fit.
      for (let space = 0; space <= 400; space += 7) {
        const count = fitCount(space, 30, 6, 9);
        if (count > 0) {
          assert(count * 30 + (count - 1) * 6 <= space, `fitCount(${space}) returned ${count}`);
        }
      }
    });

    test('5.4 distributeRowHeight fills the gap without stretching rows into banners', () => {
      assert.strictEqual(distributeRowHeight(0, 0, 6, 30), 30, 'No rows, no change');
      assert.strictEqual(distributeRowHeight(60, 2, 6, 30), 30, 'Exactly full stays at base');
      assert(distributeRowHeight(120, 2, 6, 30) > 30, 'Surplus is shared out');
      assert.strictEqual(distributeRowHeight(1000, 2, 6, 30), Math.round(30 * 1.45), 'Growth is capped');
      for (let space = 30; space <= 400; space += 11) {
        for (let count = 1; count <= 5; count++) {
          const height = distributeRowHeight(space, count, 6, 30);
          if (fitCount(space, 30, 6, count) === count) {
            assert(count * height + (count - 1) * 6 <= space, `${count} rows of ${height} exceed ${space}`);
          }
        }
      }
    });

    test('5.5 listSpace subtracts each block plus the gap after it', () => {
      const metrics = getMetrics({ width: 300, height: 300 });
      assert.strictEqual(listSpace(metrics, []), 300 - metrics.gutter * 2);
      assert.strictEqual(listSpace(metrics, [20]), 300 - metrics.gutter * 2 - 20 - metrics.gap);
      assert.strictEqual(listSpace(metrics, [0]), 300 - metrics.gutter * 2, 'A zero block costs nothing');
      assert.strictEqual(listSpace(metrics, [20, 40]), 300 - metrics.gutter * 2 - 20 - 40 - metrics.gap * 2);
    });

    test('5.6 Narrow widgets drop the room column before they clip the class name', () => {
      assert.strictEqual(getMetrics({ width: 239, height: 200 }).showRoom, false);
      assert.strictEqual(getMetrics({ width: 240, height: 200 }).showRoom, true);

      const narrow = FinScholarWidget({ snapshot: demo, widgetInfo: { width: 160, height: 220 } });
      assert(!texts(narrow).includes('NGE 205'), 'Room should be dropped on a narrow card');
      const wide = FinScholarWidget({ snapshot: demo, widgetInfo: { width: 300, height: 220 } });
      assert(texts(wide).includes('NGE 205'), 'Room should be shown when there is width for it');
    });
  });

  describe('Widget Family Suite 6: What each widget says', () => {
    test('6.1 Up Next leads with the class in progress and its remaining time', () => {
      const tree = FinScholarWidget({ snapshot: demo, widgetInfo: { width: 300, height: 240 } });
      const shown = texts(tree);
      assert(shown.includes('IN CLASS NOW'), 'An ongoing class should be labelled as such');
      assert(shown.includes('CSIT 227'), 'The ongoing class is the hero');
      assert(shown.includes('38m left'), 'The countdown belongs in the hero');
      assert(shown.some((t) => t.includes('7:30')), 'The hero states the actual time, which cannot go stale');
    });

    test('6.2 Up Next switches the hero label when nothing is running', () => {
      const snapshot = buildDemoSnapshot(new Date('2026-09-03T08:12:00'));
      snapshot.upcoming = snapshot.upcoming.slice(1);
      const tree = FinScholarWidget({ snapshot, widgetInfo: { width: 300, height: 240 } });
      const shown = texts(tree);
      assert(shown.includes('UP NEXT'), 'Without an ongoing class the hero reads UP NEXT');
      assert(!shown.includes('IN CLASS NOW'));
    });

    test('6.3 The ongoing hero carries a progress meter, an upcoming one does not', () => {
      const meters = (tree) =>
        collect(tree, (n) => n.props?.style?.height === 4 && n.props?.style?.borderRadius === 2).length;

      const ongoing = FinScholarWidget({ snapshot: demo, widgetInfo: { width: 300, height: 240 } });
      const upcoming = buildDemoSnapshot(new Date('2026-09-03T08:12:00'));
      upcoming.upcoming = upcoming.upcoming.slice(1);
      const next = FinScholarWidget({ snapshot: upcoming, widgetInfo: { width: 300, height: 240 } });
      assert(meters(ongoing) > meters(next), 'Only a class in progress has progress to show');
    });

    test('6.4 A short widget degrades to the compact strip rather than clipping the hero', () => {
      const tree = FinScholarWidget({ snapshot: demo, widgetInfo: { width: 300, height: 80 } });
      assert(texts(tree).includes('CSIT 227'));
      assert(requiredHeight(tree) <= 80);
      assert(!texts(tree).includes('UP NEXT'), 'The strip uses its own status label');
    });

    test('6.5 Today windows onto what is left when the day does not fit', () => {
      const day = demo.today;
      assert.strictEqual(windowAgenda(day, 0).length, 0);
      assert.strictEqual(windowAgenda(day, 99), day, 'Everything fits, nothing is dropped');

      const windowed = windowAgenda(day, 3);
      assert.strictEqual(windowed.length, 3);
      assert.strictEqual(windowed[0].state, 'now', 'The window starts at the first class not yet over');
      assert(!windowed.some((c) => c.state === 'past'), 'Finished classes are the first to go');

      const allDone = day.map((c) => ({ ...c, state: 'past' }));
      const tail = windowAgenda(allDone, 2);
      assert.deepStrictEqual(
        tail.map((c) => c.id),
        allDone.slice(-2).map((c) => c.id),
        'With the day over, show how it ended'
      );
    });

    test('6.6 Today dims finished classes and badges the current one', () => {
      const tree = AgendaWidget({ snapshot: demo, widgetInfo: { width: 320, height: 400 } });
      const palette = getWidgetPalette(false);
      const shown = texts(tree);
      assert(shown.includes('NOW'), 'The class in progress is badged');
      assert(shown.includes('ENG 101'), 'A finished class keeps its slot');

      const rails = collect(tree, (n) => n.props?.style?.width === getMetrics({ width: 320, height: 400 }).railWidth);
      assert(
        rails.some((r) => r.props.style.backgroundColor === palette.line),
        'A finished class loses its colour'
      );
    });

    test('6.7 Deadlines orders by urgency colour and shouts about overdue work', () => {
      const tree = DeadlinesWidget({ snapshot: demo, widgetInfo: { width: 300, height: 240 } });
      const shown = texts(tree);
      assert(shown.includes('DEADLINES'));
      assert(shown.includes('1 overdue'), 'The header counts overdue work');
      assert(shown.includes('Overdue'), 'The overdue row says so');
      assert.strictEqual(shown.indexOf('Case study draft') < shown.indexOf('Reading response'), true, 'Soonest first');

      assert.strictEqual(urgencyTone('overdue'), 'danger');
      assert.strictEqual(urgencyTone('today'), 'warning');
      assert.strictEqual(urgencyTone('soon'), 'brand');
      assert.strictEqual(urgencyTone('later'), 'neutral');
      assert.strictEqual(urgencyTone('none'), 'neutral');
    });

    test('6.8 Deadlines shows a real empty state, not an empty list', () => {
      const snapshot = buildDemoSnapshot(new Date('2026-09-03T08:12:00'));
      snapshot.tasks = [];
      const tree = DeadlinesWidget({ snapshot, widgetInfo: { width: 300, height: 240 } });
      assert(texts(tree).includes('All caught up'));
    });

    test('6.9 Semester Pulse shows four metrics, and two when it is short', () => {
      const tall = StatsWidget({ snapshot: demo, widgetInfo: { width: 300, height: 240 } });
      const tallText = texts(tall);
      assert(tallText.includes('1.75'), 'The GWA');
      assert(tallText.includes('94%'), 'Attendance');
      assert(tallText.includes('42%'), 'Term progress');
      assert(tallText.includes('OVERDUE') && tallText.includes('1'), 'Overdue work takes over the tasks tile');

      const short = StatsWidget({ snapshot: demo, widgetInfo: { width: 300, height: 120 } });
      const shortText = texts(short);
      assert(shortText.includes('1.75') && shortText.includes('94%'), 'The first two metrics survive');
      assert(!shortText.includes('42%'), 'The second row is dropped rather than squashed');
      assert(shortText.includes('ATTENDANCE'), 'The surviving tiles keep their captions');
    });

    test('6.10 Attendance is colour-coded against the usual pass mark', () => {
      assert.strictEqual(attendanceTone(96, true), 'success');
      assert.strictEqual(attendanceTone(90, true), 'success');
      assert.strictEqual(attendanceTone(89, true), 'warning');
      assert.strictEqual(attendanceTone(75, true), 'warning');
      assert.strictEqual(attendanceTone(74, true), 'danger');
      assert.strictEqual(attendanceTone(100, false), 'neutral', 'No sessions yet is not a perfect record');
    });

    test('6.11 Next Class states where and how long, and folds gracefully', () => {
      const wide = FocusWidget({ snapshot: demo, widgetInfo: { width: 320, height: 90 } });
      const shown = texts(wide);
      assert(shown.includes('IN CLASS NOW'));
      assert(shown.includes('CSIT 227'));
      assert(shown.some((t) => t.includes('NGE 108')));

      const tiny = FocusWidget({ snapshot: demo, widgetInfo: { width: 320, height: 44 } });
      assert(texts(tiny).includes('CSIT 227'), 'The class name is the last thing to go');
      assert(requiredHeight(tiny) <= 44);
    });
  });

  describe('Widget Family Suite 7: Manifest and code agree', () => {
    const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
    const pluginEntry = appJson.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'react-native-android-widget');

    test('7.1 Every widget in the picker has a component behind it', () => {
      const declared = pluginEntry[1].widgets.map((w) => w.name).sort();
      const implemented = WIDGETS.map((w) => w.name).sort();
      assert.deepStrictEqual(declared, implemented, 'app.json and the widget registry have drifted apart');
    });

    test('7.2 Each declared widget is described and resizable within sane bounds', () => {
      for (const widget of pluginEntry[1].widgets) {
        assert(widget.label && widget.label.startsWith('FinScholar'), `${widget.name} needs a branded picker label`);
        assert(widget.description && widget.description.length > 20, `${widget.name} needs a description`);
        assert(/^\d+dp$/.test(widget.minWidth) && /^\d+dp$/.test(widget.minHeight), `${widget.name} needs dp minimums`);
        // Below 30 minutes Android ignores the period entirely.
        assert(widget.updatePeriodMillis >= 1800000, `${widget.name} update period is below the Android floor`);
      }
    });

    test('7.3 The Nunito faces the widgets ask for are bundled', () => {
      const bundled = pluginEntry[1].fonts.map((f) => f.split('/').pop().replace('.ttf', ''));
      assert.deepStrictEqual(bundled.sort(), ['Nunito_400Regular', 'Nunito_700Bold', 'Nunito_800ExtraBold']);
    });
  });
}
