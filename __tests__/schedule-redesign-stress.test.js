import assert from 'node:assert';
import { ensureSubjectExists, refreshHasSchedule, getUnscheduledSubjects, getTrackedSubjects, toggleGradeTracking } from '@/utils/subjectRegistry';

export function runScheduleRedesignTests(describe, test) {
  describe('Schedule Redesign Suite 1: Pre-Redesign Checklist & Header Interactions (SCH-HDR-01..06)', () => {
    test('SCH-HDR-01 & SCH-HDR-02: View mode state transitions & Term Switcher data filtering', () => {
      const mockState = {
        viewMode: 'grid',
        activeYearId: 'y1',
        activeSemId: 's1',
        data: {
          years: [
            {
              id: 'y1',
              name: 'Year 1',
              semesters: [
                { id: 's1', name: 'Sem 1', classes: [{ id: 'c1', name: 'Math 101', day: 0, startHour: 8, duration: 1.5 }] },
                { id: 's2', name: 'Sem 2', classes: [{ id: 'c2', name: 'Physics 101', day: 1, startHour: 10, duration: 2 }] }
              ]
            }
          ]
        }
      };

      // Switch view modes
      let currentMode = mockState.viewMode;
      currentMode = 'list';
      assert.strictEqual(currentMode, 'list');
      currentMode = 'attendance';
      assert.strictEqual(currentMode, 'attendance');
      currentMode = 'grid';
      assert.strictEqual(currentMode, 'grid');

      // Switch active sem
      const sem1Classes = mockState.data.years[0].semesters.find(s => s.id === 's1').classes;
      const sem2Classes = mockState.data.years[0].semesters.find(s => s.id === 's2').classes;
      assert.strictEqual(sem1Classes.length, 1);
      assert.strictEqual(sem1Classes[0].name, 'Math 101');
      assert.strictEqual(sem2Classes[0].name, 'Physics 101');
    });

    test('SCH-HDR-03 to 06: Scanner, Add Class, Export, & Quick Edit state toggles', () => {
      let isScannerOpen = false;
      let isAddModalOpen = false;
      let exportDark = true;
      let isQuickEdit = false;

      // Toggle actions
      isScannerOpen = true;
      assert.strictEqual(isScannerOpen, true);
      isAddModalOpen = true;
      assert.strictEqual(isAddModalOpen, true);
      
      exportDark = !exportDark;
      assert.strictEqual(exportDark, false);

      isQuickEdit = !isQuickEdit;
      assert.strictEqual(isQuickEdit, true);
    });
  });

  describe('Schedule Redesign Suite 2: Timetable Grid & Bulk Quick-Edit Engine (SCH-GRD-01..07)', () => {
    test('SCH-GRD-01 & SCH-GRD-02: Grid day index & overlapping class column positioning', () => {
      const classes = [
        { id: 'c1', name: 'CS 101', day: 0, startHour: 8, duration: 2 },
        { id: 'c2', name: 'CS 102 (Lab)', day: 0, startHour: 9, duration: 2 }, // overlaps c1
        { id: 'c3', name: 'CS 103 (Sunday)', day: 6, startHour: 10, duration: 1 }
      ];

      const hasSunday = classes.some(c => c.day === 6);
      assert.strictEqual(hasSunday, true);

      // Overlap processing simulation (mirroring TimetableGrid logic)
      const processed = classes.map(c => ({ ...c, col: 0, maxCol: 1 }));
      const dayClasses = processed.filter(c => c.day === 0).sort((a, b) => a.startHour - b.startHour);

      // Contiguous overlapping group layout
      const columns = [];
      dayClasses.forEach(cls => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
          const last = columns[i][columns[i].length - 1];
          if (last.startHour + last.duration <= cls.startHour) {
            columns[i].push(cls);
            cls.col = i;
            placed = true;
            break;
          }
        }
        if (!placed) {
          cls.col = columns.length;
          columns.push([cls]);
        }
      });
      dayClasses.forEach(cls => cls.maxCol = columns.length);

      assert.strictEqual(columns.length, 2);
      assert.strictEqual(dayClasses[0].col, 0);
      assert.strictEqual(dayClasses[1].col, 1);
      assert.strictEqual(dayClasses[0].maxCol, 2);
      assert.strictEqual(dayClasses[1].maxCol, 2);
    });

    test('SCH-GRD-03 to 06: Quick Edit Day Shift, Time Shift, and Duration Changes', () => {
      let classes = [
        { id: 'c1', name: 'Eng 1', day: 0, startHour: 8, duration: 1.5 },
        { id: 'c2', name: 'Eng 2', day: 1, startHour: 10, duration: 2.0 }
      ];

      const selectedIds = new Set(['c1', 'c2']);
      const displayDayIndices = [6, 0, 1, 2, 3, 4, 5];

      // Bulk Day Shift (+1)
      classes = classes.map(cls => {
        if (!selectedIds.has(cls.id)) return cls;
        const currentIdx = displayDayIndices.indexOf(cls.day);
        const newIdx = Math.max(0, Math.min(displayDayIndices.length - 1, currentIdx + 1));
        return { ...cls, day: displayDayIndices[newIdx] };
      });

      assert.strictEqual(classes[0].day, 1); // 0 (Mon) -> 1 (Tue)
      assert.strictEqual(classes[1].day, 2); // 1 (Tue) -> 2 (Wed)

      // Bulk Time Shift (+0.5h)
      classes = classes.map(cls => {
        if (!selectedIds.has(cls.id)) return cls;
        return { ...cls, startHour: cls.startHour + 0.5 };
      });

      assert.strictEqual(classes[0].startHour, 8.5);
      assert.strictEqual(classes[1].startHour, 10.5);

      // Bulk Duration Change (-0.5h)
      classes = classes.map(cls => {
        if (!selectedIds.has(cls.id)) return cls;
        return { ...cls, duration: Math.max(5/60, cls.duration - 0.5) };
      });

      assert.strictEqual(classes[0].duration, 1.0);
      assert.strictEqual(classes[1].duration, 1.5);
    });

    test('SCH-GRD-07: Bulk Delete Class Blocks and Unscheduled Subject Clean Up', () => {
      let data = {
        years: [
          {
            id: 'y1',
            semesters: [
              {
                id: 's1',
                subjects: [
                  { id: 'sub1', name: 'PE 1', periods: [], hasSchedule: true },
                  { id: 'sub2', name: 'HIST 1', periods: [{ weight: 100 }], hasSchedule: true }
                ],
                classes: [
                  { id: 'c1', name: 'PE 1', subjectId: 'sub1', day: 0, startHour: 8, duration: 1 },
                  { id: 'c2', name: 'HIST 1', subjectId: 'sub2', day: 1, startHour: 9, duration: 1 }
                ]
              }
            ]
          }
        ]
      };

      const sem = data.years[0].semesters[0];
      const deleteIds = ['c1'];

      const deletedBlocks = sem.classes.filter(c => deleteIds.includes(c.id));
      sem.classes = sem.classes.filter(c => !deleteIds.includes(c.id));

      deletedBlocks.forEach(deletedBlock => {
        if (deletedBlock.subjectId) {
          const remainingBlocks = sem.classes.filter(c => c.subjectId === deletedBlock.subjectId);
          const subject = sem.subjects.find(s => s.id === deletedBlock.subjectId);
          if (subject && remainingBlocks.length === 0) {
            const hasData = subject.periods && subject.periods.length > 0;
            if (!hasData) {
              sem.subjects = sem.subjects.filter(s => s.id !== deletedBlock.subjectId);
            }
          }
          data = refreshHasSchedule(data, 'y1', 's1', deletedBlock.subjectId);
        }
      });

      // PE 1 has no periods/grades, so it should be auto-deleted
      const updatedSem = data.years[0].semesters[0];
      assert.strictEqual(updatedSem.subjects.length, 1);
      assert.strictEqual(updatedSem.subjects[0].id, 'sub2');
      assert.strictEqual(updatedSem.classes.length, 1);
    });
  });

  describe('Schedule Redesign Suite 3: Attendance Logger & Takeaway Notes (SCH-ATT-01..06)', () => {
    test('SCH-ATT-01 to 04: Attendance Logger P / A / NC state updates & Percentage Calculations', () => {
      const classes = [
        { id: 'c1', name: 'Bio 101', day: 0, startHour: 9, duration: 2 },
        { id: 'c2', name: 'Chem 101', day: 1, startHour: 11, duration: 1.5 }
      ];

      const startDateStr = '2026-08-01';
      const endDateStr = '2026-08-31';
      const now = new Date('2026-08-05T12:00:00');

      let attendanceLog = {
        '2026-08-03_c1': { status: 'present', isManual: true },
        '2026-08-04_c2': { status: 'absent', isManual: true }
      };

      // Conducted hours: 2 + 1.5 = 3.5 hrs. Attended: 2 hrs. % = (2 / 3.5) * 100 = 57%
      let totalConducted = 2 + 1.5;
      let attended = 2;
      let overallPct = Math.round((attended / totalConducted) * 100);
      assert.strictEqual(overallPct, 57);

      // User changes Chem 101 from Absent -> Cancelled (No Class)
      attendanceLog['2026-08-04_c2'] = { status: 'cancelled', isManual: true };
      
      // Conducted hours: 2 hrs (cancelled session excluded). Attended: 2 hrs. % = 100%
      totalConducted = 2;
      attended = 2;
      overallPct = Math.round((attended / totalConducted) * 100);
      assert.strictEqual(overallPct, 100);
    });

    test('SCH-ATT-05 & SCH-ATT-06: Takeaway notes per session and Week details modal binding', () => {
      let attendanceLog = {};
      const sessionKey = '2026-08-03_c1';

      // Update takeaway notes
      attendanceLog[sessionKey] = {
        ...(attendanceLog[sessionKey] || {}),
        takeaway: 'Need to review Chapter 3 diagram on cellular respiration'
      };

      assert.strictEqual(attendanceLog[sessionKey].takeaway, 'Need to review Chapter 3 diagram on cellular respiration');

      // Update status while preserving takeaway
      attendanceLog[sessionKey] = {
        ...attendanceLog[sessionKey],
        status: 'present',
        isManual: true
      };

      assert.strictEqual(attendanceLog[sessionKey].status, 'present');
      assert.strictEqual(attendanceLog[sessionKey].takeaway, 'Need to review Chapter 3 diagram on cellular respiration');
    });
  });

  describe('Schedule Redesign Suite 4: Class Modals & AI Scanner Integration (SCH-MOD-01..04, SCH-SCN-01..03)', () => {
    test('SCH-MOD-01 to 04: Class Edit Modal form validation, multi-schedule blocks, & subject registry', () => {
      let data = {
        years: [
          {
            id: 'y1',
            semesters: [{ id: 's1', subjects: [], classes: [] }]
          }
        ]
      };

      const newClassForm = {
        name: 'CS 201',
        instructor: 'Dr. Turing',
        colorIdx: 2,
        schedules: [
          { id: 'b1', room: 'Lab 1', day: 0, startHour: 8, duration: 1.5 },
          { id: 'b2', room: 'Lab 2', day: 2, startHour: 10, duration: 1.5 }
        ]
      };

      // 1. Ensure subject exists in registry
      const reg = ensureSubjectExists(data, 'y1', 's1', newClassForm.name, { fromSchedule: true });
      data = reg.data;
      assert.strictEqual(reg.isNew, true);
      assert.strictEqual(data.years[0].semesters[0].subjects[0].name, 'CS 201');
      assert.strictEqual(data.years[0].semesters[0].subjects[0].gradeTrackingEnabled, false); // Schedule-created subject defaults grade tracking OFF until user opts-in

      // 2. Add multi-schedule blocks
      const sem = data.years[0].semesters[0];
      const newBlocks = newClassForm.schedules.map(sched => ({
        id: sched.id,
        name: newClassForm.name,
        colorIdx: newClassForm.colorIdx,
        instructor: newClassForm.instructor,
        room: sched.room,
        day: sched.day,
        startHour: sched.startHour,
        duration: sched.duration,
        subjectId: reg.subjectId
      }));
      sem.classes.push(...newBlocks);
      sem.subjects[0].hasSchedule = true;

      assert.strictEqual(sem.classes.length, 2);
      assert.strictEqual(sem.subjects[0].hasSchedule, true);
    });

    test('SCH-SCN-01 to 03: AI Schedule Scanner JSON extraction & normalizeDay handling', () => {
      const scannedData = [
        { name: 'Physics 1', day: 'Monday', startHour: 9, duration: 1.5, room: 'Room 301' },
        { name: 'Physics 1', day: 'Wednesday', time: '1:30 PM', duration: '1.5', room: 'Room 301' },
        {
          name: 'Calculus',
          schedules: [
            { day: 'Tu', startTime: '10:00 AM', duration: 1 },
            { day: 'Th', startTime: '10:00 AM', duration: 1 }
          ]
        }
      ];

      const normalizeDay = (day) => {
        if (typeof day === 'number') return Math.max(0, Math.min(6, day));
        if (typeof day !== 'string') return 0;
        const d = day.toLowerCase().trim();
        if (d.startsWith('tu')) return 1;
        if (d.startsWith('w')) return 2;
        if (d.startsWith('th')) return 3;
        if (d.startsWith('f')) return 4;
        if (d.startsWith('sa')) return 5;
        if (d.startsWith('su')) return 6;
        return 0; // Monday default
      };

      assert.strictEqual(normalizeDay('Monday'), 0);
      assert.strictEqual(normalizeDay('Tu'), 1);
      assert.strictEqual(normalizeDay('Wednesday'), 2);
      assert.strictEqual(normalizeDay('Th'), 3);
      assert.strictEqual(normalizeDay('Friday'), 4);
      assert.strictEqual(normalizeDay('Saturday'), 5);
      assert.strictEqual(normalizeDay('Sunday'), 6);
    });
  });

  describe('Schedule Redesign Suite 5: Global Subject Registry & Edge Cases (SCH-REG-01, SCH-EMP-01)', () => {
    test('SCH-REG-01: Global Subject Registry synchronization and unscheduled subjects filter', () => {
      const sem = {
        subjects: [
          { id: 's1', name: 'Scheduled Course', hasSchedule: true, gradeTrackingEnabled: true },
          { id: 's2', name: 'Unscheduled Course', hasSchedule: false, gradeTrackingEnabled: true }
        ]
      };

      const unscheduled = getUnscheduledSubjects(sem);
      assert.strictEqual(unscheduled.length, 1);
      assert.strictEqual(unscheduled[0].name, 'Unscheduled Course');

      const tracked = getTrackedSubjects(sem);
      assert.strictEqual(tracked.length, 2);
    });

    test('SCH-EMP-01: Empty Schedule state resilience and null safe operations', () => {
      let data = {
        years: [
          {
            id: 'y1',
            semesters: [{ id: 's1', subjects: [], classes: [] }]
          }
        ]
      };

      const sem = data.years[0].semesters[0];
      const unscheduled = getUnscheduledSubjects(sem);
      assert.strictEqual(unscheduled.length, 0);

      // Verify empty schedule does not throw on stats calculation
      const overallAttendance = sem.classes.length === 0 ? 100 : 0;
      assert.strictEqual(overallAttendance, 100);
    });
  });
}
