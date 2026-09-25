/**
 * Pure logic behind the grades tab's entry flow: weight bookkeeping, walking
 * the period → component → item → sub-item tree, and the "what do I still
 * need?" outlook. Extracted from `ActiveSubjectView` so it can be tested — the
 * screen used to compute all of it inline, once per render, per row.
 *
 * Every mutator here returns a NEW subject. Callers never edit in place, which
 * is what lets a score sheet hold a draft and commit it once on Save instead of
 * pushing the whole ledger to Supabase on every keystroke.
 */
import { Calculator } from '@/utils/calculator';

export const generateId = () => Math.random().toString(36).substr(2, 9);

/** The deepest sub-item level the editor offers. Items are depth 0. */
export const MAX_ITEM_DEPTH = 3;

const isSet = (w: any) => w !== '' && w !== null && w !== undefined;

export interface WeightSummary {
    /** Sum of the weights the student typed. */
    explicit: number;
    /** How many siblings were left blank. */
    blank: number;
    /** What each blank sibling receives: the remainder, split evenly. */
    auto: number;
    /** A human sentence when the weights cannot be right, else null. */
    warning: string | null;
}

/**
 * The rule every level of the tree shares: typed weights count as typed, blank
 * ones split whatever is left of 100 evenly. Mirrors `Calculator` exactly.
 */
export function weightSummary(weights: any[]): WeightSummary {
    let explicit = 0;
    let blank = 0;
    for (const w of weights) {
        if (isSet(w)) explicit += Number(w) || 0;
        else blank++;
    }
    const auto = blank > 0 ? Math.max(0, 100 - explicit) / blank : 0;

    const msgs: string[] = [];
    if (explicit > 100.1) msgs.push(`Weights add up to ${round1(explicit)}%, over 100%`);
    else if (blank === 0 && weights.length > 0 && Math.abs(explicit - 100) > 0.1) msgs.push(`Weights add up to ${round1(explicit)}%, not 100%`);
    else if (blank > 0 && explicit >= 100 - 0.1 && weights.length > blank) msgs.push('Nothing is left for the blank weights');
    if (weights.some((w) => isSet(w) && Number(w) === 0)) msgs.push('A weight is 0%');

    return { explicit, blank, auto, warning: msgs.length ? msgs.join(' · ') : null };
}

/** The weight a node actually carries: its own if typed, else its share of the remainder. */
export function effectiveWeight(weight: any, summary: WeightSummary): number {
    return isSet(weight) ? Number(weight) || 0 : summary.auto;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** "33.3", "25", "100" — no trailing ".0". */
export function formatWeight(n: number): string {
    const r = round1(n);
    return Number.isInteger(r) ? `${r}` : r.toFixed(1);
}

/** The grade in the student's own system, as the list and headers print it. */
export function formatGrade(percent: number, passingPercent: number, system: string): string {
    if (system === 'PERCENT') return `${(Number(percent) || 0).toFixed(1)}%`;
    return Calculator.interpolateGrade(Number(percent) || 0, Number(passingPercent) || 60, system).toFixed(2);
}

// ─── Walking the tree ────────────────────────────────────────────────────────

/**
 * Where a score lives. `items` is the index chain from the component's item
 * list down through `subItems`, so `[2, 0]` is the first part of the third item.
 */
export interface ItemPath {
    period: number;
    component: number;
    items: number[];
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/** The list that holds the node at `path` (the last index is into it). */
function containerOf(subject: any, path: ItemPath): any[] | null {
    let list = subject?.periods?.[path.period]?.components?.[path.component]?.items;
    if (!Array.isArray(list)) return null;
    for (let i = 0; i < path.items.length - 1; i++) {
        list = list[path.items[i]]?.subItems;
        if (!Array.isArray(list)) return null;
    }
    return list;
}

export function getItemAt(subject: any, path: ItemPath): any | null {
    if (!path.items.length) return null;
    const list = containerOf(subject, path);
    return list?.[path.items[path.items.length - 1]] ?? null;
}

/** Siblings of the node at `path`, the node itself included. */
export function siblingsAt(subject: any, path: ItemPath): any[] {
    return containerOf(subject, path) || [];
}

export interface ItemDraft {
    name?: string;
    score?: any;
    max?: any;
    weight?: any;
}

/** Merge `draft` into the node at `path`. */
export function updateItemAt(subject: any, path: ItemPath, draft: ItemDraft): any {
    const next = clone(subject);
    const node = getItemAt(next, path);
    if (!node) return subject;
    Object.assign(node, draft);
    return next;
}

export function removeItemAt(subject: any, path: ItemPath): any {
    const next = clone(subject);
    const list = containerOf(next, path);
    if (!list) return subject;
    list.splice(path.items[path.items.length - 1], 1);
    return next;
}

/**
 * Add a score. With `parentItems` it becomes a part of that item (the item's
 * own score is then computed from its parts); without, a new item in the
 * component. Returns the new subject and where the score landed.
 */
export function addItem(
    subject: any,
    period: number,
    component: number,
    draft: ItemDraft,
    parentItems: number[] | null = null
): { subject: any; path: ItemPath } | null {
    const next = clone(subject);
    const comp = next?.periods?.[period]?.components?.[component];
    if (!comp) return null;
    if (!Array.isArray(comp.items)) comp.items = [];

    let list: any[] = comp.items;
    if (parentItems && parentItems.length) {
        const parent = getItemAt(next, { period, component, items: parentItems });
        if (!parent || parentItems.length > MAX_ITEM_DEPTH) return null;
        if (!Array.isArray(parent.subItems)) parent.subItems = [];
        parent.isCollapsed = false;
        list = parent.subItems;
    }
    list.push({ id: generateId(), name: draft.name ?? '', score: draft.score ?? '', max: draft.max ?? 100, weight: draft.weight ?? '', subItems: [] });
    return { subject: next, path: { period, component, items: [...(parentItems || []), list.length - 1] } };
}

// ─── Periods and components ─────────────────────────────────────────────────

export interface NodeDraft {
    name?: string;
    weight?: any;
}

export function addPeriod(subject: any, draft: NodeDraft): { subject: any; index: number } {
    const next = clone(subject);
    if (!Array.isArray(next.periods)) next.periods = [];
    next.periods.push({ id: generateId(), name: draft.name ?? 'New Period', weight: draft.weight ?? '', components: [] });
    return { subject: next, index: next.periods.length - 1 };
}

export function updatePeriod(subject: any, index: number, draft: NodeDraft): any {
    const next = clone(subject);
    if (!next.periods?.[index]) return subject;
    Object.assign(next.periods[index], draft);
    return next;
}

export function removePeriod(subject: any, index: number): any {
    const next = clone(subject);
    if (!next.periods?.[index]) return subject;
    next.periods.splice(index, 1);
    return next;
}

export function addComponent(subject: any, period: number, draft: NodeDraft): any {
    const next = clone(subject);
    const per = next.periods?.[period];
    if (!per) return subject;
    if (!Array.isArray(per.components)) per.components = [];
    per.components.push({ id: generateId(), name: draft.name ?? 'New Component', weight: draft.weight ?? '', items: [] });
    return next;
}

export function updateComponent(subject: any, period: number, index: number, draft: NodeDraft): any {
    const next = clone(subject);
    const comp = next.periods?.[period]?.components?.[index];
    if (!comp) return subject;
    Object.assign(comp, draft);
    return next;
}

export function removeComponent(subject: any, period: number, index: number): any {
    const next = clone(subject);
    const comps = next.periods?.[period]?.components;
    if (!comps?.[index]) return subject;
    comps.splice(index, 1);
    return next;
}

/** Default name for the next score in a component: "Quiz 3" under "Quizzes". */
export function suggestItemName(componentName: string, existingCount: number): string {
    const base = (componentName || '').trim();
    if (!base || /^new component$/i.test(base)) return `Item ${existingCount + 1}`;
    let singular = base;
    if (/ies$/i.test(base)) singular = base.slice(0, -3) + 'y';
    else if (/sses$/i.test(base)) singular = base.slice(0, -2);
    else if (/(ss|us|is)$/i.test(base)) singular = base;
    else if (/zzes$/i.test(base)) singular = base.slice(0, -3);
    else if (/(ches|shes|xes)$/i.test(base)) singular = base.slice(0, -2);
    else if (/s$/i.test(base)) singular = base.slice(0, -1);
    return `${singular} ${existingCount + 1}`;
}

// ─── Scores ──────────────────────────────────────────────────────────────────

/** Percent (0-100) for a typed score and max, or null when either is unusable. */
export function scorePercent(score: any, max: any): number | null {
    if (!isSet(score)) return null;
    const s = Number(score);
    const m = Number(max);
    if (!Number.isFinite(s) || !Number.isFinite(m) || m <= 0) return null;
    return (s / m) * 100;
}

/**
 * What is wrong with a typed score, if anything. Blocking problems stop a save;
 * a score above the max only warns, because extra credit is real.
 */
export function scoreProblem(score: any, max: any): { message: string; blocking: boolean } | null {
    const m = Number(max);
    if (!isSet(max) || !Number.isFinite(m) || m <= 0) return { message: 'Out of must be more than 0', blocking: true };
    if (!isSet(score)) return null;
    const s = Number(score);
    if (!Number.isFinite(s)) return { message: 'Score must be a number', blocking: true };
    if (s < 0) return { message: 'Score cannot be negative', blocking: true };
    if (s > m) return { message: 'Above the maximum. Fine for extra credit.', blocking: false };
    return null;
}

/** A typed weight must be a number from 0 to 100; blank is fine (auto). */
export function weightProblem(weight: any): string | null {
    if (!isSet(weight)) return null;
    const w = Number(weight);
    if (!Number.isFinite(w)) return 'Weight must be a number';
    if (w < 0 || w > 100) return 'Weight must be between 0 and 100';
    return null;
}

/** How many leaf scores a node holds, and how many of them are filled in. */
export function countScores(node: any): { filled: number; total: number } {
    if (node?.subItems?.length) {
        return node.subItems.reduce(
            (acc: { filled: number; total: number }, si: any) => {
                const c = countScores(si);
                return { filled: acc.filled + c.filled, total: acc.total + c.total };
            },
            { filled: 0, total: 0 }
        );
    }
    return { filled: isSet(node?.score) ? 1 : 0, total: 1 };
}

// ─── Outlook: what the student still needs ───────────────────────────────────

export type OutlookKind = 'reached' | 'on-course' | 'pass-only' | 'passed-only' | 'lost' | 'no-room';

export interface Outlook {
    kind: OutlookKind;
    /** The target in play, as a percent. */
    target: number;
    /** Headline figure: the average needed on everything ungraded, 0-100, or null when none applies. */
    requiredAverage: number | null;
    /** What that average buys. */
    requiredFor: 'target' | 'pass' | null;
    message: string;
    /** Ungraded scores and what each needs, in tree order. */
    remaining: { id: string; name: string; periodName: string; sumMax: number; needed: number }[];
}

/**
 * The question the subject screen exists to answer. Same arithmetic as the old
 * inline block — points earned so far against the weight still ungraded — but
 * the headline is now the average the student needs on what's left, which is
 * the number they can actually aim at.
 */
export function subjectOutlook(subject: any, system: string): Outlook {
    const res = Calculator.calculateSubject(subject, system);
    const pass = Number(subject?.passingPercent) || 60;
    const target = Number(subject?.targetValue) || pass;
    const earned = res.absoluteEarned;
    const room = res.absoluteAvailable;
    const needed = target - earned;
    const passNeeded = pass - earned;

    const list = (pct: number) =>
        (res.emptyComponents || []).map((c: any) => ({ id: c.id, name: c.name, periodName: c.periodName, sumMax: c.sumMax, needed: pct * c.sumMax }));

    if (needed <= 0) {
        return { kind: 'reached', target, requiredAverage: null, requiredFor: null, message: `You have reached your ${round1(target)}% target.`, remaining: [] };
    }
    if (room <= 0) {
        return {
            kind: 'no-room', target, requiredAverage: null, requiredFor: null,
            message: passNeeded <= 0 ? 'Every score is in. You passed, short of your target.' : 'Every score is in, and the target was not reached.',
            remaining: [],
        };
    }
    if (needed <= room) {
        const pct = needed / room;
        return {
            kind: 'on-course', target, requiredAverage: pct * 100, requiredFor: 'target',
            message: `Average ${round1(pct * 100)}% on what's left to reach ${round1(target)}%.`,
            remaining: list(pct),
        };
    }
    if (passNeeded <= 0) {
        return { kind: 'passed-only', target, requiredAverage: null, requiredFor: null, message: `${round1(target)}% is out of reach, but you have already passed.`, remaining: [] };
    }
    if (passNeeded <= room) {
        const pct = passNeeded / room;
        return {
            kind: 'pass-only', target, requiredAverage: pct * 100, requiredFor: 'pass',
            message: `${round1(target)}% is out of reach. Average ${round1(pct * 100)}% on what's left to pass.`,
            remaining: list(pct),
        };
    }
    return { kind: 'lost', target, requiredAverage: null, requiredFor: null, message: 'Passing is no longer possible with the scores left.', remaining: [] };
}

export interface ItemLocation {
    path: ItemPath;
    /** The score's own name, falling back to its position. */
    name: string;
    periodName: string;
    componentName: string;
    /** Names of the scores it is a part of, outermost first. */
    parents: string[];
}

/**
 * Find a score by id. The outlook only carries ids and a flattened label, and
 * a "what each needs" row has to open that exact score's sheet.
 */
export function locateItem(subject: any, id: string): ItemLocation | null {
    const periods = subject?.periods || [];
    for (let p = 0; p < periods.length; p++) {
        const comps = periods[p]?.components || [];
        for (let c = 0; c < comps.length; c++) {
            const walk = (list: any[], trail: number[], parents: string[]): ItemLocation | null => {
                for (let i = 0; i < list.length; i++) {
                    const node = list[i];
                    const depth = trail.length;
                    const name = node?.name || (depth === 0 ? `Item ${i + 1}` : `Part ${i + 1}`);
                    if (node?.id === id) {
                        return {
                            path: { period: p, component: c, items: [...trail, i] },
                            name,
                            periodName: periods[p]?.name || 'Period',
                            componentName: comps[c]?.name || 'Component',
                            parents,
                        };
                    }
                    if (node?.subItems?.length) {
                        const hit = walk(node.subItems, [...trail, i], [...parents, name]);
                        if (hit) return hit;
                    }
                }
                return null;
            };
            const hit = walk(comps[c]?.items || [], [], []);
            if (hit) return hit;
        }
    }
    return null;
}
