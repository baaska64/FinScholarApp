import assert from 'node:assert';
import { FinScholarWidget, getFirstGrapheme } from '../widget/FinScholarWidget.tsx';
import { FlexWidget, TextWidget, SvgWidget } from 'react-native-android-widget';

function getChildren(node) {
  if (!node || !node.props) return [];
  if (Array.isArray(node.props.children)) return node.props.children.filter(Boolean);
  return node.props.children ? [node.props.children] : [];
}

export function runWidgetTests(describe, test) {
  describe('Widget Redesign Suite 1: Layout & Deep Link Contracts', () => {
    test('1.1 Root layout is FlexWidget with flex: 1 and match_parent width', () => {
      const widget = FinScholarWidget({ classes: [] });
      assert(widget.type === FlexWidget || widget.type?.name === 'FlexWidget');
      assert.strictEqual(widget.props.style.flex, 1);
      assert.strictEqual(widget.props.style.width, 'match_parent');
    });

    test('1.2 Root container includes OPEN_APP clickAction and finscholarapp URI deep link', () => {
      const widget = FinScholarWidget({ classes: [] });
      assert.strictEqual(widget.props.clickAction, 'OPEN_APP');
      assert(
        widget.props.clickActionData &&
        typeof widget.props.clickActionData.uri === 'string' &&
        widget.props.clickActionData.uri.startsWith('finscholarapp://schedule?viewMode=attendance'),
        `Expected deep link URI starting with finscholarapp://schedule?viewMode=attendance, got ${JSON.stringify(widget.props.clickActionData)}`
      );
    });

    test('1.3 Main widget has blue/purple gradient background with rounded corners', () => {
      const sampleClass = [{
        courseName: 'CS 101',
        room: 'Room 101',
        timeStr: '10:00 AM',
        timeRemainingStr: 'In 30m',
        isOngoing: false,
      }];

      const widget = FinScholarWidget({ classes: sampleClass });
      assert.strictEqual(widget.props.style.borderRadius, 32);
      assert(widget.props.style.backgroundGradient, 'Should have background gradient');
      assert.strictEqual(widget.props.style.backgroundGradient.from, '#6366f1');
      assert.strictEqual(widget.props.style.backgroundGradient.to, '#4338ca');
    });
  });

  describe('Widget Redesign Suite 2: Top Section & Next Class Panel', () => {
    test('2.1 Top section contains calendar icon SVG', () => {
      const sampleClass = [{
        courseName: 'CS 101',
        room: 'Room 101',
        timeStr: '10:00 AM',
        timeRemainingStr: 'In 30m',
        isOngoing: false,
      }];

      const widget = FinScholarWidget({ classes: sampleClass });
      const rootChildren = getChildren(widget);
      const topSection = rootChildren[0];
      const topChildren = getChildren(topSection);
      
      const headerRow = topChildren[0];
      const iconCircle = getChildren(headerRow)[0];
      const calendarSvg = getChildren(iconCircle)[0];

      assert(calendarSvg.type === SvgWidget || calendarSvg.type?.name === 'SvgWidget');
      assert(calendarSvg.props.svg.includes('rect'), 'Calendar SVG should include rect');
    });

    test('2.2 Renders ONGOING CLASS status badge when active class is ongoing', () => {
      const ongoingClass = [{
        courseName: 'CSIT 227',
        room: 'Lab 3',
        timeStr: '10:00 AM',
        timeRemainingStr: 'In progress',
        isOngoing: true,
      }];

      const widget = FinScholarWidget({ classes: ongoingClass });
      const topSection = getChildren(widget)[0];
      const topChildren = getChildren(topSection);
      const nextPanel = topChildren[1];
      const panelChildren = getChildren(nextPanel);
      const statusText = panelChildren[0];

      assert.strictEqual(statusText.props.text, 'ONGOING CLASS');
    });

    test('2.3 Renders NEXT CLASS status badge when active class is upcoming', () => {
      const upcomingClass = [{
        courseName: 'MATH 201',
        room: 'Room 402',
        timeStr: '1:00 PM',
        timeRemainingStr: 'In 2 hours',
        isOngoing: false,
      }];

      const widget = FinScholarWidget({ classes: upcomingClass });
      const topSection = getChildren(widget)[0];
      const topChildren = getChildren(topSection);
      const nextPanel = topChildren[1];
      const panelChildren = getChildren(nextPanel);
      const statusText = panelChildren[0];

      assert.strictEqual(statusText.props.text, 'NEXT CLASS');
    });

    test('2.4 Active class panel formats course name, room, and countdown correctly', () => {
      const sampleClass = [{
        courseName: 'CS 101 - Intro to CS',
        room: 'Room 303',
        timeStr: '9:00 AM',
        timeRemainingStr: 'In 45m',
        isOngoing: false,
      }];

      const widget = FinScholarWidget({ classes: sampleClass });
      const topSection = getChildren(widget)[0];
      const nextPanel = getChildren(topSection)[1];
      const panelChildren = getChildren(nextPanel);

      const titleText = panelChildren[1];
      assert.strictEqual(titleText.props.text, 'CS 101', 'Should strip suffix after dash');

      const roomText = panelChildren[2];
      assert.strictEqual(roomText.props.text, 'Room 303 • In 45m');
    });
  });

  describe('Widget Redesign Suite 3: Middle Section Wavy SVG Divider', () => {
    test('3.1 Middle section renders wavy SvgWidget divider with white fill', () => {
      const sampleClass = [{
        courseName: 'PHYS 101',
        room: 'Sci Hall',
        timeStr: '8:00 AM',
        timeRemainingStr: 'In 10m',
        isOngoing: false,
      }];

      const widget = FinScholarWidget({ classes: sampleClass });
      const rootChildren = getChildren(widget);
      const middleSection = rootChildren[1];
      const middleChildren = getChildren(middleSection);
      const waveSvg = middleChildren.find(c => c.type === SvgWidget || c.type?.name === 'SvgWidget');

      assert(waveSvg, 'SvgWidget should be present in middle section');
      assert(
        waveSvg.props.svg.includes('fill="#ffffff"'),
        `Expected SvgWidget fill #ffffff, got ${waveSvg.props.svg}`
      );
    });
  });

  describe('Widget Redesign Suite 4: Bottom Section & Upcoming Class Pill Items', () => {
    test('4.1 Bottom section is a solid white container with rounded bottom corners', () => {
      const sampleClasses = [
        { courseName: 'CS 101', room: 'R1', timeStr: '9am', timeRemainingStr: '', isOngoing: false },
        { courseName: 'MATH 101', room: 'R2', timeStr: '10am', timeRemainingStr: '', isOngoing: false }
      ];

      const widget = FinScholarWidget({ classes: sampleClasses });
      const bottomSection = getChildren(widget)[2];
      assert.strictEqual(bottomSection.props.style.backgroundColor, '#ffffff');
      assert.strictEqual(bottomSection.props.style.borderBottomLeftRadius, 32);
      assert.strictEqual(bottomSection.props.style.borderBottomRightRadius, 32);
    });

    test('4.2 Maps upcoming classes into pill-shaped items with avatar and time slots', () => {
      const classes = [
        { courseName: 'CSIT 101', room: 'Lab 1', timeStr: '8:00 AM', timeRemainingStr: '', isOngoing: false },
        { courseName: 'CSIT 202', room: 'Lab 2', timeStr: '10:00 AM', timeRemainingStr: 'In 2h', isOngoing: false },
        { courseName: 'MATH 301', room: 'Room 3', timeStr: '1:00 PM', timeRemainingStr: 'In 5h', isOngoing: false },
      ];

      const widget = FinScholarWidget({ classes });
      const bottomSection = getChildren(widget)[2];
      const listContainer = getChildren(bottomSection)[0];
      const cards = getChildren(listContainer);

      assert.strictEqual(cards.length, 2);

      // Card 1
      const card1 = cards[0];
      assert.strictEqual(card1.props.style.borderRadius, 28);
      assert.strictEqual(card1.props.style.backgroundColor, '#f1f5f9');

      const card1Children = getChildren(card1);
      const avatar1 = card1Children[0];
      const avatar1Text = getChildren(avatar1)[0];
      assert.strictEqual(avatar1Text.props.text, 'C'); // First initial of CSIT 202

      const middle1 = card1Children[1];
      const title1 = getChildren(middle1)[0];
      assert.strictEqual(title1.props.text, 'CSIT 202');

      const timeSlot1 = card1Children[2];
      const timeSlot1Text = getChildren(timeSlot1)[0];
      assert.strictEqual(timeSlot1Text.props.text, '2h'); // "In 2h" -> "2h"

      // Card 2
      const card2 = cards[1];
      const card2Children = getChildren(card2);
      const avatar2 = card2Children[0];
      const avatar2Text = getChildren(avatar2)[0];
      assert.strictEqual(avatar2Text.props.text, 'M'); // First initial of MATH 301
    });

    test('4.3 Responsive visibleCount limits upcoming classes on smaller heights', () => {
      const classes = [
        { courseName: 'CS 1', room: 'R1', timeStr: '8:00 AM', timeRemainingStr: '', isOngoing: false },
        { courseName: 'CS 2', room: 'R2', timeStr: '10:00 AM', timeRemainingStr: 'In 2h', isOngoing: false },
        { courseName: 'CS 3', room: 'R3', timeStr: '12:00 PM', timeRemainingStr: 'In 4h', isOngoing: false },
        { courseName: 'CS 4', room: 'R4', timeStr: '2:00 PM', timeRemainingStr: 'In 6h', isOngoing: false },
      ];

      // Very small widget height (< 110) -> 0 upcoming
      const smallWidget = FinScholarWidget({ classes, widgetInfo: { width: 300, height: 100 } });
      const smallBottom = getChildren(smallWidget)[2];
      const smallEmpty = getChildren(smallBottom)[0];
      assert.strictEqual(getChildren(smallEmpty)[0].props.text, 'No other classes today');

      // Compact 3x2 widget height (< 160) -> 1 upcoming
      const compactWidget = FinScholarWidget({ classes, widgetInfo: { width: 300, height: 140 } });
      const compactBottom = getChildren(compactWidget)[2];
      const compactCards = getChildren(getChildren(compactBottom)[0]);
      assert.strictEqual(compactCards.length, 1);

      // Medium 3x3 widget height (< 240) -> 2 upcoming
      const medWidget = FinScholarWidget({ classes, widgetInfo: { width: 300, height: 200 } });
      const medBottom = getChildren(medWidget)[2];
      const medCards = getChildren(getChildren(medBottom)[0]);
      assert.strictEqual(medCards.length, 2);

      // Normal 3x4 / 4x5 widget height (>= 240) -> up to 3 upcoming
      const normWidget = FinScholarWidget({ classes, widgetInfo: { width: 300, height: 250 } });
      const normBottom = getChildren(normWidget)[2];
      const normCards = getChildren(getChildren(normBottom)[0]);
      assert.strictEqual(normCards.length, 3);
    });
  });

  describe('Widget Redesign Suite 5: Empty State & Null Resilience', () => {
    test('5.1 Empty or undefined classes prop renders empty state without mascot image', () => {
      const widgetEmpty = FinScholarWidget({ classes: [] });
      assert(widgetEmpty.type === FlexWidget || widgetEmpty.type?.name === 'FlexWidget');

      const emptyChildren = getChildren(widgetEmpty);
      const iconContainer = emptyChildren[0];
      const iconSvg = getChildren(iconContainer)[0];
      assert(iconSvg.type === SvgWidget || iconSvg.type?.name === 'SvgWidget');

      const title = emptyChildren[1];
      assert.strictEqual(title.props.text, 'No upcoming classes!');

      const subtitle = emptyChildren[2];
      assert.strictEqual(subtitle.props.text, 'Enjoy your free time ☀️');

      const widgetUndefined = FinScholarWidget({});
      const undefinedChildren = getChildren(widgetUndefined);
      assert.strictEqual(undefinedChildren[1].props.text, 'No upcoming classes!');
    });

    test('5.2 Null/empty/undefined fields inside class objects render safely without crash', () => {
      const malformedClasses = [{
        courseName: '',
        room: null,
        timeStr: undefined,
        timeRemainingStr: null,
        isOngoing: false,
      }];

      const widget = FinScholarWidget({ classes: malformedClasses });
      assert(widget.type === FlexWidget || widget.type?.name === 'FlexWidget');
    });

    test('5.3 Sparse array with null/undefined entries and non-array classes prop handle safely', () => {
      const ongoingClass = {
        courseName: 'CS 101',
        room: 'Room 101',
        timeStr: '10:00 AM',
        timeRemainingStr: 'In progress',
        isOngoing: true,
      };

      const widgetWithNulls = FinScholarWidget({ classes: [ongoingClass, null, undefined, { courseName: 'CS 102' }] });
      assert(widgetWithNulls.type === FlexWidget || widgetWithNulls.type?.name === 'FlexWidget');

      const widgetNullProp = FinScholarWidget({ classes: null });
      assert(widgetNullProp.type === FlexWidget || widgetNullProp.type?.name === 'FlexWidget');

      const widgetInvalidProp = FinScholarWidget({ classes: 'invalid' });
      assert(widgetInvalidProp.type === FlexWidget || widgetInvalidProp.type?.name === 'FlexWidget');
    });

    test('5.4 Formats subtitles cleanly without dangling separators when fields are missing', () => {
      const classNoCountdown = [{
        courseName: 'CS 101',
        room: 'Lab 1',
        timeStr: '9:00 AM',
        timeRemainingStr: '',
        isOngoing: false,
      }, {
        courseName: 'CS 102',
        room: 'Lab 2',
        timeStr: '',
        timeRemainingStr: 'In 2h',
        isOngoing: false,
      }];

      const widget = FinScholarWidget({ classes: classNoCountdown });
      const topSection = getChildren(widget)[0];
      const nextPanel = getChildren(topSection)[1];
      const panelChildren = getChildren(nextPanel);
      const topSubtitle = panelChildren[2];
      assert.strictEqual(topSubtitle.props.text, 'Lab 1');

      const bottomSection = getChildren(widget)[2];
      const listContainer = getChildren(bottomSection)[0];
      const card = getChildren(listContainer)[0];
      const middleContent = getChildren(card)[1];
      const cardSubtitle = getChildren(middleContent)[1];
      assert.strictEqual(cardSubtitle.props.text, 'Lab 2');
    });

    test('5.5 Whitespace-only fields fall back to defaults cleanly without blank titles', () => {
      const whitespaceClasses = [{
        courseName: '   ',
        room: '   ',
        timeStr: '   ',
        timeRemainingStr: '   ',
        isOngoing: false,
      }, {
        courseName: '   ',
        room: '   ',
        timeStr: '   ',
        timeRemainingStr: '   ',
        isOngoing: false,
      }];

      const widget = FinScholarWidget({ classes: whitespaceClasses });
      const topSection = getChildren(widget)[0];
      const nextPanel = getChildren(topSection)[1];
      const panelChildren = getChildren(nextPanel);
      const titleText = panelChildren[1];
      assert.strictEqual(titleText.props.text, 'Unnamed Class');
      const subtitleText = panelChildren[2];
      assert.strictEqual(subtitleText.props.text, 'TBA');

      const bottomSection = getChildren(widget)[2];
      const listContainer = getChildren(bottomSection)[0];
      const card = getChildren(listContainer)[0];
      const cardChildren = getChildren(card);
      const avatarText = getChildren(cardChildren[0])[0];
      assert.strictEqual(avatarText.props.text, 'U'); // First letter of Unnamed Class
      const middleContent = cardChildren[1];
      const cardTitle = getChildren(middleContent)[0];
      assert.strictEqual(cardTitle.props.text, 'Unnamed Class');
      const cardSubtitle = getChildren(middleContent)[1];
      assert.strictEqual(cardSubtitle.props.text, 'TBA');
    });

    test('5.6 Handles array of mixed primitive items (numbers, booleans, strings) safely', () => {
      const mixedClasses = [123, true, 'corrupted_string', { courseName: 'CS 101', isOngoing: false }];
      const widget = FinScholarWidget({ classes: mixedClasses });
      assert(widget.type === FlexWidget || widget.type?.name === 'FlexWidget');

      const topSection = getChildren(widget)[0];
      const nextPanel = getChildren(topSection)[1];
      const titleText = getChildren(nextPanel)[1];
      assert.strictEqual(titleText.props.text, 'CS 101');
    });

    test('5.7 Handles numeric and boolean values inside class fields safely without type errors', () => {
      const numericFieldsClasses = [
        { courseName: 101, room: 202, timeStr: 303, timeRemainingStr: 404, isOngoing: false },
        { courseName: 505, room: 606, timeStr: 707, timeRemainingStr: 808, isOngoing: false }
      ];
      const widget = FinScholarWidget({ classes: numericFieldsClasses });
      assert(widget.type === FlexWidget || widget.type?.name === 'FlexWidget');

      const topSection = getChildren(widget)[0];
      const nextPanel = getChildren(topSection)[1];
      const panelChildren = getChildren(nextPanel);
      const titleText = panelChildren[1];
      assert.strictEqual(titleText.props.text, '101');
      const subtitleText = panelChildren[2];
      assert.strictEqual(subtitleText.props.text, '202 • 404');
    });

    test('5.8 Safely ignores nested arrays inside classes prop', () => {
      const nestedClasses = [['corrupted_nested_array'], { courseName: 'CS 201', isOngoing: false }];
      const widget = FinScholarWidget({ classes: nestedClasses });
      assert(widget.type === FlexWidget || widget.type?.name === 'FlexWidget');

      const topSection = getChildren(widget)[0];
      const nextPanel = getChildren(topSection)[1];
      const titleText = getChildren(nextPanel)[1];
      assert.strictEqual(titleText.props.text, 'CS 201');
    });

    test('5.9 Suppresses time badge when timeStr is whitespace-only', () => {
      const whitespaceTimeClass = [{
        courseName: 'CS 101',
        room: 'Room 1',
        timeStr: '   ',
        timeRemainingStr: 'In 1h',
        isOngoing: false,
      }];
      const widget = FinScholarWidget({ classes: whitespaceTimeClass });
      const topSection = getChildren(widget)[0];
      const nextPanel = getChildren(topSection)[1];
      const panelChildren = getChildren(nextPanel);
      // panelChildren: [statusText, titleText, subtitleText], no timeBadge
      assert.strictEqual(panelChildren.length, 3);
    });

    test('5.10 Handles widgetInfo height 0 and NaN boundaries correctly', () => {
      const sampleClasses = [
        { courseName: 'CS 101', isOngoing: false },
        { courseName: 'CS 102', isOngoing: false }
      ];
      // Height 0 should be treated as very small (0 upcoming classes shown)
      const widgetZero = FinScholarWidget({ classes: sampleClasses, widgetInfo: { width: 300, height: 0 } });
      const bottomZero = getChildren(widgetZero)[2];
      const emptyMsgZero = getChildren(bottomZero)[0];
      assert.strictEqual(getChildren(emptyMsgZero)[0].props.text, 'No other classes today');

      // Height NaN should fall back to default height (up to 3 upcoming classes shown)
      const widgetNaN = FinScholarWidget({ classes: sampleClasses, widgetInfo: { width: 300, height: NaN } });
      const bottomNaN = getChildren(widgetNaN)[2];
      const cardsNaN = getChildren(getChildren(bottomNaN)[0]);
      assert.strictEqual(cardsNaN.length, 1);
    });
  });

  describe('Widget Compaction & Native 3x4 Registration Suite 6', () => {
    test('6.1 UI Compaction: Active class panel, typography, and paddings are measurably smaller', () => {
      const sampleClass = [{
        courseName: 'CS 101 - Intro to CS',
        room: 'Room 303',
        timeStr: '9:00 AM',
        timeRemainingStr: 'In 45m',
        isOngoing: false,
      }];

      const widget = FinScholarWidget({ classes: sampleClass });
      const topSection = getChildren(widget)[0];
      assert(topSection.props.style.paddingTop <= 12, 'Top padding should be compact (<= 12)');
      assert(topSection.props.style.paddingHorizontal <= 14, 'Horizontal padding should be compact (<= 14)');

      const topChildren = getChildren(topSection);
      const iconHeader = topChildren[0];
      const iconCircle = getChildren(iconHeader)[0];
      assert(iconCircle.props.style.width <= 32, 'Header icon circle width should be <= 32');
      assert(iconCircle.props.style.height <= 32, 'Header icon circle height should be <= 32');

      const nextPanel = topChildren[1];
      assert(nextPanel.props.style.paddingVertical <= 10, 'Next panel paddingVertical should be <= 10');
      assert(nextPanel.props.style.paddingHorizontal <= 14, 'Next panel paddingHorizontal should be <= 14');

      const panelChildren = getChildren(nextPanel);
      const statusBadge = panelChildren[0];
      assert(statusBadge.props.style.fontSize <= 10, 'Status badge fontSize should be <= 10');

      const titleText = panelChildren[1];
      assert(titleText.props.style.fontSize <= 18, 'Course title fontSize should be <= 18');

      const subtitleText = panelChildren[2];
      assert(subtitleText.props.style.fontSize <= 11, 'Subtitle fontSize should be <= 11');

      const timeBadgeWrapper = panelChildren[3];
      const timeBadge = getChildren(timeBadgeWrapper)[0];
      const timeText = getChildren(timeBadge)[1];
      assert(timeText.props.style.fontSize <= 11, 'Time badge fontSize should be <= 11');
    });

    test('6.2 UI Compaction: Wave divider and upcoming class items are measurably compact', () => {
      const classes = [
        { courseName: 'CS 101', room: 'Lab 1', timeStr: '8:00 AM', timeRemainingStr: '', isOngoing: false },
        { courseName: 'MATH 201', room: 'Room 2', timeStr: '10:00 AM', timeRemainingStr: 'In 2h', isOngoing: false },
        { courseName: 'PHYS 301', room: 'Lab 3', timeStr: '1:00 PM', timeRemainingStr: 'In 5h', isOngoing: false },
        { courseName: 'ENG 401', room: 'Hall A', timeStr: '3:00 PM', timeRemainingStr: 'In 7h', isOngoing: false },
      ];

      const widget = FinScholarWidget({ classes });
      const rootChildren = getChildren(widget);
      const waveDivider = rootChildren[1];
      assert(waveDivider.props.style.height <= 18, 'Wave divider height should be <= 18');

      const bottomSection = rootChildren[2];
      assert(bottomSection.props.style.paddingBottom <= 10, 'Bottom padding should be <= 10');

      const listContainer = getChildren(bottomSection)[0];
      const items = getChildren(listContainer);
      assert.strictEqual(items.length, 3, 'Should render 3 upcoming items');

      const firstItem = items[0];
      assert(firstItem.props.style.padding <= 6, 'Item padding should be <= 6');
      assert(firstItem.props.style.marginBottom <= 6, 'Item marginBottom should be <= 6');

      const itemChildren = getChildren(firstItem);
      const avatarCircle = itemChildren[0];
      assert(avatarCircle.props.style.width <= 32, 'Avatar circle width should be <= 32');
      assert(avatarCircle.props.style.height <= 32, 'Avatar circle height should be <= 32');

      const avatarText = getChildren(avatarCircle)[0];
      assert(avatarText.props.style.fontSize <= 14, 'Avatar initial fontSize should be <= 14');

      const middleContent = itemChildren[1];
      const itemTitle = getChildren(middleContent)[0];
      assert(itemTitle.props.style.fontSize <= 13, 'Upcoming item title fontSize should be <= 13');

      const itemSub = getChildren(middleContent)[1];
      assert(itemSub.props.style.fontSize <= 11, 'Upcoming item subtitle fontSize should be <= 11');

      const rightBadge = itemChildren[2];
      assert(rightBadge.props.style.width <= 32, 'Right countdown badge width should be <= 32');
      assert(rightBadge.props.style.height <= 32, 'Right countdown badge height should be <= 32');

      const rightText = getChildren(rightBadge)[0];
      assert(rightText.props.style.fontSize <= 10, 'Countdown text fontSize should be <= 10');
    });

    test('6.3 Native Widget Registration: app.json and native XML reflect 3x4 grid dimensions', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      // Check app.json
      const appJsonPath = path.resolve('app.json');
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      const widgetPlugin = appJson.expo.plugins.find(
        p => Array.isArray(p) && p[0] === 'react-native-android-widget'
      );
      assert(widgetPlugin, 'react-native-android-widget plugin must be present in app.json');
      const widgetConfig = widgetPlugin[1].widgets[0];
      assert.strictEqual(widgetConfig.minWidth, '180dp', 'app.json minWidth should be 180dp for 3 columns');
      assert.strictEqual(widgetConfig.minHeight, '250dp', 'app.json minHeight should be 250dp for 4 rows');
      assert.strictEqual(widgetConfig.targetCellWidth, 3, 'targetCellWidth should be 3');
      assert.strictEqual(widgetConfig.targetCellHeight, 4, 'targetCellHeight should be 4');

      // Check android native xml
      const xmlPath = path.resolve('android/app/src/main/res/xml/widgetprovider_finscholarwidget.xml');
      const xmlContent = fs.readFileSync(xmlPath, 'utf8');
      assert(xmlContent.includes('android:minWidth="180dp"'), 'Native XML must contain android:minWidth="180dp"');
      assert(xmlContent.includes('android:minHeight="250dp"'), 'Native XML must contain android:minHeight="250dp"');
      assert(xmlContent.includes('android:targetCellWidth="3"'), 'Native XML must contain android:targetCellWidth="3"');
      assert(xmlContent.includes('android:targetCellHeight="4"'), 'Native XML must contain android:targetCellHeight="4"');
    });
  });

  describe('Widget Adversarial Reviewer Suite 7: Strict Boundary & Layout Budget Contracts', () => {
    test('7.1 Precise responsive height threshold boundary checks (<110, <160, <240, >=240)', () => {
      const classes = [
        { courseName: 'Active Class', room: 'R0', timeStr: '8:00 AM', isOngoing: false },
        { courseName: 'Class 1', room: 'R1', timeStr: '9:00 AM', isOngoing: false },
        { courseName: 'Class 2', room: 'R2', timeStr: '10:00 AM', isOngoing: false },
        { courseName: 'Class 3', room: 'R3', timeStr: '11:00 AM', isOngoing: false },
      ];

      // At height 109 (< 110) -> 0 upcoming
      const w109 = FinScholarWidget({ classes, widgetInfo: { width: 250, height: 109 } });
      const b109 = getChildren(w109)[2];
      assert.strictEqual(getChildren(getChildren(b109)[0])[0].props.text, 'No other classes today');

      // At height 110 (< 160) -> 1 upcoming
      const w110 = FinScholarWidget({ classes, widgetInfo: { width: 250, height: 110 } });
      const b110 = getChildren(w110)[2];
      assert.strictEqual(getChildren(getChildren(b110)[0]).length, 1);

      // At height 159 (< 160) -> 1 upcoming
      const w159 = FinScholarWidget({ classes, widgetInfo: { width: 250, height: 159 } });
      const b159 = getChildren(w159)[2];
      assert.strictEqual(getChildren(getChildren(b159)[0]).length, 1);

      // At height 160 (< 240) -> 2 upcoming
      const w160 = FinScholarWidget({ classes, widgetInfo: { width: 250, height: 160 } });
      const b160 = getChildren(w160)[2];
      assert.strictEqual(getChildren(getChildren(b160)[0]).length, 2);

      // At height 239 (< 240) -> 2 upcoming
      const w239 = FinScholarWidget({ classes, widgetInfo: { width: 250, height: 239 } });
      const b239 = getChildren(w239)[2];
      assert.strictEqual(getChildren(getChildren(b239)[0]).length, 2);

      // At height 240 (>= 240) -> 3 upcoming
      const w240 = FinScholarWidget({ classes, widgetInfo: { width: 250, height: 240 } });
      const b240 = getChildren(w240)[2];
      assert.strictEqual(getChildren(getChildren(b240)[0]).length, 3);
    });

    test('7.2 Overflow class capping: 10 classes passed -> exactly 3 upcoming rendered', () => {
      const manyClasses = Array.from({ length: 10 }, (_, i) => ({
        courseName: `Class ${i + 1}`,
        room: `Room ${i + 1}`,
        timeStr: `${8 + i}:00 AM`,
        isOngoing: i === 0,
      }));

      const widget = FinScholarWidget({ classes: manyClasses, widgetInfo: { width: 250, height: 320 } });
      const bottom = getChildren(widget)[2];
      const items = getChildren(getChildren(bottom)[0]);
      assert.strictEqual(items.length, 3, 'Must cap visible upcoming items at 3');
    });

    test('7.3 Layout budget calculation: Total vertical element height is strictly under 300dp', () => {
      const classes = [
        { courseName: 'CS 101', room: 'Lab 1', timeStr: '8:00 AM', timeRemainingStr: 'In 10m', isOngoing: false },
        { courseName: 'MATH 201', room: 'R2', timeStr: '10:00 AM', timeRemainingStr: 'In 2h', isOngoing: false },
        { courseName: 'PHYS 301', room: 'R3', timeStr: '1:00 PM', timeRemainingStr: 'In 5h', isOngoing: false },
        { courseName: 'ENG 401', room: 'R4', timeStr: '3:00 PM', timeRemainingStr: 'In 7h', isOngoing: false },
      ];

      const widget = FinScholarWidget({ classes });
      const [topSection, waveSection, bottomSection] = getChildren(widget);

      // Verify top section vertical budget
      const topPadding = (topSection.props.style.paddingTop || 0) + (topSection.props.style.paddingBottom || 0);
      assert(topPadding <= 14, `Top padding total ${topPadding} should be <= 14`);

      // Verify wave section vertical budget
      assert(waveSection.props.style.height <= 16, `Wave height ${waveSection.props.style.height} should be <= 16`);

      // Verify bottom section vertical budget
      const bottomPadding = (bottomSection.props.style.paddingTop || 0) + (bottomSection.props.style.paddingBottom || 0);
      assert(bottomPadding <= 12, `Bottom padding total ${bottomPadding} should be <= 12`);

      const list = getChildren(bottomSection)[0];
      const items = getChildren(list);
      assert.strictEqual(items.length, 3);
      items.forEach((item, idx) => {
        assert(item.props.style.padding <= 6, `Item ${idx} padding should be <= 6`);
        assert(item.props.style.marginBottom <= 5, `Item ${idx} marginBottom should be <= 5`);
      });
    });

    test('7.4 Unicode, emojis, and multi-dash course title formatting', () => {
      const complexClasses = [
        {
          courseName: '🚀 ADV-CS 499 - Senior Capstone - Section B',
          room: '🏢 Hall 101',
          timeStr: '4:00 PM',
          timeRemainingStr: 'In 3h',
          isOngoing: false,
        },
        {
          courseName: '🎨 ART 105 – Drawing & Painting',
          room: 'Studio A',
          timeStr: '6:00 PM',
          timeRemainingStr: 'In 5h',
          isOngoing: false,
        },
        {
          courseName: '💻 CS 200 — Data Structures',
          room: 'Lab 4',
          timeStr: '7:00 PM',
          timeRemainingStr: 'In 6h',
          isOngoing: false,
        },
      ];

      const widget = FinScholarWidget({ classes: complexClasses });
      const topSection = getChildren(widget)[0];
      const nextPanel = getChildren(topSection)[1];
      const activeTitle = getChildren(nextPanel)[1];
      // Should split on first ' - '
      assert.strictEqual(activeTitle.props.text, '🚀 ADV-CS 499');

      const bottomSection = getChildren(widget)[2];
      const cards = getChildren(getChildren(bottomSection)[0]);
      
      // Card 1: en-dash
      const card1 = cards[0];
      const avatarCircle1 = getChildren(card1)[0];
      const avatarText1 = getChildren(avatarCircle1)[0];
      assert.strictEqual(avatarText1.props.text, '🎨');
      const middleContent1 = getChildren(card1)[1];
      const title1 = getChildren(middleContent1)[0];
      assert.strictEqual(title1.props.text, '🎨 ART 105');

      // Card 2: em-dash
      const card2 = cards[1];
      const avatarCircle2 = getChildren(card2)[0];
      const avatarText2 = getChildren(avatarCircle2)[0];
      assert.strictEqual(avatarText2.props.text, '💻');
      const middleContent2 = getChildren(card2)[1];
      const title2 = getChildren(middleContent2)[0];
      assert.strictEqual(title2.props.text, '💻 CS 200');
    });

    test('7.5 Complex grapheme clusters and composite emojis (flags, ZWJ sequences, skin tones)', () => {
      assert.strictEqual(getFirstGrapheme('CS 101'), 'C');
      assert.strictEqual(getFirstGrapheme('math 201'), 'M');
      assert.strictEqual(getFirstGrapheme(''), 'C');
      assert.strictEqual(getFirstGrapheme('   '), 'C');
      assert.strictEqual(getFirstGrapheme(null), 'C');
      assert.strictEqual(getFirstGrapheme(undefined), 'C');
      assert.strictEqual(getFirstGrapheme('🎨 ART'), '🎨');
      assert.strictEqual(getFirstGrapheme('🇵🇭 HIST 101'), '🇵🇭');
      assert.strictEqual(getFirstGrapheme('👨‍🎓 GRAD 400'), '👨‍🎓');
      assert.strictEqual(getFirstGrapheme('👍🏽 PE 101'), '👍🏽');

      const emojiClasses = [
        { courseName: 'CS 100', room: 'R0', timeStr: '8:00 AM', isOngoing: false },
        { courseName: '🇵🇭 HIST 101 - Philippine History', room: 'R1', timeStr: '9:00 AM', isOngoing: false },
        { courseName: '👨‍🎓 GRAD 400 - Seminar', room: 'R2', timeStr: '10:00 AM', isOngoing: false },
      ];

      const widget = FinScholarWidget({ classes: emojiClasses });
      const bottom = getChildren(widget)[2];
      const cards = getChildren(getChildren(bottom)[0]);

      const flagCard = cards[0];
      const flagInitial = getChildren(getChildren(flagCard)[0])[0];
      assert.strictEqual(flagInitial.props.text, '🇵🇭');

      const gradCard = cards[1];
      const gradInitial = getChildren(getChildren(gradCard)[0])[0];
      assert.strictEqual(gradInitial.props.text, '👨‍🎓');
    });
  });

  describe('Widget 3x4 Math & Automatic Inset Verification Suite 8', () => {
    test('8.1 Mathematical precision for 3x4 grid formula: (cells * 70) - 30', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const appJsonPath = path.resolve('app.json');
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      const widgetPlugin = appJson.expo.plugins.find(
        p => Array.isArray(p) && p[0] === 'react-native-android-widget'
      );
      const widgetConfig = widgetPlugin[1].widgets[0];

      const minWidthDp = parseInt(widgetConfig.minWidth, 10);
      const minHeightDp = parseInt(widgetConfig.minHeight, 10);

      // Formula: (n * 70) - 30 -> n = (dp + 30) / 70
      const calculatedCols = (minWidthDp + 30) / 70;
      const calculatedRows = (minHeightDp + 30) / 70;

      assert.strictEqual(calculatedCols, 3, `minWidth ${minWidthDp}dp must correspond to exactly 3 columns`);
      assert.strictEqual(calculatedRows, 4, `minHeight ${minHeightDp}dp must correspond to exactly 4 rows`);
      assert.strictEqual(widgetConfig.minWidth, '180dp');
      assert.strictEqual(widgetConfig.minHeight, '250dp');
      assert.strictEqual(widgetConfig.targetCellWidth, 3);
      assert.strictEqual(widgetConfig.targetCellHeight, 4);

      const xmlPath = path.resolve('android/app/src/main/res/xml/widgetprovider_finscholarwidget.xml');
      const xmlContent = fs.readFileSync(xmlPath, 'utf8');
      assert(xmlContent.includes('android:minWidth="180dp"'));
      assert(xmlContent.includes('android:minHeight="250dp"'));
      assert(xmlContent.includes('android:targetCellWidth="3"'));
      assert(xmlContent.includes('android:targetCellHeight="4"'));
    });

    test('8.2 Automatic native padding & comfortable insetting out of the box', () => {
      // Empty state padding check
      const emptyWidget = FinScholarWidget({ classes: [] });
      assert(emptyWidget.props.style.padding >= 10, 'Empty state root must have automatic padding >= 10');
      assert(emptyWidget.props.style.borderRadius >= 28, 'Empty state root must have rounded corners >= 28');

      // Populated state padding check
      const sampleClass = [{
        courseName: 'CS 101',
        room: 'Room 101',
        timeStr: '10:00 AM',
        timeRemainingStr: 'In 30m',
        isOngoing: false,
      }];
      const widget = FinScholarWidget({ classes: sampleClass });
      assert(widget.props.style.borderRadius >= 28, 'Active root must have rounded corners >= 28');

      const [topSection, waveSection, bottomSection] = getChildren(widget);
      assert(topSection.props.style.paddingHorizontal >= 10, 'Top section must have comfortable horizontal padding >= 10');
      assert(topSection.props.style.paddingTop >= 8, 'Top section must have comfortable top padding >= 8');

      const nextPanel = getChildren(topSection)[1];
      assert(nextPanel.props.style.paddingHorizontal >= 10, 'Next class panel must have horizontal padding >= 10');
      assert(nextPanel.props.style.paddingVertical >= 6, 'Next class panel must have vertical padding >= 6');

      assert(bottomSection.props.style.paddingHorizontal >= 8, 'Bottom section must have horizontal padding >= 8');
      assert(bottomSection.props.style.paddingBottom >= 6, 'Bottom section must have bottom padding >= 6');
    });

    test('8.3 AndroidManifest Synchronization: Receiver and label match app.json', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const appJsonPath = path.resolve('app.json');
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      const widgetPlugin = appJson.expo.plugins.find(
        p => Array.isArray(p) && p[0] === 'react-native-android-widget'
      );
      const widgetLabel = widgetPlugin[1].widgets[0].label;

      const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
      const manifestContent = fs.readFileSync(manifestPath, 'utf8');

      assert(
        manifestContent.includes(`android:label="${widgetLabel}"`),
        `AndroidManifest.xml must include receiver with android:label="${widgetLabel}"`
      );
      assert(
        manifestContent.includes('android:name=".widget.FinScholarWidget"'),
        'AndroidManifest.xml must declare .widget.FinScholarWidget receiver'
      );
      assert(
        manifestContent.includes('android:resource="@xml/widgetprovider_finscholarwidget"'),
        'AndroidManifest.xml must point to @xml/widgetprovider_finscholarwidget'
      );
    });

    test('8.4 Typography safety: maxLines set on all text elements preventing overflow under font zoom', () => {
      const sampleClasses = [
        {
          courseName: 'CS 999 - Advanced Artificial Intelligence & High Performance Machine Learning Systems',
          room: 'Engineering Building Complex - North Wing Room 405-A',
          timeStr: '10:00 AM - 12:00 PM',
          timeRemainingStr: 'In 30m',
          isOngoing: false,
        },
        {
          courseName: 'MATH 888 - Non-Euclidean Geometry & Topology Applications',
          room: 'Science Complex Hall 202',
          timeStr: '1:00 PM - 3:00 PM',
          timeRemainingStr: 'In 3h',
          isOngoing: false,
        },
      ];

      const widget = FinScholarWidget({ classes: sampleClasses });
      const [topSection, waveSection, bottomSection] = getChildren(widget);

      const nextPanel = getChildren(topSection)[1];
      const panelChildren = getChildren(nextPanel);
      const title = panelChildren[1];
      const subtitle = panelChildren[2];

      assert.strictEqual(title.props.maxLines, 1, 'Active title must have maxLines=1');
      assert.strictEqual(subtitle.props.maxLines, 1, 'Active subtitle must have maxLines=1');

      const listContainer = getChildren(bottomSection)[0];
      const upcomingItem = getChildren(listContainer)[0];
      const middleContent = getChildren(upcomingItem)[1];
      const itemTitle = getChildren(middleContent)[0];
      const itemSubtitle = getChildren(middleContent)[1];

      assert.strictEqual(itemTitle.props.maxLines, 1, 'Upcoming item title must have maxLines=1');
      assert.strictEqual(itemSubtitle.props.maxLines, 1, 'Upcoming item subtitle must have maxLines=1');
    });
  });

  describe('Widget Adaptive Dark/Light Mode Theming Suite 9', () => {
    const sampleClasses = [
      { courseName: 'CS 101', room: 'Lab 1', timeStr: '9:00 AM', timeRemainingStr: 'In 30m', isOngoing: false },
      { courseName: 'MATH 201', room: 'Room 202', timeStr: '11:00 AM', timeRemainingStr: 'In 2h', isOngoing: false },
    ];

    test('9.1 Dark mode applies slate-900 / slate-800 color tokens across all widget sections', () => {
      const darkWidget = FinScholarWidget({ classes: sampleClasses, isDark: true });
      assert.strictEqual(darkWidget.props.style.backgroundColor, '#0f172a');
      assert.strictEqual(darkWidget.props.style.backgroundGradient.from, '#0f172a');
      assert.strictEqual(darkWidget.props.style.backgroundGradient.to, '#1e293b');

      const [topSection, waveSection, bottomSection] = getChildren(darkWidget);

      // Top section title in dark mode
      const nextPanel = getChildren(topSection)[1];
      const panelChildren = getChildren(nextPanel);
      const title = panelChildren[1];
      assert.strictEqual(title.props.style.color, '#f8fafc');

      // Wave SVG fill in dark mode matches bottom container
      const waveSvg = getChildren(waveSection).find(c => c.type === SvgWidget || c.type?.name === 'SvgWidget');
      assert(waveSvg.props.svg.includes('fill="#0f172a"'), `Wave SVG should have dark fill #0f172a, got ${waveSvg.props.svg}`);

      // Bottom section in dark mode
      assert.strictEqual(bottomSection.props.style.backgroundColor, '#0f172a');

      // Upcoming card in dark mode
      const listContainer = getChildren(bottomSection)[0];
      const card = getChildren(listContainer)[0];
      assert.strictEqual(card.props.style.backgroundColor, '#1e293b');

      const cardChildren = getChildren(card);
      const avatarCircle = cardChildren[0];
      const avatarText = getChildren(avatarCircle)[0];
      assert.strictEqual(avatarCircle.props.style.backgroundColor, '#334155');
      assert.strictEqual(avatarText.props.style.color, '#f8fafc');

      const middleContent = cardChildren[1];
      const cardTitle = getChildren(middleContent)[0];
      const cardSubtitle = getChildren(middleContent)[1];
      assert.strictEqual(cardTitle.props.style.color, '#f8fafc');
      assert.strictEqual(cardSubtitle.props.style.color, '#94a3b8');

      const badgeCircle = cardChildren[2];
      const badgeText = getChildren(badgeCircle)[0];
      assert.strictEqual(badgeCircle.props.style.backgroundColor, '#334155');
      assert.strictEqual(badgeText.props.style.color, '#f8fafc');
    });

    test('9.2 Light mode applies indigo / white color tokens across all widget sections', () => {
      const lightWidget = FinScholarWidget({ classes: sampleClasses, isDark: false });
      assert.strictEqual(lightWidget.props.style.backgroundColor, '#6366f1');
      assert.strictEqual(lightWidget.props.style.backgroundGradient.from, '#6366f1');
      assert.strictEqual(lightWidget.props.style.backgroundGradient.to, '#4338ca');

      const [topSection, waveSection, bottomSection] = getChildren(lightWidget);

      // Top section title in light mode
      const nextPanel = getChildren(topSection)[1];
      const panelChildren = getChildren(nextPanel);
      const title = panelChildren[1];
      assert.strictEqual(title.props.style.color, '#ffffff');

      // Wave SVG fill in light mode
      const waveSvg = getChildren(waveSection).find(c => c.type === SvgWidget || c.type?.name === 'SvgWidget');
      assert(waveSvg.props.svg.includes('fill="#ffffff"'), `Wave SVG should have light fill #ffffff, got ${waveSvg.props.svg}`);

      // Bottom section in light mode
      assert.strictEqual(bottomSection.props.style.backgroundColor, '#ffffff');

      // Upcoming card in light mode
      const listContainer = getChildren(bottomSection)[0];
      const card = getChildren(listContainer)[0];
      assert.strictEqual(card.props.style.backgroundColor, '#f1f5f9');

      const cardChildren = getChildren(card);
      const avatarCircle = cardChildren[0];
      const avatarText = getChildren(avatarCircle)[0];
      assert.strictEqual(avatarCircle.props.style.backgroundColor, '#e0e7ff');
      assert.strictEqual(avatarText.props.style.color, '#4f46e5');

      const middleContent = cardChildren[1];
      const cardTitle = getChildren(middleContent)[0];
      const cardSubtitle = getChildren(middleContent)[1];
      assert.strictEqual(cardTitle.props.style.color, '#1e293b');
      assert.strictEqual(cardSubtitle.props.style.color, '#64748b');

      const badgeCircle = cardChildren[2];
      const badgeText = getChildren(badgeCircle)[0];
      assert.strictEqual(badgeCircle.props.style.backgroundColor, '#e0e7ff');
      assert.strictEqual(badgeText.props.style.color, '#4f46e5');
    });

    test('9.3 Empty state adapts background gradient and typography to dark mode', () => {
      const darkEmpty = FinScholarWidget({ classes: [], isDark: true });
      assert.strictEqual(darkEmpty.props.style.backgroundColor, '#0f172a');
      assert.strictEqual(darkEmpty.props.style.backgroundGradient.from, '#0f172a');
      assert.strictEqual(darkEmpty.props.style.backgroundGradient.to, '#1e293b');

      const emptyChildren = getChildren(darkEmpty);
      const title = emptyChildren[1];
      const subtitle = emptyChildren[2];
      assert.strictEqual(title.props.style.color, '#f8fafc');
      assert.strictEqual(subtitle.props.style.color, '#94a3b8');

      const lightEmpty = FinScholarWidget({ classes: [], isDark: false });
      assert.strictEqual(lightEmpty.props.style.backgroundColor, '#6366f1');
      assert.strictEqual(lightEmpty.props.style.backgroundGradient.from, '#6366f1');
      assert.strictEqual(lightEmpty.props.style.backgroundGradient.to, '#4338ca');
    });
  });
}

