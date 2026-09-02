import assert from 'node:assert';
import {
  inflateRect,
  isMeasurableRect,
  resolveTooltipLayout,
  highlightRadius,
  SPOTLIGHT_PADDING,
  TOOLTIP_GAP,
  SCREEN_MARGIN,
  ARROW_SIZE,
} from '../utils/spotlightGeometry.ts';
import {
  MAIN_TOUR,
  SCREEN_TOURS,
  SPOTLIGHT_IDS,
  ALL_TOUR_KEYS,
  TOUR_KEYS,
} from '../constants/tours.ts';

const SCREEN = { width: 390, height: 844 };
const INSETS = { top: 47, bottom: 34, left: 0, right: 0 };

export function runSpotlightTests(describe, test) {
  describe('Spotlight Suite 1: Highlight Geometry', () => {
    test('S1.1 Inflates a measured control evenly on all sides', () => {
      const r = inflateRect({ x: 100, y: 200, width: 80, height: 40 }, 8, SCREEN);
      assert.deepStrictEqual(r, { x: 92, y: 192, width: 96, height: 56 });
    });

    test('S1.2 Clamps the highlight inside the screen at the edges', () => {
      const topLeft = inflateRect({ x: 0, y: 0, width: 40, height: 40 }, 10, SCREEN);
      assert.strictEqual(topLeft.x, 0);
      assert.strictEqual(topLeft.y, 0);
      assert.strictEqual(topLeft.width, 50);
      assert.strictEqual(topLeft.height, 50);

      const bottomRight = inflateRect(
        { x: SCREEN.width - 40, y: SCREEN.height - 40, width: 40, height: 40 },
        10,
        SCREEN
      );
      assert.strictEqual(bottomRight.x + bottomRight.width, SCREEN.width);
      assert.strictEqual(bottomRight.y + bottomRight.height, SCREEN.height);
    });

    test('S1.3 Only laid-out rects are considered measurable', () => {
      assert.strictEqual(isMeasurableRect({ x: 0, y: 0, width: 10, height: 10 }), true);
      assert.strictEqual(isMeasurableRect({ x: 0, y: 0, width: 0, height: 10 }), false);
      assert.strictEqual(isMeasurableRect({ x: 0, y: 0, width: 10, height: 0 }), false);
      assert.strictEqual(isMeasurableRect(null), false);
      assert.strictEqual(isMeasurableRect(undefined), false);
      assert.strictEqual(isMeasurableRect({ x: NaN, y: 0, width: 10, height: 10 }), false);
    });

    test('S1.4 Highlight radius follows the shape of the control', () => {
      const rect = { x: 0, y: 0, width: 120, height: 44 };
      assert.strictEqual(highlightRadius(rect, 'pill'), 22);
      assert.strictEqual(highlightRadius(rect, 'circle'), 60);
      assert.strictEqual(highlightRadius(rect, 'rect'), 18);
    });
  });

  describe('Spotlight Suite 2: Coaching Card Placement', () => {
    const cardHeight = 200;

    test('S2.1 Sits below a control near the top of the screen', () => {
      const target = { x: 20, y: 100, width: 200, height: 44 };
      const layout = resolveTooltipLayout({ target, screen: SCREEN, insets: INSETS, tooltipHeight: cardHeight });
      assert.strictEqual(layout.placement, 'below');
      assert.strictEqual(layout.top, target.y + target.height + TOOLTIP_GAP);
    });

    test('S2.2 Flips above a control near the bottom, like the tab bar', () => {
      const target = { x: 65, y: 770, width: 65, height: 50 };
      const layout = resolveTooltipLayout({ target, screen: SCREEN, insets: INSETS, tooltipHeight: cardHeight });
      assert.strictEqual(layout.placement, 'above');
      assert.strictEqual(layout.top, target.y - TOOLTIP_GAP - cardHeight);
    });

    test('S2.3 Never overlaps the safe area on either edge', () => {
      const targets = [
        { x: 10, y: 0, width: 60, height: 40 },
        { x: 10, y: SCREEN.height - 40, width: 60, height: 40 },
        { x: 10, y: 400, width: 60, height: 40 },
      ];
      for (const target of targets) {
        const layout = resolveTooltipLayout({ target, screen: SCREEN, insets: INSETS, tooltipHeight: cardHeight });
        assert.ok(layout.top >= INSETS.top + SCREEN_MARGIN, `top ${layout.top} above safe area`);
        assert.ok(
          layout.top + cardHeight <= SCREEN.height - INSETS.bottom - SCREEN_MARGIN + 0.001,
          `bottom ${layout.top + cardHeight} below safe area`
        );
      }
    });

    test('S2.4 An oversized card still lands on the roomier side', () => {
      const tall = 700;
      const nearTop = resolveTooltipLayout({
        target: { x: 10, y: 80, width: 60, height: 40 },
        screen: SCREEN,
        insets: INSETS,
        tooltipHeight: tall,
      });
      assert.strictEqual(nearTop.placement, 'below');

      const nearBottom = resolveTooltipLayout({
        target: { x: 10, y: 700, width: 60, height: 40 },
        screen: SCREEN,
        insets: INSETS,
        tooltipHeight: tall,
      });
      assert.strictEqual(nearBottom.placement, 'above');
    });

    test('S2.5 A step with no anchor centres its card and drops the arrow', () => {
      const layout = resolveTooltipLayout({ target: null, screen: SCREEN, insets: INSETS, tooltipHeight: cardHeight });
      assert.strictEqual(layout.placement, 'center');
      assert.strictEqual(layout.arrowLeft, null);
      assert.ok(layout.top > INSETS.top);
    });

    test('S2.6 The arrow points at the control but stays inside the card', () => {
      const middle = resolveTooltipLayout({
        target: { x: 175, y: 300, width: 40, height: 40 },
        screen: SCREEN,
        insets: INSETS,
        tooltipHeight: cardHeight,
      });
      // Control centre is 195; card starts at SCREEN_MARGIN.
      assert.strictEqual(middle.arrowLeft, 195 - SCREEN_MARGIN - ARROW_SIZE / 2);

      const farLeft = resolveTooltipLayout({
        target: { x: 0, y: 300, width: 30, height: 40 },
        screen: SCREEN,
        insets: INSETS,
        tooltipHeight: cardHeight,
      });
      assert.ok(farLeft.arrowLeft >= SCREEN_MARGIN);

      const farRight = resolveTooltipLayout({
        target: { x: SCREEN.width - 30, y: 300, width: 30, height: 40 },
        screen: SCREEN,
        insets: INSETS,
        tooltipHeight: cardHeight,
      });
      assert.ok(farRight.arrowLeft <= farRight.width - SCREEN_MARGIN - ARROW_SIZE);
    });

    test('S2.7 The card spans the screen minus its margins', () => {
      const layout = resolveTooltipLayout({
        target: { x: 20, y: 300, width: 60, height: 40 },
        screen: SCREEN,
        insets: INSETS,
        tooltipHeight: cardHeight,
      });
      assert.strictEqual(layout.left, SCREEN_MARGIN);
      assert.strictEqual(layout.width, SCREEN.width - SCREEN_MARGIN * 2);
    });

    test('S2.8 Works on a small screen without inverting the card', () => {
      const small = { width: 320, height: 568 };
      const layout = resolveTooltipLayout({
        target: { x: 40, y: 300, width: 60, height: 40 },
        screen: small,
        insets: { top: 20, bottom: 0, left: 0, right: 0 },
        tooltipHeight: 240,
      });
      assert.ok(layout.top >= 20 + SCREEN_MARGIN);
      assert.ok(layout.top + 240 <= small.height - SCREEN_MARGIN + 0.001);
      assert.ok(layout.width > 0);
    });
  });

  describe('Spotlight Suite 3: Tour Definitions', () => {
    const allTours = [['main', MAIN_TOUR], ...Object.entries(SCREEN_TOURS)];
    const knownTargets = new Set(Object.values(SPOTLIGHT_IDS));

    test('S3.1 Every step points at a registered spotlight id', () => {
      for (const [name, steps] of allTours) {
        for (const step of steps) {
          assert.ok(
            !step.targetId || knownTargets.has(step.targetId),
            `${name}/${step.id} targets unknown id "${step.targetId}"`
          );
        }
      }
    });

    test('S3.2 Step ids are unique inside each tour', () => {
      for (const [name, steps] of allTours) {
        const ids = steps.map((s) => s.id);
        assert.strictEqual(new Set(ids).size, ids.length, `${name} has duplicate step ids`);
      }
    });

    test('S3.3 Every step carries copy the card can render', () => {
      for (const [name, steps] of allTours) {
        for (const step of steps) {
          assert.ok(step.title && step.title.trim().length > 0, `${name}/${step.id} missing title`);
          assert.ok(step.body && step.body.trim().length > 0, `${name}/${step.id} missing body`);
        }
      }
    });

    test('S3.4 The welcome tour covers every tab in the tab bar', () => {
      const targets = MAIN_TOUR.map((s) => s.targetId);
      for (const id of [
        SPOTLIGHT_IDS.tabGrades,
        SPOTLIGHT_IDS.tabSchedule,
        SPOTLIGHT_IDS.tabCalendar,
        SPOTLIGHT_IDS.tabTasks,
        SPOTLIGHT_IDS.tabStudy,
      ]) {
        assert.ok(targets.includes(id), `welcome tour never highlights ${id}`);
      }
    });

    test('S3.5 Screen tours are registered under keys that get reset together', () => {
      for (const key of Object.keys(SCREEN_TOURS)) {
        assert.ok(ALL_TOUR_KEYS.includes(key), `${key} would never be reset`);
      }
      assert.ok(ALL_TOUR_KEYS.includes(TOUR_KEYS.main));
      assert.strictEqual(new Set(ALL_TOUR_KEYS).size, ALL_TOUR_KEYS.length);
    });

    test('S3.6 Padding constants stay positive so the ring never inverts', () => {
      assert.ok(SPOTLIGHT_PADDING > 0);
      assert.ok(TOOLTIP_GAP > 0);
      assert.ok(SCREEN_MARGIN > 0);
      assert.ok(ARROW_SIZE > 0);
    });
  });
}
