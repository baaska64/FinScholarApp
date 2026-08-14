import assert from 'node:assert';
import {
  formatTimeStr,
  formatCountdown,
  isValidClass,
  widgetTaskHandler,
} from '../widget/WidgetTaskHandler.tsx';
import { lastWidgetUpdateConfig } from '../scripts/mocks/react-native-android-widget.js';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function runWidgetTaskHandlerTests(describe, test) {
  describe('WidgetTaskHandler Suite 1: Time & Countdown Formatters', () => {
    test('1.1 formatTimeStr 12-hour formatting (AM/PM)', () => {
      assert.strictEqual(formatTimeStr(8), '8:00 AM');
      assert.strictEqual(formatTimeStr(9.5), '9:30 AM');
      assert.strictEqual(formatTimeStr(12), '12:00 PM');
      assert.strictEqual(formatTimeStr(13.5), '1:30 PM');
      assert.strictEqual(formatTimeStr(0), '12:00 AM');
      assert.strictEqual(formatTimeStr(0.25), '12:15 AM');
      assert.strictEqual(formatTimeStr(23.75), '11:45 PM');
      assert.strictEqual(formatTimeStr(8.999), '9:00 AM');
      assert.strictEqual(formatTimeStr(11.999), '12:00 PM');
      assert.strictEqual(formatTimeStr(23.999), '12:00 AM');
      assert.strictEqual(formatTimeStr(NaN), '12:00 AM');
      assert.strictEqual(formatTimeStr(Infinity), '12:00 AM');
      assert.strictEqual(formatTimeStr(null), '12:00 AM');
      assert.strictEqual(formatTimeStr(undefined), '12:00 AM');
    });

    test('1.2 formatCountdown returns expected status & countdown strings', () => {
      assert.strictEqual(formatCountdown(0, true), 'In progress');
      assert.strictEqual(formatCountdown(-0.5, false), 'In progress');
      assert.strictEqual(formatCountdown(0, false), 'In 0m');
      assert.strictEqual(formatCountdown(0.5, false), 'In 30m');
      assert.strictEqual(formatCountdown(0.25, false), 'In 15m');
      assert.strictEqual(formatCountdown(0.999, false), 'In 1h');
      assert.strictEqual(formatCountdown(1.5, false), 'In 1h 30m');
      assert.strictEqual(formatCountdown(2, false), 'In 2h');
      assert.strictEqual(formatCountdown(23.999, false), 'In 1 day');
      assert.strictEqual(formatCountdown(24, false), 'In 1 day');
      assert.strictEqual(formatCountdown(48, false), 'In 2 days');
      assert.strictEqual(formatCountdown(NaN, false), 'In progress');
      assert.strictEqual(formatCountdown(Infinity, false), 'In progress');
      assert.strictEqual(formatCountdown(null, false), 'In progress');
    });

    test('1.3 isValidClass validates class structure', () => {
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: 8, day: 0 }), true);
      assert.strictEqual(isValidClass({ name: '', startHour: 8, day: 0 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: '8', day: 0 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: NaN, day: 0 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: Infinity, day: 0 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: -1, day: 0 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: 24, day: 0 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: 8, day: NaN }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: 8, day: -1 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: 8, day: 7 }), false);
      assert.strictEqual(isValidClass({ name: 'CS 101', startHour: 8, day: 1.5 }), false);
      assert.strictEqual(isValidClass(null), false);
      assert.strictEqual(isValidClass(undefined), false);
    });
  });

  describe('WidgetTaskHandler Suite 2: Data Integration, Selection & Up to 4 Classes Limit', () => {
    test('2.1 Schedule lookup with 1 ongoing class + 4 upcoming classes passes up to 4 classes', async () => {
      const now = new Date();
      const currentDayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const currentHour = now.getHours() + (now.getMinutes() / 60);

      // Create an ongoing class today
      const ongoingClass = {
        id: 'cls-1',
        name: 'Ongoing CS 101',
        room: 'Lab 1',
        day: currentDayIdx,
        startHour: Math.max(0, currentHour - 0.2),
        duration: 2,
      };

      // Create 4 upcoming classes today/later
      const upcoming1 = {
        id: 'cls-2',
        name: 'Upcoming MATH 101',
        room: 'Room 2',
        day: currentDayIdx,
        startHour: currentHour + 3,
        duration: 1,
      };
      const upcoming2 = {
        id: 'cls-3',
        name: 'Upcoming PHYS 101',
        room: 'Room 3',
        day: currentDayIdx,
        startHour: currentHour + 5,
        duration: 1,
      };
      const upcoming3 = {
        id: 'cls-4',
        name: 'Upcoming CHEM 101',
        room: 'Room 4',
        day: (currentDayIdx + 1) % 7,
        startHour: 9,
        duration: 1,
      };
      const upcoming4 = {
        id: 'cls-5',
        name: 'Upcoming ENG 101',
        room: 'Room 5',
        day: (currentDayIdx + 1) % 7,
        startHour: 11,
        duration: 1,
      };

      const ledgerData = {
        years: [
          {
            id: 'year-1',
            semesters: [
              {
                id: 'sem-1',
                classes: [ongoingClass, upcoming1, upcoming2, upcoming3, upcoming4],
              },
            ],
          },
        ],
      };

      await AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(ledgerData));
      await AsyncStorage.setItem('@selectedYear', 'year-1');
      await AsyncStorage.setItem('@selectedSemester', 'sem-1');

      await widgetTaskHandler();

      assert(lastWidgetUpdateConfig, 'requestWidgetUpdate should have been called');
      assert.strictEqual(lastWidgetUpdateConfig.widgetName, 'FinScholarWidget');

      const renderedWidget = lastWidgetUpdateConfig.renderWidget();
      const classesPassed = renderedWidget.props.classes;

      assert.strictEqual(classesPassed.length, 4, 'Should limit total passed classes to at most 4');
      assert.strictEqual(classesPassed[0].courseName, 'Ongoing CS 101');
      assert.strictEqual(classesPassed[0].isOngoing, true);
      assert.strictEqual(classesPassed[1].courseName, 'Upcoming MATH 101');
      assert.strictEqual(classesPassed[1].isOngoing, false);
      assert.strictEqual(classesPassed[2].courseName, 'Upcoming PHYS 101');
      assert.strictEqual(classesPassed[3].courseName, 'Upcoming CHEM 101');
    });

    test('2.2 Schedule lookup with no ongoing class passes top 4 upcoming classes', async () => {
      const now = new Date();
      const currentDayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;

      // Create 5 upcoming classes for tomorrow
      const upcoming1 = { id: 'u1', name: 'Class 1', day: (currentDayIdx + 1) % 7, startHour: 8, duration: 1 };
      const upcoming2 = { id: 'u2', name: 'Class 2', day: (currentDayIdx + 1) % 7, startHour: 10, duration: 1 };
      const upcoming3 = { id: 'u3', name: 'Class 3', day: (currentDayIdx + 1) % 7, startHour: 13, duration: 1 };
      const upcoming4 = { id: 'u4', name: 'Class 4', day: (currentDayIdx + 1) % 7, startHour: 15, duration: 1 };
      const upcoming5 = { id: 'u5', name: 'Class 5', day: (currentDayIdx + 1) % 7, startHour: 17, duration: 1 };

      const ledgerData = {
        years: [
          {
            id: 'year-1',
            semesters: [
              {
                id: 'sem-1',
                classes: [upcoming5, upcoming3, upcoming1, upcoming4, upcoming2],
              },
            ],
          },
        ],
      };

      await AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(ledgerData));
      await widgetTaskHandler();

      const renderedWidget = lastWidgetUpdateConfig.renderWidget();
      const classesPassed = renderedWidget.props.classes;

      assert.strictEqual(classesPassed.length, 4, 'Should pass exactly 4 upcoming classes when no ongoing class');
      assert.strictEqual(classesPassed[0].courseName, 'Class 1');
      assert.strictEqual(classesPassed[0].isOngoing, false);
      assert.strictEqual(classesPassed[1].courseName, 'Class 2');
      assert.strictEqual(classesPassed[2].courseName, 'Class 3');
      assert.strictEqual(classesPassed[3].courseName, 'Class 4');
    });
  });

  describe('WidgetTaskHandler Suite 3: Dark Mode Prop Passing & Fallback Edge Cases', () => {
    test('3.1 Passes isDark=true when Appearance.getColorScheme() returns dark', async () => {
      Appearance.getColorScheme = () => 'dark';

      const ledgerData = { years: [] };
      await AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(ledgerData));

      await widgetTaskHandler();

      const renderedWidget = lastWidgetUpdateConfig.renderWidget();
      assert.strictEqual(renderedWidget.props.isDark, true);
    });

    test('3.2 Passes isDark=false when Appearance.getColorScheme() returns light', async () => {
      Appearance.getColorScheme = () => 'light';

      const ledgerData = { years: [] };
      await AsyncStorage.setItem('grade_ledger_v2_data', JSON.stringify(ledgerData));

      await widgetTaskHandler();

      const renderedWidget = lastWidgetUpdateConfig.renderWidget();
      assert.strictEqual(renderedWidget.props.isDark, false);
    });

    test('3.3 Error boundary fallback returns empty classes array on corrupted JSON or storage error', async () => {
      Appearance.getColorScheme = () => 'dark';
      await AsyncStorage.setItem('grade_ledger_v2_data', 'INVALID_JSON{{{');

      await widgetTaskHandler();

      assert(lastWidgetUpdateConfig, 'requestWidgetUpdate should be called in catch block');
      const renderedWidget = lastWidgetUpdateConfig.renderWidget();

      assert.deepStrictEqual(renderedWidget.props.classes, [], 'Fallback should pass empty classes array');
      assert.strictEqual(renderedWidget.props.isDark, true, 'Fallback should preserve isDark prop');
    });
  });
}
