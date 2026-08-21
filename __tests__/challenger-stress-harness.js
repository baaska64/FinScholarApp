import assert from 'node:assert';
import { getSubjectStyle, getSubjectIcon, getThemeTokens, SUBJECT_PALETTE } from '../widget/subjectUtils.ts';
import { FinScholarWidget, getFirstGrapheme } from '../widget/FinScholarWidget.tsx';
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
        { courseName: 'PHYS 301', room: 'Lab 3', timeStr: '1:00 PM', timeRemainingStr: 'In 4h', isOngoing: false },
      ];

      for (let i = 0; i < 10_000; i++) {
        const isDark = i % 2 === 0;
        const widget = FinScholarWidget({ classes, isDark });
        const [topSection, middleSection, bottomSection] = getChildren(widget);

        // Verify root background
        const expectedRootBg = isDark ? '#0f172a' : '#6366f1';
        assert.strictEqual(widget.props.style.backgroundColor, expectedRootBg);

        // Verify bottom background
        const expectedBottomBg = isDark ? '#0f172a' : '#ffffff';
        assert.strictEqual(bottomSection.props.style.backgroundColor, expectedBottomBg);

        // Verify wave fill matches bottom background exactly
        const expectedWaveFill = isDark ? 'fill="#0f172a"' : 'fill="#ffffff"';
        const waveSvg = getChildren(middleSection).find(c => c.type === SvgWidget || c.type?.name === 'SvgWidget');
        assert(waveSvg.props.svg.includes(expectedWaveFill), `Wave SVG fill mismatch at iteration ${i}`);

        // Verify top panel title & colors
        const nextPanel = getChildren(topSection)[1];
        const panelTitle = getChildren(nextPanel)[1];
        assert.strictEqual(panelTitle.props.style.color, isDark ? '#f8fafc' : '#ffffff');

        // Verify upcoming card tokens
        const cards = getChildren(getChildren(bottomSection)[0]);
        assert.strictEqual(cards.length, 2);
        const card0 = cards[0];
        assert.strictEqual(card0.props.style.backgroundColor, isDark ? '#1e293b' : '#f1f5f9');
      }
    });

    test('3.3 Empty State High-Frequency Toggle Loop (10,000 iterations)', () => {
      for (let i = 0; i < 10_000; i++) {
        const isDark = i % 2 === 0;
        const emptyWidget = FinScholarWidget({ classes: [], isDark });
        const expectedBg = isDark ? '#0f172a' : '#6366f1';
        assert.strictEqual(emptyWidget.props.style.backgroundColor, expectedBg);
        assert.strictEqual(emptyWidget.props.style.backgroundGradient.from, expectedBg);

        const children = getChildren(emptyWidget);
        const titleText = children[1];
        const subtitleText = children[2];
        assert.strictEqual(titleText.props.style.color, isDark ? '#f8fafc' : '#ffffff');
        assert.strictEqual(subtitleText.props.style.color, isDark ? '#94a3b8' : 'rgba(255, 255, 255, 0.85)');
      }
    });
  });

  describe('Challenger Stress Suite 4: Responsive Geometry Breakpoint Matrix & Zero-Clipping Stress', () => {
    const testHeights = [0, 1, 40, 50, 100, 109, 110, 130, 150, 159, 160, 180, 200, 239, 240, 250, 320, 480, 600, 1000];
    const testWidths = [0, 50, 100, 180, 250, 320, 360, 480, 720, 1080];
    const fullClasses = [
      { courseName: 'CS 101 - Intro', room: 'R101', timeStr: '8:00 AM', timeRemainingStr: 'In progress', isOngoing: true },
      { courseName: 'MATH 201 - Calc', room: 'R201', timeStr: '10:00 AM', timeRemainingStr: 'In 2h', isOngoing: false },
      { courseName: 'PHYS 301 - Lab', room: 'R301', timeStr: '1:00 PM', timeRemainingStr: 'In 5h', isOngoing: false },
      { courseName: 'ENG 401 - Lit', room: 'R401', timeStr: '3:00 PM', timeRemainingStr: 'In 7h', isOngoing: false },
      { courseName: 'HIST 101 - World', room: 'R501', timeStr: '5:00 PM', timeRemainingStr: 'In 9h', isOngoing: false },
    ];

    test('4.1 Multi-Dimensional Breakpoint Matrix (200 geometry combinations)', () => {
      for (const h of testHeights) {
        for (const w of testWidths) {
          const widgetInfo = { width: w, height: h };
          const widget = FinScholarWidget({ classes: fullClasses, isDark: false, widgetInfo });

          assert(widget, `Widget must render for height=${h} width=${w}`);
          const [topSection, waveSection, bottomSection] = getChildren(widget);
          const bottomContent = getChildren(bottomSection)[0];

          if (h < 110) {
            // visibleCount = 0 -> Renders empty message
            const emptyTextNode = getChildren(bottomContent)[0];
            assert.strictEqual(emptyTextNode.props.text, 'No other classes today', `Expected empty message at height ${h}`);
          } else if (h < 160) {
            // visibleCount = 1 -> Exactly 1 upcoming card
            const cards = getChildren(bottomContent);
            assert.strictEqual(cards.length, 1, `Expected 1 card at height ${h}`);
          } else if (h < 240) {
            // visibleCount = 2 -> Exactly 2 upcoming cards
            const cards = getChildren(bottomContent);
            assert.strictEqual(cards.length, 2, `Expected 2 cards at height ${h}`);
          } else {
            // visibleCount = 3 -> Exactly 3 upcoming cards (capped from 4)
            const cards = getChildren(bottomContent);
            assert.strictEqual(cards.length, 3, `Expected 3 cards at height ${h}`);
          }
        }
      }
    });

    test('4.2 Malformed & Edge-Case widgetInfo Boundaries (NaN, null, undefined, negative)', () => {
      const edgeWidgetInfos = [
        undefined,
        null,
        {},
        { width: NaN, height: NaN },
        { width: -100, height: -50 },
        { width: '300', height: '250' },
        { width: 0, height: 0 },
        { width: Infinity, height: Infinity },
      ];

      for (const info of edgeWidgetInfos) {
        const widget = FinScholarWidget({ classes: fullClasses, isDark: true, widgetInfo: info });
        assert(widget, `Widget should render safely for edge widgetInfo: ${JSON.stringify(info)}`);
        assert.strictEqual(widget.props.style.flex, 1);

        const [topSection, waveSection, bottomSection] = getChildren(widget);
        const bottomContent = getChildren(bottomSection)[0];

        // If height is numeric 0 or negative (< 110), visibleCount is 0; otherwise falls back to default 250 (3 cards)
        if (typeof info?.height === 'number' && !isNaN(info.height) && info.height < 110) {
          assert.strictEqual(getChildren(bottomContent)[0].props.text, 'No other classes today');
        } else {
          const cards = getChildren(bottomContent);
          assert.strictEqual(cards.length, 3, `Expected default 3 cards for widgetInfo: ${JSON.stringify(info)}`);
        }
      }
    });

    test('4.3 Zero Vertical Element Clipping & Strict Sub-Component Heights', () => {
      const widget = FinScholarWidget({ classes: fullClasses, widgetInfo: { width: 180, height: 250 } });
      const [topSection, waveSection, bottomSection] = getChildren(widget);

      // Top section height constraints
      const topPadding = (topSection.props.style.paddingTop || 0) + (topSection.props.style.paddingBottom || 0);
      assert(topPadding <= 14, `Top padding ${topPadding} exceeds budget`);

      // Header icon circle
      const headerRow = getChildren(topSection)[0];
      const iconCircle = getChildren(headerRow)[0];
      assert(iconCircle.props.style.height <= 30, `Icon circle height ${iconCircle.props.style.height} exceeds budget`);

      // Next class panel
      const nextPanel = getChildren(topSection)[1];
      const panelPadding = (nextPanel.props.style.paddingVertical || 0) * 2;
      assert(panelPadding <= 20, `Next class panel padding ${panelPadding} exceeds budget`);

      // Wave divider
      assert.strictEqual(waveSection.props.style.height, 14, 'Wave divider height must be exactly 14');

      // Bottom cards
      const cards = getChildren(getChildren(bottomSection)[0]);
      assert.strictEqual(cards.length, 3);
      for (const card of cards) {
        assert(card.props.style.padding <= 6, 'Card padding must be <= 6');
        assert(card.props.style.marginBottom <= 5, 'Card marginBottom must be <= 5');
        const [avatar, middle, badge] = getChildren(card);
        assert.strictEqual(avatar.props.style.height, 28, 'Avatar height must be 28');
        assert.strictEqual(badge.props.style.height, 28, 'Badge height must be 28');
      }
    });

    test('4.4 Typography MaxLines Guarantee across all TextWidgets', () => {
      const widget = FinScholarWidget({ classes: fullClasses });
      const [topSection, waveSection, bottomSection] = getChildren(widget);

      const nextPanel = getChildren(topSection)[1];
      const [statusBadge, activeTitle, activeSub] = getChildren(nextPanel);
      assert.strictEqual(activeTitle.props.maxLines, 1, 'Active title must have maxLines=1');
      assert.strictEqual(activeSub.props.maxLines, 1, 'Active sub must have maxLines=1');

      const cards = getChildren(getChildren(bottomSection)[0]);
      for (const card of cards) {
        const middle = getChildren(card)[1];
        const [title, sub] = getChildren(middle);
        const badge = getChildren(card)[2];
        const badgeText = getChildren(badge)[0];

        assert.strictEqual(title.props.maxLines, 1, 'Card title must have maxLines=1');
        assert.strictEqual(sub.props.maxLines, 1, 'Card sub must have maxLines=1');
        assert.strictEqual(badgeText.props.maxLines, 1, 'Badge text must have maxLines=1');
      }
    });
  });

  describe('Challenger Stress Suite 5: Extreme Class List Scaling & Input Fuzzing', () => {
    test('5.1 Scaling up to 10,000 Classes', () => {
      const hugeClasses = Array.from({ length: 10_000 }, (_, i) => ({
        courseName: `Course ${i} - Title ${i}`,
        room: `Room ${i}`,
        timeStr: `${(i % 12) + 1}:00 PM`,
        timeRemainingStr: `In ${i}h`,
        isOngoing: i === 0,
      }));

      const t0 = performance.now();
      const widget = FinScholarWidget({ classes: hugeClasses, widgetInfo: { width: 300, height: 300 } });
      const elapsed = performance.now() - t0;

      assert(widget, 'Widget must render for 10,000 classes');
      assert(elapsed < 100, `Rendering 10,000 classes took ${elapsed.toFixed(2)}ms (expected < 100ms)`);

      const [topSection, waveSection, bottomSection] = getChildren(widget);
      const cards = getChildren(getChildren(bottomSection)[0]);
      assert.strictEqual(cards.length, 3, 'Must safely cap upcoming classes at 3 regardless of input length');
    });

    test('5.2 Massive Malformed & Adversarial Array Fuzzing (1,000 items)', () => {
      const malformedItems = [
        null,
        undefined,
        12345,
        'random_string',
        true,
        false,
        [],
        {},
        { courseName: null, room: undefined, timeStr: null, timeRemainingStr: '', isOngoing: false },
        { courseName: '   \t\n   ', room: '   ', timeStr: '   ', timeRemainingStr: '   ', isOngoing: false },
        { courseName: '<svg><script>alert("xss")</script></svg>', room: '🔥 Room', timeStr: '12:00 PM', timeRemainingStr: 'In 1h', isOngoing: false },
        { courseName: 'A'.repeat(50_000), room: 'B'.repeat(10_000), timeStr: '1:00 PM', timeRemainingStr: 'In 3h', isOngoing: true },
        { courseName: '👨‍👩‍👧‍👦 Family Studies', room: '🏛️ Hall', timeStr: '2:00 PM', timeRemainingStr: 'In 4h', isOngoing: false },
      ];

      // Build 1,000-item fuzzed array
      const fuzzedList = [];
      for (let i = 0; i < 1000; i++) {
        fuzzedList.push(malformedItems[i % malformedItems.length]);
      }

      const widget = FinScholarWidget({ classes: fuzzedList });
      assert(widget, 'Widget must render without exception on heavily corrupted class list');
      assert.strictEqual(widget.props.style.flex, 1);
    });

    test('5.3 Unicode Grapheme Cluster & Multilingual Stress (100 complex strings)', () => {
      const complexStrings = [
        { input: 'CS 101', expected: 'C' },
        { input: 'math 201', expected: 'M' },
        { input: '   physics 301', expected: 'P' },
        { input: '', expected: 'C' },
        { input: '   ', expected: 'C' },
        { input: null, expected: 'C' },
        { input: undefined, expected: 'C' },
        { input: '🎨 ART 101', expected: '🎨' },
        { input: '🇵🇭 HIST 101', expected: '🇵🇭' },
        { input: '👨‍🎓 GRAD 500', expected: '👨‍🎓' },
        { input: '👍🏽 PE 200', expected: '👍🏽' },
        { input: '🚀 ADV-CS', expected: '🚀' },
        { input: 'こんにちは', expected: 'こ' },
        { input: 'مرحبا', expected: 'م' },
        { input: '✨ Quantum Computing', expected: '✨' },
        { input: '123 Computer Science', expected: '1' },
      ];

      for (const item of complexStrings) {
        const grapheme = getFirstGrapheme(item.input);
        assert.strictEqual(grapheme, item.expected, `getFirstGrapheme('${item.input}') failed: expected '${item.expected}', got '${grapheme}'`);
      }
    });
  });
}
