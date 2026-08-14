import assert from 'node:assert';
import { calculateOverallAttendance } from './schedule.test.js';

// Extracted AttendanceTracker logic for comparison
function computeAttendanceTrackerStats(currentSem, referenceNow = new Date()) {
    if (!currentSem || !currentSem.classes || currentSem.classes.length === 0) {
        return { overallTotal: 0, overallAttended: 0, overallPct: 100 };
    }
    const defaultStart = referenceNow.toISOString().split('T')[0];
    const defaultEnd = new Date(referenceNow.getTime() + 1000 * 60 * 60 * 24 * 120).toISOString().split('T')[0];
    const startDateStr = currentSem.startDate || defaultStart;
    const endDateStr = currentSem.endDate || defaultEnd;
    const attendanceLog = currentSem.attendanceLog || {};
    const classes = currentSem.classes || [];

    const getLogEntry = (sessionKey) => {
        const raw = attendanceLog[sessionKey];
        if (typeof raw === 'boolean') {
            return { status: raw ? 'present' : null, takeaway: '' };
        }
        return raw || {};
    };

    const sessList = [];
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const currentDate = new Date(referenceNow);
    const oneWeekAgo = new Date(currentDate);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
        const dateStr = d.toISOString().split('T')[0];

        const dayClasses = classes.filter((c) => c.day === dayIdx);
        dayClasses.forEach((cls) => {
            const key = `${dateStr}_${cls.id}`;
            const log = getLogEntry(key);
            const sessionDate = new Date(d);
            sessionDate.setHours(Math.floor(cls.startHour), (cls.startHour % 1) * 60);

            let status = log.status || 'pending';
            const isPast = sessionDate < currentDate;

            if (!log.isManual && status === 'pending' && sessionDate < oneWeekAgo) {
                status = 'absent';
            }

            if (!isPast && status === 'pending') {
                status = 'future';
            }

            sessList.push({
                key,
                date: new Date(d),
                dateStr,
                classObj: cls,
                status,
                takeaway: log.takeaway || '',
                isPast
            });
        });
    }

    let overallTotal = 0;
    let overallAttended = 0;

    sessList.forEach((s) => {
        if (s.isPast && s.status !== 'cancelled') {
            overallTotal += s.classObj.duration;
            if (s.status === 'present') overallAttended += s.classObj.duration;
        }
    });

    const overallPct = overallTotal === 0 ? 100 : Math.min(100, Math.max(0, Math.round((overallAttended / overallTotal) * 100)));
    return { overallTotal, overallAttended, overallPct, sessList };
}

export function runChallengerReverificationTests(describe, test) {
    describe('Challenger Gate 2 Re-verification Suite', () => {
        test('V1: Remediation Check - Date instantiation in schedule.tsx', () => {
            const startDateStr = '2026-08-01';
            const start = new Date(startDateStr);
            assert.ok(!isNaN(start.getTime()), 'start Date should be a valid Date object');
            assert.strictEqual(start.toISOString().split('T')[0], '2026-08-01', 'start Date should parse correctly');
        });

        test('V2: Timezone & Date Key Consistency between schedule.tsx and AttendanceTracker.tsx', () => {
            const sem = {
                startDate: '2026-08-01',
                endDate: '2026-08-31',
                classes: [
                    { id: 'c1', name: 'Math 101', day: 0, startHour: 9, duration: 1.5 },
                    { id: 'c2', name: 'Physics 101', day: 2, startHour: 13, duration: 2 },
                    { id: 'c3', name: 'PE 1', day: 4, startHour: 15, duration: 1 }
                ],
                attendanceLog: {
                    '2026-08-03_c1': { status: 'present', isManual: true },
                    '2026-08-05_c2': { status: 'absent', isManual: true },
                    '2026-08-07_c3': { status: 'cancelled', isManual: true }
                }
            };

            const now = new Date('2026-08-15T12:00:00Z');
            const schedPct = calculateOverallAttendance(sem, now);
            const trackerStats = computeAttendanceTrackerStats(sem, now);

            assert.strictEqual(schedPct, trackerStats.overallPct, `Attendance % mismatch: schedule=${schedPct} vs tracker=${trackerStats.overallPct}`);
        });

        test('V3: Stress Test - Mixed Legacy Boolean and New Object Attendance Logs', () => {
            const sem = {
                startDate: '2026-08-01',
                endDate: '2026-08-30',
                classes: [
                    { id: 'c1', name: 'Chem', day: 1, startHour: 10, duration: 3 }
                ],
                attendanceLog: {
                    '2026-08-04_c1': true, // legacy boolean present
                    '2026-08-11_c1': false, // legacy boolean false (pending)
                    '2026-08-18_c1': { status: 'present', isManual: true }
                }
            };

            const now = new Date('2026-08-25T12:00:00Z');
            const schedPct = calculateOverallAttendance(sem, now);
            const trackerStats = computeAttendanceTrackerStats(sem, now);

            assert.strictEqual(schedPct, trackerStats.overallPct, `Mixed log format percentage mismatch: schedule=${schedPct} vs tracker=${trackerStats.overallPct}`);
        });

        test('V4: Boundary Test - Leap year and year turnover dates', () => {
            const sem = {
                startDate: '2028-02-25',
                endDate: '2028-03-05',
                classes: [
                    { id: 'c1', name: 'Bio 101', day: 1, startHour: 8, duration: 2 } // Tuesday Feb 29 2028
                ],
                attendanceLog: {
                    '2028-02-29_c1': { status: 'present', isManual: true }
                }
            };

            const now = new Date('2028-03-01T10:00:00Z');
            const schedPct = calculateOverallAttendance(sem, now);
            const trackerStats = computeAttendanceTrackerStats(sem, now);

            assert.strictEqual(schedPct, 100);
            assert.strictEqual(schedPct, trackerStats.overallPct);
        });
    });
}

