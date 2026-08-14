import assert from 'node:assert';
import { Calculator } from '../utils/calculator.js';
import { Colors, getTheme, Spacing, Radius, Typography } from '../constants/Theme.ts';
import { calculateDashboardHeroStats } from './helpers/dashboardCalculations.js';

export function runTier4Tests(describe, test) {
  describe('Tier 4: Real-World Scenarios & Theme Compliance', () => {

    test('4.1 Theme Token Properties (Light Mode vs Dark Mode)', () => {
      const requiredTokens = [
        'primary', 'primaryLight', 'primaryDark',
        'secondary', 'secondaryLight',
        'accent', 'accentLight',
        'success', 'successLight',
        'warning', 'warningLight',
        'error', 'errorLight',
        'background', 'surface', 'surfaceSecondary',
        'card', 'cardBorder',
        'text', 'textSecondary', 'textTertiary', 'textInverse',
        'tabBg', 'tabBorder', 'tabActive', 'tabInactive',
        'overlay', 'skeleton', 'skeletonHighlight',
        'inputBg', 'inputBorder', 'inputFocus'
      ];

      // 1. Verify Light Mode tokens
      const lightTheme = getTheme(false);
      assert.strictEqual(lightTheme, Colors.light, 'getTheme(false) should return Colors.light');
      requiredTokens.forEach(token => {
        assert(token in lightTheme, `Light mode is missing required token: ${token}`);
        assert(typeof lightTheme[token] === 'string' && lightTheme[token].length > 0, `Token ${token} should be a non-empty string`);
      });

      // 2. Verify Dark Mode tokens
      const darkTheme = getTheme(true);
      assert.strictEqual(darkTheme, Colors.dark, 'getTheme(true) should return Colors.dark');
      requiredTokens.forEach(token => {
        assert(token in darkTheme, `Dark mode is missing required token: ${token}`);
        assert(typeof darkTheme[token] === 'string' && darkTheme[token].length > 0, `Token ${token} should be a non-empty string`);
      });

      // 3. Verify specific contrast differences
      assert.notStrictEqual(lightTheme.background, darkTheme.background, 'Light and Dark mode background colors must be different');
      assert.notStrictEqual(lightTheme.text, darkTheme.text, 'Light and Dark mode text colors must be different');
    });

    test('4.2 Design System Constants (Spacing, Radius, Typography)', () => {
      assert(Spacing.sm > 0 && Spacing.md > Spacing.sm && Spacing.lg > Spacing.md);
      assert(Radius.sm > 0 && Radius.full === 9999);
      assert(Typography.heading.fontSize > Typography.title.fontSize);
      assert(Typography.title.fontSize > Typography.body.fontSize);
    });

    test('4.3 Full Real-World Dashboard State Calculations (5 Hero Metrics)', () => {
      const fullLedgerState = {
        settings: {
          gradingSystem: '1_IS_BEST'
        },
        years: [
          {
            id: 'year_2026',
            name: 'Senior Year',
            semesters: [
              {
                id: 'sem_fall_2026',
                name: 'Fall Semester 2026',
                startDate: '2026-08-01',
                endDate: '2026-12-15',
                subjects: [
                  {
                    id: 'sub_cs401',
                    name: 'Software Engineering II',
                    units: 4,
                    passingPercent: 60,
                    periods: [
                      {
                        id: 'p1',
                        weight: 100,
                        components: [
                          { id: 'c1', weight: 40, items: [{ score: 90, max: 100 }] },
                          { id: 'c2', weight: 60, items: [{ score: 95, max: 100 }] }
                        ]
                      }
                    ],
                    requirements: [
                      { id: 'req_1', title: 'Architecture Proposal', status: 'graded', priority: 'high' },
                      { id: 'req_2', title: 'Sprint 1 Code', status: 'submitted', priority: 'medium' },
                      { id: 'req_3', title: 'Sprint 2 Demo', status: 'pending', priority: 'high', dueDate: '2026-09-01' }
                    ]
                  },
                  {
                    id: 'sub_cs402',
                    name: 'Machine Learning',
                    units: 3,
                    passingPercent: 60,
                    periods: [
                      {
                        id: 'p1',
                        weight: 100,
                        components: [
                          { id: 'c1', weight: 100, items: [{ score: 85, max: 100 }] }
                        ]
                      }
                    ],
                    requirements: [
                      { id: 'req_4', title: 'Linear Regression Lab', status: 'graded', priority: 'medium' },
                      { id: 'req_5', title: 'Neural Net Project', status: 'pending', priority: 'high', dueDate: '2026-09-15' }
                    ]
                  }
                ],
                classes: [
                  { id: 'cls_se', name: 'Software Eng', day: 0 }, // Mon
                  { id: 'cls_ml', name: 'Machine Learning', day: 1 }, // Tue
                  { id: 'cls_se_lab', name: 'SE Lab', day: 2 } // Wed
                ],
                attendanceLog: {
                  '2026-08-03_cls_se': { status: 'present' },
                  '2026-08-04_cls_ml': { status: 'present' },
                  '2026-08-05_cls_se_lab': { status: 'present' },
                  '2026-08-10_cls_se': { status: 'present' },
                  '2026-08-11_cls_ml': { status: 'absent' },
                  '2026-08-12_cls_se_lab': { status: 'present' }
                }
              }
            ]
          }
        ]
      };

      const currentDate = new Date('2026-08-15T12:00:00'); // Mid-August 2026

      const heroStats = calculateDashboardHeroStats(fullLedgerState, 'year_2026', 'sem_fall_2026', currentDate);

      // 1. Semester Progress Bar (Aug 1 to Dec 15 is 136 days. Aug 15 is day 14 => ~10.6%)
      assert(heroStats.semProgress.percent > 9 && heroStats.semProgress.percent < 13, `Semester progress should be ~10-11%, got ${heroStats.semProgress.percent}%`);

      // 2. Sem GWA Calculation
      // Sub 1 (CS 401, 4 units): (90*0.4 + 95*0.6) = 36 + 57 = 93% => ~1.25 eq
      // Sub 2 (CS 402, 3 units): 85% => ~2.25 eq
      // Weighted Sem Percent: (93*4 + 85*3) / 7 = (372 + 255) / 7 = 627 / 7 = 89.57%
      assert(Math.abs(heroStats.semGWA.percent - 89.57) < 0.1, `Expected ~89.57% sem GWA, got ${heroStats.semGWA.percent}%`);

      // 3. Year GWA Calculation (Same since only 1 semester in year)
      assert(Math.abs(heroStats.yearGWA.percent - 89.57) < 0.1, `Expected ~89.57% year GWA, got ${heroStats.yearGWA.percent}%`);

      // 4. Overall Attendance % (6 sessions total: 5 present, 1 absent => 5/6 = 83.33%)
      assert.strictEqual(heroStats.attendance.totalLogged, 6);
      assert.strictEqual(heroStats.attendance.presentCount, 5);
      assert.strictEqual(heroStats.attendance.absentCount, 1);
      assert(Math.abs(heroStats.attendance.percentage - 83.333) < 0.1, `Expected ~83.33% attendance, got ${heroStats.attendance.percentage}%`);

      // 5. Pending Tasks Count (req_3 and req_5 are pending => 2 tasks)
      assert.strictEqual(heroStats.pendingTasks.pendingCount, 2);
    });

    test('4.4 System Grading Mode Flexibility (1_IS_BEST vs 4_IS_BEST vs PERCENT)', () => {
      const semData = {
        id: 'sem_1',
        subjects: [
          {
            id: 'sub_1',
            units: 3,
            passingPercent: 60,
            periods: [{ weight: 100, components: [{ weight: 100, items: [{ score: 100, max: 100 }] }] }]
          }
        ]
      };

      const res1 = Calculator.calculateSemester(semData, '1_IS_BEST');
      assert.strictEqual(res1.equivalent, 1.0, 'In 1_IS_BEST, 100% score should yield 1.0 equivalent grade');

      const res4 = Calculator.calculateSemester(semData, '4_IS_BEST');
      assert.strictEqual(res4.equivalent, 4.0, 'In 4_IS_BEST, 100% score should yield 4.0 equivalent grade');

      const resPct = Calculator.calculateSemester(semData, 'PERCENT');
      assert.strictEqual(resPct.equivalent, 100, 'In PERCENT mode, 100% score should yield 100 equivalent grade');
    });

  });
}
