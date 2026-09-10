/**
 * The widget family's read model.
 *
 * Everything the home-screen widgets draw is derived here, once, from the same
 * `grade_ledger_v2_data` document the app uses. Keeping it pure — ledger in,
 * snapshot out — means the schedule maths, the due-date urgency and the
 * semester stats are all covered by `__tests__/widgetTaskHandler.test.js`
 * without rendering anything, and it means five widgets cost one parse of the
 * ledger instead of five.
 *
 * Conventions inherited from the ledger: `day` is 0 = Monday … 6 = Sunday (not
 * `getDay()`), `startHour` is a float (13.5 = 1:30 PM) and `duration` is hours.
 */

import { Calculator } from '../utils/calculator';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Long titles are pasted in from syllabi; they cost bitmap time and never fit. */
const MAX_TEXT = 80;

export type ClassState = 'past' | 'now' | 'next' | 'later';
export type TaskUrgency = 'overdue' | 'today' | 'soon' | 'later' | 'none';

export interface WidgetClassData {
  id: string;
  courseName: string;
  room: string;
  /** Start time, 12-hour. */
  timeStr: string;
  endTimeStr: string;
  /** "7:30 – 9:00 AM" — the meridiem is written once when both ends share it. */
  rangeStr: string;
  /** Long form kept for parity with the app's copy: "In progress", "In 2h 30m". */
  timeRemainingStr: string;
  /** Chip form: "38m left", "in 2h 30m", "Tue". */
  shortRemainingStr: string;
  isOngoing: boolean;
  minutesAway: number;
  minutesLeft: number;
  /** 0…1 through the session; 0 unless the class is running. */
  progress: number;
  colorIdx: number | null;
  dayLabel: string;
  isToday: boolean;
  startHour: number;
  duration: number;
}

export interface WidgetTodayClass extends WidgetClassData {
  state: ClassState;
}

export interface WidgetTaskData {
  id: string;
  title: string;
  subjectName: string;
  colorIdx: number | null;
  priority: 'high' | 'medium' | 'low';
  /** "Overdue", "Due today", "Tomorrow", "in 4d", "No due date". */
  dueLabel: string;
  urgency: TaskUrgency;
  dueAt: number | null;
}

export interface WidgetStats {
  /** Pre-formatted so the widget never has to know the grading system. */
  gradeValue: string;
  gradeCaption: string;
  attendancePct: number;
  hasAttendance: boolean;
  pendingCount: number;
  overdueCount: number;
  termPct: number;
  termCaption: string;
  classesToday: number;
  classesLeftToday: number;
}

export interface WidgetSnapshot {
  generatedAt: number;
  dayLabel: string;
  dateLabel: string;
  termLabel: string;
  /** Ongoing class first, then the next sessions in time order. */
  upcoming: WidgetClassData[];
  today: WidgetTodayClass[];
  tasks: WidgetTaskData[];
  stats: WidgetStats;
  hasSchedule: boolean;
}

// ── Formatters ────────────────────────────────────────────────────────────────

export function formatTimeStr(startHour: number): string {
  if (typeof startHour !== 'number' || !Number.isFinite(startHour)) return '12:00 AM';
  const totalMins = Math.round(startHour * 60);
  const normalizedMins = ((totalMins % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalizedMins / 60);
  const mins = normalizedMins % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayH = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayH}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

export function formatCountdown(waitHours: number, isOngoing: boolean): string {
  if (isOngoing) return 'In progress';
  if (typeof waitHours !== 'number' || !Number.isFinite(waitHours) || waitHours < 0) return 'In progress';
  const totalMinutes = Math.round(waitHours * 60);
  if (totalMinutes <= 0) return 'In 0m';
  if (totalMinutes < 60) return `In ${totalMinutes}m`;
  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  if (totalHours < 24) {
    return remMinutes > 0 ? `In ${totalHours}h ${remMinutes}m` : `In ${totalHours}h`;
  }
  const dLeft = Math.floor(totalHours / 24);
  return `In ${dLeft} day${dLeft > 1 ? 's' : ''}`;
}

/** Compact countdown for chips, where "In 2h 30m" is one word too long. */
export function formatShortDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'now';
  const mins = Math.round(minutes);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/** "7:30 – 9:00 AM" when both ends share a meridiem, "11:30 AM – 1:00 PM" when not. */
export function formatTimeRange(startHour: number, duration: number): string {
  const start = formatTimeStr(startHour);
  const end = formatTimeStr(startHour + duration);
  const startMeridiem = start.slice(-2);
  const endMeridiem = end.slice(-2);
  if (startMeridiem === endMeridiem) {
    return `${start.slice(0, -3)} – ${end}`;
  }
  return `${start} – ${end}`;
}

export function isValidClass(cls: any): boolean {
  return Boolean(
    cls &&
      cls.name &&
      typeof cls.name === 'string' &&
      cls.name.trim() !== '' &&
      typeof cls.startHour === 'number' &&
      Number.isFinite(cls.startHour) &&
      cls.startHour >= 0 &&
      cls.startHour < 24 &&
      typeof cls.day === 'number' &&
      Number.isInteger(cls.day) &&
      cls.day >= 0 &&
      cls.day <= 6
  );
}

/**
 * Mirrors `parseDueDate` in components/tasks/utils.ts. Duplicated rather than
 * imported so the widget bundle stays free of React Native UI modules; the
 * legacy `YYYY-MM-DD` form still means "end of that day".
 */
export function parseDueDate(dueDateStr?: string | null): Date | null {
  if (!dueDateStr || typeof dueDateStr !== 'string') return null;
  const trimmed = dueDateStr.trim();
  if (!trimmed) return null;

  if (!trimmed.includes('T')) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d, 23, 59, 59);
      }
    }
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function clean(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > MAX_TEXT ? `${trimmed.slice(0, MAX_TEXT)}…` : trimmed;
}

/** Course codes are usually "CSIT 227 - Advanced Mobile"; the code alone reads better. */
function shortCourseName(name: unknown): string {
  const full = clean(name, 'Untitled class');
  return full.split(/\s+[-–—]\s+/)[0].trim() || full;
}

function safeDuration(duration: unknown): number {
  const num = Number(duration);
  if (!Number.isFinite(num) || num <= 0) return 1;
  return Math.min(num, 24);
}

function dayIndexOf(date: Date): number {
  return date.getDay() === 0 ? 6 : date.getDay() - 1;
}

function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseSemDate(value: unknown): number {
  if (!value || typeof value !== 'string') return NaN;
  const parts = value.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d).getTime();
  }
  const parsed = new Date(value);
  return parsed.getTime();
}

// ── Schedule ──────────────────────────────────────────────────────────────────

function toClassData(
  cls: any,
  opts: { waitHours: number; isOngoing: boolean; now: Date; dayIdx: number }
): WidgetClassData {
  const duration = safeDuration(cls.duration);
  const startHour = Number(cls.startHour) || 0;
  const minutesAway = Math.max(0, Math.round(opts.waitHours * 60));
  const hoursIn = opts.isOngoing ? opts.now.getHours() + opts.now.getMinutes() / 60 - startHour : 0;
  const progress = opts.isOngoing ? Math.min(1, Math.max(0, hoursIn / duration)) : 0;

  return {
    id: String(cls.id ?? `${cls.name}-${startHour}`),
    courseName: shortCourseName(cls.name),
    room: clean(cls.room, 'TBA'),
    timeStr: formatTimeStr(startHour),
    endTimeStr: formatTimeStr(startHour + duration),
    rangeStr: formatTimeRange(startHour, duration),
    timeRemainingStr: formatCountdown(opts.waitHours, opts.isOngoing),
    shortRemainingStr: opts.isOngoing
      ? `${formatShortDuration(Math.max(0, (duration - hoursIn) * 60))} left`
      : `in ${formatShortDuration(minutesAway)}`,
    isOngoing: opts.isOngoing,
    minutesAway,
    minutesLeft: opts.isOngoing ? Math.max(0, Math.round((duration - hoursIn) * 60)) : 0,
    progress,
    colorIdx: Number.isFinite(Number(cls.colorIdx)) ? Number(cls.colorIdx) : null,
    dayLabel: DAY_LABELS[opts.dayIdx] ?? '',
    isToday: opts.dayIdx === dayIndexOf(opts.now) && opts.waitHours < 24,
    startHour,
    duration,
  };
}

/**
 * The ongoing class, then the next sessions in time order.
 *
 * A class earlier today that has already finished rolls forward a week rather
 * than showing as "overdue", and a semester that has not started yet counts
 * from its start date so the widget previews week one instead of sitting empty.
 */
function buildUpcoming(classes: any[], now: Date, semStart: Date | null, limit: number): WidgetClassData[] {
  const isFutureSemester = Boolean(semStart && now < semStart);
  const currentDayIdx = dayIndexOf(now);
  const currentHourFloat = now.getHours() + now.getMinutes() / 60;

  const result: WidgetClassData[] = [];

  const ongoing = isFutureSemester
    ? undefined
    : classes.find((cls) => {
        const duration = safeDuration(cls.duration);
        return cls.day === currentDayIdx && currentHourFloat >= cls.startHour && currentHourFloat < cls.startHour + duration;
      });

  if (ongoing) {
    result.push(toClassData(ongoing, { waitHours: 0, isOngoing: true, now, dayIdx: currentDayIdx }));
  }

  const baseDate = isFutureSemester && semStart ? semStart : now;
  const baseDayIdx = dayIndexOf(baseDate);
  const baseHourFloat = isFutureSemester ? 0 : currentHourFloat;

  const pending: { cls: any; waitHours: number; dayIdx: number }[] = [];

  classes.forEach((cls) => {
    if (ongoing && cls === ongoing) return;

    let daysUntil = cls.day - baseDayIdx;
    const duration = safeDuration(cls.duration);
    const classEndHour = cls.startHour + duration;

    if (daysUntil === 0) {
      if (baseHourFloat >= classEndHour) {
        daysUntil = 7;
      } else if (baseHourFloat >= cls.startHour) {
        return;
      }
    } else if (daysUntil < 0) {
      daysUntil += 7;
    }

    let waitHours = daysUntil * 24 + (cls.startHour - baseHourFloat);
    if (isFutureSemester && semStart) {
      waitHours += (semStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    }

    if (waitHours > 0) {
      pending.push({ cls, waitHours, dayIdx: cls.day });
    }
  });

  pending.sort((a, b) => a.waitHours - b.waitHours);

  for (const { cls, waitHours, dayIdx } of pending.slice(0, Math.max(0, limit - result.length))) {
    result.push(toClassData(cls, { waitHours, isOngoing: false, now, dayIdx }));
  }

  return result;
}

/** Every session scheduled for today, in clock order, tagged with its state. */
function buildToday(classes: any[], now: Date, limit: number): WidgetTodayClass[] {
  const todayIdx = dayIndexOf(now);
  const currentHourFloat = now.getHours() + now.getMinutes() / 60;

  const todays = classes
    .filter((cls) => cls.day === todayIdx)
    .slice()
    .sort((a, b) => a.startHour - b.startHour);

  let nextAssigned = false;

  return todays.slice(0, limit).map((cls) => {
    const duration = safeDuration(cls.duration);
    const isOngoing = currentHourFloat >= cls.startHour && currentHourFloat < cls.startHour + duration;
    const isPast = currentHourFloat >= cls.startHour + duration;

    let state: ClassState;
    if (isOngoing) {
      state = 'now';
    } else if (isPast) {
      state = 'past';
    } else if (!nextAssigned) {
      state = 'next';
      nextAssigned = true;
    } else {
      state = 'later';
    }

    const waitHours = isOngoing || isPast ? 0 : cls.startHour - currentHourFloat;
    return { ...toClassData(cls, { waitHours, isOngoing, now, dayIdx: todayIdx }), state };
  });
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function urgencyOf(dueAt: number | null, nowMs: number): TaskUrgency {
  if (dueAt === null) return 'none';
  const diff = dueAt - nowMs;
  if (diff <= 0) return 'overdue';
  const hours = diff / (1000 * 60 * 60);
  if (hours <= 24) return 'today';
  if (hours <= 72) return 'soon';
  return 'later';
}

function dueLabelOf(dueAt: number | null, nowMs: number, urgency: TaskUrgency): string {
  if (dueAt === null) return 'No due date';
  if (urgency === 'overdue') return 'Overdue';
  const diffMinutes = (dueAt - nowMs) / (1000 * 60);
  if (diffMinutes <= 60) return `${Math.max(1, Math.round(diffMinutes))}m left`;
  const due = new Date(dueAt);
  const now = new Date(nowMs);
  const sameDay = due.toDateString() === now.toDateString();
  if (sameDay) return 'Today';
  const tomorrow = new Date(nowMs + 24 * 60 * 60 * 1000);
  if (due.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  // Calendar days, not elapsed hours: something due next Thursday is "7d left"
  // to a student, even though it is 7.2 x 24 hours away.
  const days = Math.round((startOfDay(dueAt) - startOfDay(nowMs)) / (1000 * 60 * 60 * 24));
  if (days <= 14) return `${days}d left`;
  return `${MONTH_LABELS[due.getMonth()]} ${due.getDate()}`;
}

/** Unfinished work across every subject in the term, soonest deadline first. */
function buildTasks(subjects: any[], nowMs: number, limit: number): WidgetTaskData[] {
  const tasks: WidgetTaskData[] = [];

  subjects.forEach((subject: any, subjectIdx: number) => {
    const requirements = Array.isArray(subject?.requirements) ? subject.requirements : [];
    requirements.forEach((req: any) => {
      if (!req || typeof req !== 'object') return;
      // A missing status predates the tasks screen — treat it as still to do
      // rather than dropping the row.
      if (req.status === 'submitted' || req.status === 'graded') return;
      const title = clean(req.title);
      if (!title) return;

      const due = parseDueDate(req.dueDate);
      const dueAt = due ? due.getTime() : null;
      const urgency = urgencyOf(dueAt, nowMs);

      tasks.push({
        id: String(req.id ?? `${subject?.id ?? subjectIdx}-${title}`),
        title,
        subjectName: shortCourseName(subject?.name ?? ''),
        colorIdx: Number.isFinite(Number(subject?.colorIdx)) ? Number(subject.colorIdx) : subjectIdx,
        priority: req.priority === 'high' || req.priority === 'low' ? req.priority : 'medium',
        dueLabel: dueLabelOf(dueAt, nowMs, urgency),
        urgency,
        dueAt,
      });
    });
  });

  tasks.sort((a, b) => {
    if (a.dueAt === null && b.dueAt === null) return a.title.localeCompare(b.title);
    if (a.dueAt === null) return 1;
    if (b.dueAt === null) return -1;
    return a.dueAt - b.dueAt;
  });

  return tasks.slice(0, limit);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

/** Longest span the attendance sweep will walk, so a mistyped year cannot hang the update. */
const MAX_TERM_DAYS = 400;

/**
 * Attendance as a share of hours actually sat, matching the dashboard: sessions
 * still unmarked a week after the fact count as absent, cancelled ones drop out
 * of the denominator entirely.
 */
function computeAttendance(sem: any, now: Date): { pct: number; hasData: boolean } {
  const classes = Array.isArray(sem?.classes) ? sem.classes.filter(isValidClass) : [];
  if (classes.length === 0) return { pct: 100, hasData: false };

  const startMs = parseSemDate(sem?.startDate);
  const endMs = parseSemDate(sem?.endDate);
  if (isNaN(startMs) || isNaN(endMs)) return { pct: 100, hasData: false };

  const attendanceLog = sem?.attendanceLog || {};
  const end = new Date(endMs);
  end.setHours(23, 59, 59, 999);
  const limitDate = now < end ? now : end;
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let totalConductedHours = 0;
  let attendedHours = 0;
  let days = 0;

  for (const d = new Date(startMs); d <= limitDate && days < MAX_TERM_DAYS; d.setDate(d.getDate() + 1)) {
    days++;
    const dayIdx = dayIndexOf(d);
    const dateStr = localDateString(d);

    for (const cls of classes) {
      if (cls.day !== dayIdx) continue;

      const logEntry = attendanceLog[`${dateStr}_${cls.id}`];
      let status = 'pending';
      let isManual = false;
      if (typeof logEntry === 'boolean') {
        status = logEntry ? 'present' : 'pending';
      } else if (logEntry) {
        status = logEntry.status || 'pending';
        isManual = Boolean(logEntry.isManual);
      }

      const sessionDate = new Date(d);
      const startHour = Number(cls.startHour) || 0;
      sessionDate.setHours(Math.floor(startHour), (startHour % 1) * 60, 0, 0);
      if (sessionDate >= now) continue;

      if (!isManual && status === 'pending' && sessionDate < oneWeekAgo) status = 'absent';
      if (status === 'cancelled') continue;

      totalConductedHours += safeDuration(cls.duration);
      if (status === 'present') attendedHours += safeDuration(cls.duration);
    }
  }

  if (totalConductedHours === 0) return { pct: 100, hasData: false };
  return { pct: Math.min(100, Math.max(0, Math.round((attendedHours / totalConductedHours) * 100))), hasData: true };
}

function computeTerm(sem: any, now: Date): { pct: number; caption: string } {
  const startMs = parseSemDate(sem?.startDate);
  const endMs = parseSemDate(sem?.endDate);
  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) return { pct: 0, caption: 'No term dates' };

  const start = new Date(startMs);
  if (now < start) {
    const daysAway = Math.ceil((startMs - now.getTime()) / (1000 * 60 * 60 * 24));
    return { pct: 0, caption: `Starts in ${daysAway}d` };
  }

  const totalDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const daysPassed = Math.min(totalDays, Math.max(0, Math.round((today.getTime() - startMs) / (1000 * 60 * 60 * 24))));
  const pct = Math.min(100, Math.max(0, Math.round((daysPassed / totalDays) * 100)));

  if (daysPassed >= totalDays) return { pct: 100, caption: 'Term complete' };
  return { pct, caption: `Week ${Math.floor(daysPassed / 7) + 1} of ${Math.ceil(totalDays / 7)}` };
}

function computeGrade(sem: any, system: string): { value: string; caption: string } {
  try {
    const res = Calculator.calculateSemester(sem, system);
    if (system === 'PERCENT') {
      return {
        value: res.percent > 0 ? `${res.percent.toFixed(1)}%` : '--',
        caption: 'Term average',
      };
    }
    return {
      value: res.equivalent > 0 ? res.equivalent.toFixed(2) : '--',
      caption: 'Term GWA',
    };
  } catch {
    return { value: '--', caption: 'Term GWA' };
  }
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface SnapshotOptions {
  yearId?: string | null;
  semId?: string | null;
  now?: Date;
}

export const EMPTY_STATS: WidgetStats = {
  gradeValue: '--',
  gradeCaption: 'Term GWA',
  attendancePct: 100,
  hasAttendance: false,
  pendingCount: 0,
  overdueCount: 0,
  termPct: 0,
  termCaption: 'No term dates',
  classesToday: 0,
  classesLeftToday: 0,
};

export function emptySnapshot(now: Date = new Date()): WidgetSnapshot {
  return {
    generatedAt: now.getTime(),
    dayLabel: DAY_LABELS[dayIndexOf(now)] ?? '',
    dateLabel: `${MONTH_LABELS[now.getMonth()]} ${now.getDate()}`,
    termLabel: '',
    upcoming: [],
    today: [],
    tasks: [],
    stats: { ...EMPTY_STATS },
    hasSchedule: false,
  };
}

export function buildWidgetSnapshot(ledger: any, options: SnapshotOptions = {}): WidgetSnapshot {
  const now = options.now instanceof Date && !isNaN(options.now.getTime()) ? options.now : new Date();
  const snapshot = emptySnapshot(now);

  const years = Array.isArray(ledger?.years) ? ledger.years : [];
  if (years.length === 0) return snapshot;

  // Same resolution the screens use: the selected ids when they are stored,
  // otherwise the first term in the ledger.
  const year = years.find((y: any) => (options.yearId ? y?.id === options.yearId : true));
  const semesters = Array.isArray(year?.semesters) ? year.semesters : [];
  const sem = semesters.find((s: any) => (options.semId ? s?.id === options.semId : true));
  if (!sem) return snapshot;

  snapshot.termLabel = clean(sem.name, '');

  const classes = Array.isArray(sem.classes) ? sem.classes.filter(isValidClass) : [];
  const subjects = Array.isArray(sem.subjects) ? sem.subjects : [];

  const semStart = sem.startDate ? new Date(parseSemDate(sem.startDate)) : null;
  if (semStart && !isNaN(semStart.getTime())) semStart.setHours(0, 0, 0, 0);
  const validSemStart = semStart && !isNaN(semStart.getTime()) ? semStart : null;

  snapshot.hasSchedule = classes.length > 0;
  snapshot.upcoming = buildUpcoming(classes, now, validSemStart, 6);
  snapshot.today = validSemStart && now < validSemStart ? [] : buildToday(classes, now, 8);
  snapshot.tasks = buildTasks(subjects, now.getTime(), 6);

  const attendance = computeAttendance(sem, now);
  const term = computeTerm(sem, now);
  const grade = computeGrade(sem, ledger?.settings?.gradingSystem || '1_IS_BEST');

  const allTasks = subjects.reduce((count: number, subject: any) => {
    const reqs = Array.isArray(subject?.requirements) ? subject.requirements : [];
    return count + reqs.filter((r: any) => r && r.status !== 'submitted' && r.status !== 'graded').length;
  }, 0);
  const overdue = subjects.reduce((count: number, subject: any) => {
    const reqs = Array.isArray(subject?.requirements) ? subject.requirements : [];
    return (
      count +
      reqs.filter((r: any) => {
        if (!r || r.status === 'submitted' || r.status === 'graded') return false;
        const due = parseDueDate(r.dueDate);
        return Boolean(due && due.getTime() <= now.getTime());
      }).length
    );
  }, 0);

  snapshot.stats = {
    gradeValue: grade.value,
    gradeCaption: grade.caption,
    attendancePct: attendance.pct,
    hasAttendance: attendance.hasData,
    pendingCount: allTasks,
    overdueCount: overdue,
    termPct: term.pct,
    termCaption: term.caption,
    classesToday: snapshot.today.length,
    classesLeftToday: snapshot.today.filter((c) => c.state !== 'past').length,
  };

  return snapshot;
}

/**
 * A representative snapshot for the in-app widget gallery, so the preview shows
 * a full widget rather than whatever the student happens to have scheduled.
 */
export function buildDemoSnapshot(now: Date = new Date()): WidgetSnapshot {
  const snapshot = emptySnapshot(now);
  const make = (
    id: string,
    courseName: string,
    room: string,
    startHour: number,
    duration: number,
    colorIdx: number,
    opts: { isOngoing?: boolean; waitHours?: number } = {}
  ): WidgetClassData => ({
    id,
    courseName,
    room,
    timeStr: formatTimeStr(startHour),
    endTimeStr: formatTimeStr(startHour + duration),
    rangeStr: formatTimeRange(startHour, duration),
    timeRemainingStr: formatCountdown(opts.waitHours ?? 0, Boolean(opts.isOngoing)),
    shortRemainingStr: opts.isOngoing ? '38m left' : `in ${formatShortDuration((opts.waitHours ?? 0) * 60)}`,
    isOngoing: Boolean(opts.isOngoing),
    minutesAway: Math.round((opts.waitHours ?? 0) * 60),
    minutesLeft: opts.isOngoing ? 38 : 0,
    progress: opts.isOngoing ? 0.58 : 0,
    colorIdx,
    dayLabel: snapshot.dayLabel,
    isToday: true,
    startHour,
    duration,
  });

  const ongoing = make('demo-1', 'CSIT 227', 'NGE 108', 7.5, 1.5, 0, { isOngoing: true });
  const next = make('demo-2', 'CSIT 228', 'NGE 205', 10, 1.5, 2, { waitHours: 2.5 });
  const third = make('demo-3', 'MATH 101', 'RM 314', 13, 1, 3, { waitHours: 5.5 });
  const fourth = make('demo-4', 'PHYS 201', 'LAB 2', 15.5, 2, 1, { waitHours: 8 });

  snapshot.hasSchedule = true;
  snapshot.termLabel = '1st Semester';
  snapshot.upcoming = [ongoing, next, third, fourth];
  snapshot.today = [
    { ...make('demo-0', 'ENG 101', 'RM 201', 6, 1, 4), state: 'past' },
    { ...ongoing, state: 'now' },
    { ...next, state: 'next' },
    { ...third, state: 'later' },
    { ...fourth, state: 'later' },
  ];
  snapshot.tasks = [
    { id: 't1', title: 'Case study draft', subjectName: 'CSIT 227', colorIdx: 0, priority: 'high', dueLabel: 'Overdue', urgency: 'overdue', dueAt: now.getTime() - 3600_000 },
    { id: 't2', title: 'Problem set 4', subjectName: 'MATH 101', colorIdx: 3, priority: 'medium', dueLabel: 'Today', urgency: 'today', dueAt: now.getTime() + 6 * 3600_000 },
    { id: 't3', title: 'Lab report', subjectName: 'PHYS 201', colorIdx: 1, priority: 'medium', dueLabel: 'Tomorrow', urgency: 'soon', dueAt: now.getTime() + 30 * 3600_000 },
    { id: 't4', title: 'Reading response', subjectName: 'ENG 101', colorIdx: 4, priority: 'low', dueLabel: '5d left', urgency: 'later', dueAt: now.getTime() + 5 * 24 * 3600_000 },
  ];
  snapshot.stats = {
    gradeValue: '1.75',
    gradeCaption: 'Term GWA',
    attendancePct: 94,
    hasAttendance: true,
    pendingCount: 7,
    overdueCount: 1,
    termPct: 42,
    termCaption: 'Week 7 of 16',
    classesToday: 5,
    classesLeftToday: 4,
  };

  return snapshot;
}
