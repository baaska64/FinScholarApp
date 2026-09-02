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

export function getLocalDateString(d = new Date()) {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

export function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  const trimmed = dateStr.trim();
  if (!trimmed) return 0;
  if (trimmed.includes('-') && !trimmed.includes('T')) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      const yr = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10) - 1;
      const da = parseInt(parts[2], 10);
      if (!isNaN(yr) && !isNaN(mo) && !isNaN(da)) {
        return new Date(yr, mo, da).getTime();
      }
    }
  }
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return 0;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function parseSemDate(s) {
  if (!s || typeof s !== 'string') return NaN;
  const trimmed = s.trim();
  if (!trimmed) return NaN;
  if (trimmed.includes('T')) return new Date(trimmed).getTime();
  const parts = trimmed.split('-');
  if (parts.length === 3) {
    const yr = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10) - 1;
    const da = parseInt(parts[2], 10);
    if (!isNaN(yr) && !isNaN(mo) && !isNaN(da)) {
      return new Date(yr, mo, da).getTime();
    }
  }
  return new Date(trimmed).getTime();
}

export function getTimeLeftText(dueDateIso, nowMs) {
  if (!dueDateIso || typeof dueDateIso !== 'string') return 'No date';
  const trimmed = dueDateIso.trim();
  if (!trimmed) return 'No date';

  const isOldFormat = !trimmed.includes('T');
  let dueTime = 0;
  if (isOldFormat) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      const yr = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10) - 1;
      const da = parseInt(parts[2], 10);
      if (!isNaN(yr) && !isNaN(mo) && !isNaN(da)) {
        dueTime = new Date(yr, mo, da, 23, 59, 59).getTime();
      }
    }
  } else {
    dueTime = new Date(trimmed).getTime();
  }

  if (isNaN(dueTime) || dueTime === 0) {
    const fallback = new Date(trimmed).getTime();
    if (isNaN(fallback)) return 'Invalid date';
    dueTime = fallback;
  }

  const diff = dueTime - nowMs;
  if (diff <= 0) return 'Overdue';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return `In ${days} day${days > 1 ? 's' : ''}`;
  if (hours >= 1) return `In ${hours} hr${hours > 1 ? 's' : ''} ${minutes % 60} min${minutes % 60 !== 1 ? 's' : ''}`;
  if (minutes >= 1) return `In ${minutes}m ${seconds % 60}s`;
  return `In ${seconds}s`;
}

export function parseScheduleTime(rawTime) {
  if (typeof rawTime === 'number') return rawTime;
  if (typeof rawTime !== 'string') return 8;
  const match = rawTime.match(/(\d+)(?::(\d+))?/);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) / 60 : 0;
    if (rawTime.toLowerCase().includes('pm') && h < 12) h += 12;
    if (rawTime.toLowerCase().includes('am') && h === 12) h = 0;
    return h + m;
  }
  return 8;
}

export function normalizeScheduleDay(day) {
  if (typeof day === 'number') return Math.max(0, Math.min(6, Math.floor(day)));
  if (typeof day !== 'string') return 0;
  const d = day.toLowerCase().trim();
  if (d.startsWith('tu') || d === 't') return 1;
  if (d.startsWith('w')) return 2;
  if (d.startsWith('th') || d === 'r' || d === 'h') return 3;
  if (d.startsWith('f')) return 4;
  if (d.startsWith('sa')) return 5;
  if (d.startsWith('su')) return 6;
  return 0;
}

export function normalizeScheduleDays(day) {
  if (typeof day === 'number') return [Math.max(0, Math.min(6, Math.floor(day)))];
  if (typeof day !== 'string') return [0];
  const d = day.toLowerCase().trim();
  if (!d) return [0];
  
  if (d === 'mwf') return [0, 2, 4];
  if (d === 'tth' || d === 'tr') return [1, 3];
  if (d === 'mtwtf' || d === 'm-f' || d === 'mon-fri') return [0, 1, 2, 3, 4];
  if (d === 'ss' || d === 'sat-sun' || d === 'sa-su') return [5, 6];

  if (d.includes(',') || d.includes('/') || d.includes('&') || d.includes('-') || (d.includes(' ') && (d.includes('mon') || d.includes('tue') || d.includes('wed') || d.includes('thu') || d.includes('fri') || d.includes('sat') || d.includes('sun')))) {
    const tokens = d.split(/[,/&\s-]+/).map(t => t.trim()).filter(Boolean);
    const mapped = [];
    tokens.forEach(t => {
      if (t.startsWith('tu') || t === 't') mapped.push(1);
      else if (t.startsWith('w')) mapped.push(2);
      else if (t.startsWith('th') || t === 'r' || t === 'h') mapped.push(3);
      else if (t.startsWith('f')) mapped.push(4);
      else if (t.startsWith('sa')) mapped.push(5);
      else if (t.startsWith('su')) mapped.push(6);
      else if (t.startsWith('m')) mapped.push(0);
    });
    if (mapped.length > 0) {
      return Array.from(new Set(mapped));
    }
  }

  if (d.startsWith('tu') || d === 't') return [1];
  if (d.startsWith('w')) return [2];
  if (d.startsWith('th') || d === 'r' || d === 'h') return [3];
  if (d.startsWith('f')) return [4];
  if (d.startsWith('sa')) return [5];
  if (d.startsWith('su')) return [6];
  return [0];
}

export function parseScheduleDuration(dur, startH = 8, endRaw = undefined) {
  if (typeof dur === 'number') return dur;
  if (typeof dur === 'string') {
    const match = dur.match(/(\d+(\.\d+)?)/);
    if (match) return parseFloat(match[1]);
  }
  if (endRaw !== undefined) {
    const endH = parseScheduleTime(endRaw);
    if (endH > startH) return endH - startH;
  }
  return 1;
}

export function importScannedClassesToLedger(data, activeYearId, activeSemId, scannedClasses, ensureSubjectFn) {
  let nd = JSON.parse(JSON.stringify(data));
  const sem = nd.years?.find(y => y.id === activeYearId)?.semesters?.find(s => s.id === activeSemId);
  if (!sem) return nd;

  const safeScanned = scannedClasses || [];
  safeScanned.forEach(sc => {
    const className = sc.name || sc.subject || sc.class || 'Unnamed Class';
    let subjectId = '';
    if (ensureSubjectFn) {
      const regResult = ensureSubjectFn(nd, activeYearId, activeSemId, className, { fromSchedule: true });
      nd = regResult.data;
      subjectId = regResult.subjectId;
      const subjectEntry = nd.years?.find(y => y.id === activeYearId)?.semesters?.find(s => s.id === activeSemId)?.subjects?.find(s => s.id === subjectId);
      if (subjectEntry) subjectEntry.hasSchedule = true;
    }

    const curSem = nd.years?.find(y => y.id === activeYearId)?.semesters?.find(s => s.id === activeSemId);
    if (!curSem) return;
    if (!curSem.classes) curSem.classes = [];

    const rawTime = sc.startHour !== undefined ? sc.startHour : (sc.time || sc.startTime || sc.start_time);

    if (sc.day !== undefined && rawTime !== undefined) {
      const parsedStartHour = parseScheduleTime(rawTime);
      const rawEndTime = sc.endHour !== undefined ? sc.endHour : (sc.endTime || sc.end_time);
      const dur = parseScheduleDuration(sc.duration, parsedStartHour, rawEndTime);
      const colorVal = sc.colorIdx !== undefined && sc.colorIdx !== null ? Number(sc.colorIdx) : 0;
      const dayIndices = normalizeScheduleDays(sc.day);

      dayIndices.forEach(dayIdx => {
        curSem.classes.push({
          id: 'cls_' + Math.random().toString(36).substr(2, 8),
          name: className,
          room: sc.room || sc.location || '',
          instructor: sc.instructor || sc.teacher || '',
          day: dayIdx,
          startHour: parsedStartHour,
          duration: dur,
          colorIdx: colorVal,
          subjectId,
          absences: 0, lates: 0, cuts: 0
        });
      });
    } else if (Array.isArray(sc.schedules) && sc.schedules.length > 0) {
      sc.schedules.forEach(sch => {
        const schTime = sch.startHour !== undefined ? sch.startHour : (sch.time || sch.startTime || sch.start_time);
        const parsedStartHour = parseScheduleTime(schTime);
        const schEndTime = sch.endHour !== undefined ? sch.endHour : (sch.endTime || sch.end_time);
        const dur = parseScheduleDuration(sch.duration, parsedStartHour, schEndTime);
        const colorVal = sch.colorIdx !== undefined && sch.colorIdx !== null ? Number(sch.colorIdx) : (sc.colorIdx !== undefined && sc.colorIdx !== null ? Number(sc.colorIdx) : 0);
        const dayIndices = normalizeScheduleDays(sch.day);

        dayIndices.forEach(dayIdx => {
          curSem.classes.push({
            id: 'cls_' + Math.random().toString(36).substr(2, 8),
            name: className,
            room: sch.room || sch.location || sc.room || sc.location || '',
            instructor: sch.instructor || sch.teacher || sc.instructor || sch.teacher || '',
            day: dayIdx,
            startHour: parsedStartHour,
            duration: dur,
            colorIdx: colorVal,
            subjectId,
            absences: 0, lates: 0, cuts: 0
          });
        });
      });
    }
  });

  return nd;
}

