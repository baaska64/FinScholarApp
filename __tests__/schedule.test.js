import assert from 'node:assert';

// Mock helper functions extracted from schedule.tsx and related components for empirical verification

export const normalizeDay = (day) => {
    if (typeof day === 'number') return Math.max(0, Math.min(6, day));
    if (typeof day !== 'string') return 0;
    const d = day.toLowerCase().trim();
    if (d.startsWith('tu')) return 1;
    if (d.startsWith('w')) return 2;
    if (d.startsWith('th')) return 3;
    if (d.startsWith('f')) return 4;
    if (d.startsWith('sa')) return 5;
    if (d.startsWith('su')) return 6;
    return 0;
};

export const parseTimeStr = (rawTime) => {
    let parsedStartHour = 8;
    if (typeof rawTime === 'number') {
        parsedStartHour = rawTime;
    } else if (typeof rawTime === 'string') {
        const match = rawTime.match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
        if (match) {
            let h = parseInt(match[1], 10);
            const m = parseInt(match[2] || '0', 10);
            const ampm = match[3]?.toLowerCase();
            if (ampm === 'pm' && h < 12) h += 12;
            if (ampm === 'am' && h === 12) h = 0;
            parsedStartHour = h + (m / 60);
        }
    }
    return parsedStartHour;
};

export const calculateOverallAttendance = (currentSem, referenceNow = new Date()) => {
    if (!currentSem || !currentSem.classes || currentSem.classes.length === 0) return 100;
    const startDateStr = currentSem.startDate || referenceNow.toISOString().split('T')[0];
    const endDateStr = currentSem.endDate || new Date(referenceNow.getTime() + 1000 * 60 * 60 * 24 * 120).toISOString().split('T')[0];
    const attendanceLog = currentSem.attendanceLog || {};
    
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const now = new Date(referenceNow);
    
    const limitDate = now < end ? now : end;
    
    let totalConductedHours = 0;
    let attendedHours = 0;
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    for (let d = new Date(start); d <= limitDate; d.setDate(d.getDate() + 1)) {
        const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
        const dateStr = d.toISOString().split('T')[0];
        
        const dayClasses = currentSem.classes.filter((c) => c.day === dayIdx);
        dayClasses.forEach((cls) => {
            const key = `${dateStr}_${cls.id}`;
            const logEntry = attendanceLog[key];
            let status = 'pending';
            let isManual = false;
            if (typeof logEntry === 'boolean') {
                status = logEntry ? 'present' : 'pending';
            } else if (logEntry) {
                status = logEntry.status || 'pending';
                isManual = !!logEntry.isManual;
            }
            
            const sessionDate = new Date(d);
            const startHour = cls.startHour || 0;
            sessionDate.setHours(Math.floor(startHour), (startHour % 1) * 60);
            
            const isPast = sessionDate < now;
            if (!isManual && status === 'pending' && sessionDate < oneWeekAgo) {
                status = 'absent';
            }
            
            if (isPast && status !== 'cancelled') {
                const duration = cls.duration || 1;
                totalConductedHours += duration;
                if (status === 'present') {
                    attendedHours += duration;
                }
            }
        });
    }
    
    if (totalConductedHours === 0) return 100;
    return Math.min(100, Math.max(0, Math.round((attendedHours / totalConductedHours) * 100)));
};

export const computeTimetableGridOverlaps = (classes, displayDayIndices) => {
    const processedClasses = classes.map((c) => ({ ...c, col: 0, maxCol: 1 }));
    displayDayIndices.forEach(dayIdx => {
        const dayClasses = processedClasses.filter((c) => c.day === dayIdx).sort((a, b) => a.startHour - b.startHour);
        
        const groups = [];
        let currentGroup = [];
        let groupEnd = -1;

        dayClasses.forEach((cls) => {
            if (currentGroup.length === 0) {
                currentGroup.push(cls);
                groupEnd = cls.startHour + cls.duration;
            } else if (cls.startHour >= groupEnd) {
                groups.push(currentGroup);
                currentGroup = [cls];
                groupEnd = cls.startHour + cls.duration;
            } else {
                currentGroup.push(cls);
                groupEnd = Math.max(groupEnd, cls.startHour + cls.duration);
            }
        });
        if (currentGroup.length > 0) groups.push(currentGroup);

        groups.forEach(group => {
            const columns = [];
            group.forEach((cls) => {
                let placed = false;
                for (let i = 0; i < columns.length; i++) {
                    const lastClassInCol = columns[i][columns[i].length - 1];
                    if (lastClassInCol.startHour + lastClassInCol.duration <= cls.startHour) {
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
            group.forEach((cls) => {
                cls.maxCol = columns.length;
            });
        });
    });
    return processedClasses;
};

export function runScheduleTests(describe, test) {
    describe('Schedule Suite 1: Day Normalization & Time Parsing', () => {
        test('1.1 Day normalization strings and numbers', () => {
            assert.strictEqual(normalizeDay('Monday'), 0);
            assert.strictEqual(normalizeDay('Tuesday'), 1);
            assert.strictEqual(normalizeDay('Wed'), 2);
            assert.strictEqual(normalizeDay('Thursday'), 3);
            assert.strictEqual(normalizeDay('Fri'), 4);
            assert.strictEqual(normalizeDay('Saturday'), 5);
            assert.strictEqual(normalizeDay('Sunday'), 6);
            assert.strictEqual(normalizeDay(3), 3);
            assert.strictEqual(normalizeDay(-2), 0);
            assert.strictEqual(normalizeDay(10), 6);
        });

        test('1.2 Time string parsing (AM/PM and 24h formats)', () => {
            assert.strictEqual(parseTimeStr(8), 8);
            assert.strictEqual(parseTimeStr('8:00 AM'), 8);
            assert.strictEqual(parseTimeStr('1:30 PM'), 13.5);
            assert.strictEqual(parseTimeStr('12:00 PM'), 12);
            assert.strictEqual(parseTimeStr('12:00 AM'), 0);
            assert.strictEqual(parseTimeStr('14:45'), 14.75);
        });
    });

    describe('Schedule Suite 2: Attendance Rate Calculation Logic', () => {
        test('2.1 Empty classes returns 100% attendance', () => {
            const sem = { classes: [], attendanceLog: {} };
            assert.strictEqual(calculateOverallAttendance(sem), 100);
        });

        test('2.2 Single past class present vs absent', () => {
            const now = new Date('2026-08-09T10:00:00Z');
            const sem = {
                startDate: '2026-08-01',
                endDate: '2026-12-01',
                classes: [{ id: 'c1', name: 'CS101', day: 0, startHour: 8, duration: 1.5 }], // Monday Aug 3 8:00am
                attendanceLog: {
                    '2026-08-03_c1': { status: 'present', isManual: true }
                }
            };
            assert.strictEqual(calculateOverallAttendance(sem, now), 100);

            sem.attendanceLog['2026-08-03_c1'] = { status: 'absent', isManual: true };
            assert.strictEqual(calculateOverallAttendance(sem, now), 0);
        });

        test('2.3 Cancelled classes are excluded from total conducted hours', () => {
            const now = new Date('2026-08-09T10:00:00Z');
            const sem = {
                startDate: '2026-08-01',
                endDate: '2026-12-01',
                classes: [
                    { id: 'c1', name: 'CS101', day: 0, startHour: 8, duration: 2 },
                    { id: 'c2', name: 'MATH101', day: 1, startHour: 10, duration: 2 }
                ],
                attendanceLog: {
                    '2026-08-03_c1': { status: 'present', isManual: true },
                    '2026-08-04_c2': { status: 'cancelled', isManual: true }
                }
            };
            // 2 hrs attended out of 2 total conducted hours (c2 is cancelled) -> 100%
            assert.strictEqual(calculateOverallAttendance(sem, now), 100);
        });

        test('2.4 Unlogged sessions older than 7 days auto-count as absent', () => {
            const now = new Date('2026-08-20T10:00:00Z');
            const sem = {
                startDate: '2026-08-01',
                endDate: '2026-12-01',
                classes: [
                    { id: 'c1', name: 'CS101', day: 0, startHour: 8, duration: 2 } // Aug 3 (older than 7 days relative to Aug 20)
                ],
                attendanceLog: {} // unlogged
            };
            // Aug 3 is >7 days before Aug 20, unlogged => absent -> 0%
            assert.strictEqual(calculateOverallAttendance(sem, now), 0);
        });
    });

    describe('Schedule Suite 3: Timetable Grid Overlap Layout', () => {
        test('3.1 Non-overlapping classes sit in column 0 with maxCol 1', () => {
            const classes = [
                { id: '1', name: 'Class A', day: 0, startHour: 8, duration: 1.5 },
                { id: '2', name: 'Class B', day: 0, startHour: 10, duration: 1.5 }
            ];
            const processed = computeTimetableGridOverlaps(classes, [0, 1, 2, 3, 4, 5, 6]);
            assert.strictEqual(processed[0].col, 0);
            assert.strictEqual(processed[0].maxCol, 1);
            assert.strictEqual(processed[1].col, 0);
            assert.strictEqual(processed[1].maxCol, 1);
        });

        test('3.2 Overlapping classes get separate columns and maxCol 2', () => {
            const classes = [
                { id: '1', name: 'Class A', day: 0, startHour: 8, duration: 2 },
                { id: '2', name: 'Class B', day: 0, startHour: 9, duration: 2 }
            ];
            const processed = computeTimetableGridOverlaps(classes, [0, 1, 2, 3, 4, 5, 6]);
            assert.strictEqual(processed[0].col, 0);
            assert.strictEqual(processed[0].maxCol, 2);
            assert.strictEqual(processed[1].col, 1);
            assert.strictEqual(processed[1].maxCol, 2);
        });
    });
}
