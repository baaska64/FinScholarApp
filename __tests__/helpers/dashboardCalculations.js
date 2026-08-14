import { Calculator } from '../../utils/calculator.js';

/**
 * Calculates Semester Progress Bar percentage based on start/end dates.
 */
export function calculateSemesterProgress(startDateStr, endDateStr, currentDate = new Date()) {
  if (!startDateStr || !endDateStr) {
    return { percent: 0, isValid: false, status: 'missing_dates' };
  }

  const startMs = new Date(startDateStr + 'T00:00:00').getTime();
  const endMs = new Date(endDateStr + 'T23:59:59').getTime();
  const nowMs = typeof currentDate === 'string' ? new Date(currentDate).getTime() : currentDate.getTime();

  if (isNaN(startMs) || isNaN(endMs) || isNaN(nowMs)) {
    return { percent: 0, isValid: false, status: 'invalid_dates' };
  }

  if (nowMs < startMs) {
    const daysUntil = Math.ceil((startMs - nowMs) / (1000 * 60 * 60 * 24));
    return { percent: 0, isValid: true, status: 'not_started', daysUntil };
  }

  if (nowMs > endMs) {
    return { percent: 100, isValid: true, status: 'ended' };
  }

  const totalDuration = endMs - startMs;
  if (totalDuration <= 0) {
    return { percent: 0, isValid: false, status: 'invalid_range' };
  }

  const elapsed = nowMs - startMs;
  const rawPercent = (elapsed / totalDuration) * 100;
  const percent = Math.min(100, Math.max(0, rawPercent));

  return { percent, isValid: true, status: 'active' };
}

/**
 * Calculates Attendance Statistics from class schedule and attendance log.
 */
export function calculateAttendanceStats(classes = [], attendanceLog = {}, startDateStr, endDateStr, currentDate = new Date()) {
  if (!classes || classes.length === 0 || !startDateStr || !endDateStr) {
    return { totalLogged: 0, presentCount: 0, absentCount: 0, cancelledCount: 0, percentage: 0 };
  }

  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T23:59:59');
  const now = typeof currentDate === 'string' ? new Date(currentDate) : currentDate;

  let presentCount = 0;
  let absentCount = 0;
  let cancelledCount = 0;

  for (let d = new Date(start); d <= end && d <= now; d.setDate(d.getDate() + 1)) {
    const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1; // 0=Mon, 6=Sun
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yr}-${mo}-${da}`;
    const dayClasses = classes.filter(c => c.day === dayIdx);

    dayClasses.forEach(cls => {
      const key = `${dateStr}_${cls.id}`;
      const entry = attendanceLog[key];
      let status = null;

      if (typeof entry === 'boolean') {
        status = entry ? 'present' : null;
      } else if (entry && typeof entry === 'object') {
        status = entry.status;
      }

      if (status === 'present') {
        presentCount++;
      } else if (status === 'absent') {
        absentCount++;
      } else if (status === 'cancelled') {
        cancelledCount++;
      }
    });
  }

  const totalLogged = presentCount + absentCount;
  const percentage = totalLogged > 0 ? (presentCount / totalLogged) * 100 : 0;

  return {
    totalLogged,
    presentCount,
    absentCount,
    cancelledCount,
    percentage
  };
}

/**
 * Calculates subject task completion percentage based on requirements.
 */
export function calculateSubjectTaskProgress(subject) {
  if (!subject || !subject.requirements || !Array.isArray(subject.requirements) || subject.requirements.length === 0) {
    return { totalTasks: 0, completedTasks: 0, percentage: 0 };
  }

  const requirements = subject.requirements;
  const totalTasks = requirements.length;
  const completedTasks = requirements.filter(r => r.status === 'submitted' || r.status === 'graded' || r.completed === true).length;
  const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return { totalTasks, completedTasks, percentage };
}

/**
 * Calculates pending task count across all subjects in a semester.
 */
export function calculatePendingTaskCount(semester) {
  if (!semester || !semester.subjects || !Array.isArray(semester.subjects)) {
    return { pendingCount: 0, pendingTasks: [] };
  }

  const pendingTasks = [];
  semester.subjects.forEach(sub => {
    if (sub.requirements && Array.isArray(sub.requirements)) {
      sub.requirements.forEach(req => {
        if (req.status !== 'submitted' && req.status !== 'graded' && !req.completed) {
          pendingTasks.push({
            ...req,
            subjectId: sub.id,
            subjectName: sub.name
          });
        }
      });
    }
  });

  return { pendingCount: pendingTasks.length, pendingTasks };
}

/**
 * Calculates all 5 Hero Card Stats for a given semester and year state.
 */
export function calculateDashboardHeroStats(data, yearId, semId, currentDate = new Date()) {
  const currentYear = data?.years?.find(y => y.id === yearId);
  const currentSem = currentYear?.semesters?.find(s => s.id === semId);
  const system = data?.settings?.gradingSystem || '1_IS_BEST';

  const semProgress = currentSem
    ? calculateSemesterProgress(currentSem.startDate, currentSem.endDate, currentDate)
    : { percent: 0, isValid: false, status: 'no_semester' };

  const semGWA = currentSem
    ? Calculator.calculateSemester(currentSem, system)
    : { percent: 0, equivalent: 0 };

  const yearGWA = currentYear
    ? Calculator.calculateYear(currentYear, system)
    : { percent: 0, equivalent: 0 };

  const attendance = currentSem
    ? calculateAttendanceStats(currentSem.classes || [], currentSem.attendanceLog || {}, currentSem.startDate, currentSem.endDate, currentDate)
    : { totalLogged: 0, presentCount: 0, absentCount: 0, cancelledCount: 0, percentage: 0 };

  const pendingTasks = currentSem
    ? calculatePendingTaskCount(currentSem)
    : { pendingCount: 0, pendingTasks: [] };

  return {
    semProgress,
    semGWA,
    yearGWA,
    attendance,
    pendingTasks
  };
}
