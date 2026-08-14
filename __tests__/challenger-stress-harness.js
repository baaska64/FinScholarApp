import assert from 'node:assert';
import { getSubjectStyle, getSubjectIcon, getThemeTokens, SUBJECT_PALETTE } from '../widget/subjectUtils.ts';
import { FinScholarWidget } from '../widget/FinScholarWidget.tsx';
import { FlexWidget, TextWidget, SvgWidget } from 'react-native-android-widget';

function getChildren(node) {
  if (!node || !node.props) return [];
  if (Array.isArray(node.props.children)) return node.props.children.filter(Boolean);
  return node.props.children ? [node.props.children] : [];
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
        '\0\u0001\uFFFF',
        '\uD83D\uDE00\uD83D\uDE02',
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

  describe('Challenger Stress Suite 2: Component Tree & Flex Layout Stability', () => {
    const buildMockClasses = (count) => {
      const items = [];
      for (let i = 0; i < count; i++) {
        items.push({
          courseName: i === 0 ? 'CS 101 - Intro to CS' : `Subject ${i} - Advanced Topic`,
          room: `Room ${100 + i}`,
          timeStr: `${8 + (i % 8)}:00 AM`,
          timeRemainingStr: i === 0 ? 'In progress' : `In ${i}h`,
          isOngoing: i === 0,
        });
      }
      return items;
    };

    test('2.1 Class Count Scaling (0, 1, 2, 4, 10, 50 classes)', () => {
      const counts = [0, 1, 2, 4, 10, 50];

      for (const count of counts) {
        const classes = buildMockClasses(count);
        const widget = FinScholarWidget({ classes, isDark: false });

        assert(widget, `Widget should render for ${count} classes`);
        assert.strictEqual(widget.props.style.flex, 1);
        assert.strictEqual(widget.props.style.width, 'match_parent');
        assert.strictEqual(widget.props.style.borderRadius, 32);

        if (count === 0) {
          // Empty state structure
          const children = getChildren(widget);
          assert.strictEqual(children.length, 3, 'Empty state should have calendar icon container, TextWidget title, TextWidget subtitle');
          assert.strictEqual(children[1].props.text, 'No upcoming classes!');
        } else {
          // Main layout structure (Top Section + Middle Wavy Divider + Bottom White Section)
          const children = getChildren(widget);
          assert.strictEqual(children.length, 3, 'Main widget should have top section, middle wavy divider, and bottom section');

          const topSection = children[0];
          const middleSection = children[1];
          const bottomSection = children[2];

          // Top section structure check
          assert.strictEqual(topSection.props.style.width, 'match_parent');

          // Middle section wave divider check
          const waveSvg = getChildren(middleSection).find(c => c.type === SvgWidget || c.type?.name === 'SvgWidget');
          assert(waveSvg, 'Middle section should contain SvgWidget wave');

          // Bottom section flex check
          assert.strictEqual(bottomSection.props.style.flex, 1);
          assert.strictEqual(bottomSection.props.style.width, 'match_parent');
          assert.strictEqual(bottomSection.props.style.backgroundColor, '#ffffff');

          const bottomChildren = getChildren(bottomSection);
          if (count === 1) {
            // 1 active class -> 0 upcoming classes -> renders empty state text
            const emptyTextNode = getChildren(bottomChildren[0])[0];
            assert.strictEqual(emptyTextNode.props.text, 'No other classes today');
          } else {
            // count - 1 upcoming classes (capped at visibleCount = 3)
            const upcomingCount = Math.min(count - 1, 3);
            const listContainer = bottomChildren[0];
            const cards = getChildren(listContainer);
            assert.strictEqual(cards.length, upcomingCount, `Expected ${upcomingCount} upcoming cards for ${count} classes`);

            // Verify each card layout stability
            cards.forEach((card, idx) => {
              assert.strictEqual(card.props.style.flexDirection, 'row');
              assert.strictEqual(card.props.style.alignItems, 'center');
              assert.strictEqual(card.props.style.borderRadius, 28);
              assert.strictEqual(String(card.key), String(idx), `Card at index ${idx} should have stable key=${idx}`);
            });
          }
        }
      }
    });

    test('2.2 Wave SVG Path Fill Stability Across Layout Trees', () => {
      const classes = buildMockClasses(3);

      const widget = FinScholarWidget({ classes, isDark: false });
      const middleSection = getChildren(widget)[1];
      const svgWave = getChildren(middleSection).find(c => c.type === SvgWidget || c.type?.name === 'SvgWidget');
      assert(svgWave, 'SvgWidget wave must exist');
      assert(svgWave.props.svg.includes('fill="#ffffff"'), 'Wave fill must be #ffffff');
    });
  });

  describe('Challenger Stress Suite 3: Dark Mode Toggling & Theme Tokens', () => {
    test('3.1 Theme Token Parity & Contract Completeness', () => {
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

    test('3.2 High-Frequency Toggle Loop (10,000 iterations)', () => {
      const classes = [
        { courseName: 'CS 101', room: 'R101', timeStr: '9:00 AM', timeRemainingStr: 'In progress', isOngoing: true },
        { courseName: 'MATH 201', room: 'R202', timeStr: '11:00 AM', timeRemainingStr: 'In 2h', isOngoing: false },
      ];

      for (let i = 0; i < 10_000; i++) {
        const isDark = i % 2 === 0;
        const widget = FinScholarWidget({ classes, isDark });
        const bottomSection = getChildren(widget)[2];

        assert.strictEqual(bottomSection.props.style.backgroundColor, '#ffffff');
      }
    });
  });
}
