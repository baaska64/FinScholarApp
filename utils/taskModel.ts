import type { SortOption, StatusFilterOption, TaskItem, TaskPriority } from '@/components/tasks/types';
import { parseDueDate } from '@/components/tasks/utils';

/**
 * Everything the tasks tab computes, with no React in it.
 *
 * The screen used to group tasks by **status** — Pending, Submitted, Graded —
 * which is an administrative axis, not the one a student thinks in. Three
 * headings always rendered, so a term with one submitted task showed two empty
 * sections with placeholder cards. Tasks are grouped by **when they are due**
 * here instead, and only non-empty groups exist at all.
 */

// ─── Buckets ──────────────────────────────────────────────────────────────────

export type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none';

export interface TaskGroup {
    key: DueBucket;
    label: string;
    tasks: TaskItem[];
}

/** Display order. A group missing from the data is simply not rendered. */
export const BUCKET_ORDER: DueBucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'none'];

export const BUCKET_LABELS: Record<DueBucket, string> = {
    overdue: 'Overdue',
    today: 'Due today',
    tomorrow: 'Tomorrow',
    week: 'This week',
    later: 'Later',
    none: 'No due date',
};

/** A task is finished once it leaves `pending`; both states read as done. */
export function isDone(task: TaskItem): boolean {
    return task.status === 'submitted' || task.status === 'graded';
}

function startOfDayMs(ms: number): number {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Which bucket an unfinished task falls into.
 *
 * "Overdue" is measured against the **instant**, because a task due at 11:59pm
 * is not overdue at 9pm on the same day. Every other boundary is measured
 * against the **calendar day**, because "tomorrow" has to mean tomorrow no
 * matter what time of day the student is looking.
 */
export function getDueBucket(task: TaskItem, nowMs: number = Date.now()): DueBucket {
    const due = parseDueDate(task.dueDate);
    if (!due) return 'none';

    const dueMs = due.getTime();
    if (dueMs <= nowMs) return 'overdue';

    const today = startOfDayMs(nowMs);
    const dueDay = startOfDayMs(dueMs);
    const daysAway = Math.round((dueDay - today) / 86400000);

    if (daysAway <= 0) return 'today';
    if (daysAway === 1) return 'tomorrow';
    if (daysAway <= 7) return 'week';
    return 'later';
}

/**
 * Unfinished tasks, bucketed and ordered. Finished ones are excluded — they
 * belong in the collapsed Done section, not scattered through the timeline.
 */
export function groupTasksByDue(tasks: TaskItem[], nowMs: number = Date.now()): TaskGroup[] {
    const buckets = new Map<DueBucket, TaskItem[]>();

    tasks.forEach(task => {
        if (isDone(task)) return;
        const key = getDueBucket(task, nowMs);
        const list = buckets.get(key);
        if (list) list.push(task);
        else buckets.set(key, [task]);
    });

    return BUCKET_ORDER.filter(key => (buckets.get(key)?.length ?? 0) > 0).map(key => ({
        key,
        label: BUCKET_LABELS[key],
        tasks: buckets.get(key)!,
    }));
}

/** Done tasks, most recently due first — the ones just finished sit on top. */
export function doneTasks(tasks: TaskItem[]): TaskItem[] {
    return tasks
        .filter(isDone)
        .sort((a, b) => {
            const ta = parseDueDate(a.dueDate)?.getTime() ?? 0;
            const tb = parseDueDate(b.dueDate)?.getTime() ?? 0;
            return tb - ta;
        });
}

// ─── Counts ───────────────────────────────────────────────────────────────────

export interface TaskCounts {
    total: number;
    pending: number;
    submitted: number;
    graded: number;
    overdue: number;
    dueToday: number;
    /** Submitted + graded, as a 0–100 integer. 0 when there are no tasks. */
    completionPercent: number;
}

export function getTaskCounts(tasks: TaskItem[], nowMs: number = Date.now()): TaskCounts {
    let pending = 0;
    let submitted = 0;
    let graded = 0;
    let overdue = 0;
    let dueToday = 0;

    tasks.forEach(task => {
        if (task.status === 'submitted') submitted++;
        else if (task.status === 'graded') graded++;
        else pending++;

        if (task.status !== 'pending') return;
        const bucket = getDueBucket(task, nowMs);
        if (bucket === 'overdue') overdue++;
        else if (bucket === 'today') dueToday++;
    });

    const total = tasks.length;
    const done = submitted + graded;

    return {
        total,
        pending,
        submitted,
        graded,
        overdue,
        dueToday,
        completionPercent: total > 0 ? Math.round((done / total) * 100) : 0,
    };
}

// ─── The digest line ──────────────────────────────────────────────────────────

export type DigestTone = 'danger' | 'warning' | 'ok' | 'neutral';

export interface Digest {
    headline: string;
    tone: DigestTone;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * One line for the strip under the app bar. It states the single most urgent
 * fact rather than four counts — the old overview card showed Total, Pending,
 * Submitted and Graded as equal-weight tiles, so nothing stood out and the
 * number that mattered (overdue) had to be found.
 */
export function getDigest(counts: TaskCounts): Digest {
    if (counts.total === 0) return { headline: 'No tasks yet', tone: 'neutral' };
    if (counts.overdue > 0) return { headline: `${plural(counts.overdue, 'task', 'tasks')} overdue`, tone: 'danger' };
    if (counts.dueToday > 0) return { headline: `${plural(counts.dueToday, 'task', 'tasks')} due today`, tone: 'warning' };
    if (counts.pending > 0) return { headline: `${plural(counts.pending, 'task', 'tasks')} to go`, tone: 'ok' };
    return { headline: 'All caught up', tone: 'ok' };
}

// ─── Filtering and sorting ────────────────────────────────────────────────────

export interface TaskFilter {
    /** Case-insensitive substring over title, description and subject. */
    query?: string;
    /** `'ALL'` or a subject id. */
    subjectId?: string;
    status?: StatusFilterOption;
}

export function filterTasks(
    tasks: TaskItem[],
    filter: TaskFilter = {},
    nowMs: number = Date.now(),
): TaskItem[] {
    const { query = '', subjectId = 'ALL', status = 'all' } = filter;
    const needle = query.trim().toLowerCase();

    return tasks.filter(task => {
        if (subjectId !== 'ALL' && task.subjectId !== subjectId) return false;

        if (status === 'overdue') {
            if (task.status !== 'pending' || getDueBucket(task, nowMs) !== 'overdue') return false;
        } else if (status !== 'all' && task.status !== status) {
            return false;
        }

        if (!needle) return true;
        const haystack = `${task.title} ${task.description || ''} ${task.subjectName || ''}`.toLowerCase();
        return haystack.includes(needle);
    });
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
const STATUS_RANK: Record<string, number> = { pending: 0, submitted: 1, graded: 2 };

/** Returns a new array; the caller's list is never reordered in place. */
export function sortTasks(tasks: TaskItem[], sort: SortOption): TaskItem[] {
    const byDueDate = (a: TaskItem, b: TaskItem) => {
        // Undated tasks sink rather than sorting as 1970.
        const ta = parseDueDate(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const tb = parseDueDate(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return ta - tb;
    };

    return [...tasks].sort((a, b) => {
        if (sort === 'priority') {
            const diff = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
            // Same priority still reads chronologically — a flat alphabetical
            // tail inside each band is not an ordering a student can use.
            return diff !== 0 ? diff : byDueDate(a, b);
        }
        if (sort === 'title') return a.title.localeCompare(b.title);
        if (sort === 'status') {
            const diff = (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0);
            return diff !== 0 ? diff : byDueDate(a, b);
        }
        return byDueDate(a, b);
    });
}

// ─── Checklist ────────────────────────────────────────────────────────────────

/** `{ done, total }` for a task's subtasks. Absent checklists read as 0 of 0. */
export function checklistProgress(task: TaskItem): { done: number; total: number } {
    const list = Array.isArray(task.checklist) ? task.checklist : [];
    return { done: list.filter(i => i.completed).length, total: list.length };
}
