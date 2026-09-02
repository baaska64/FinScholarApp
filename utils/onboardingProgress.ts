/**
 * onboardingProgress.ts
 *
 * Pure helpers behind the first-run experience: what the student still has to
 * set up, and how a brand new term is grafted onto the existing ledger.
 * Kept free of React and react-native so they stay directly testable.
 */

export interface OnboardingProgress {
    hasTerm: boolean;
    hasSubjects: boolean;
    hasClasses: boolean;
    hasTasks: boolean;
}

const defaultGenerateId = () => Math.random().toString(36).substr(2, 9);

/**
 * Academic years run across the calendar boundary, so a student opening the
 * app in September belongs to "2025 - 2026", not "2024 - 2025". June is used
 * as the cut-over because that is when most PH school years begin.
 */
export function suggestSchoolYear(now: Date = new Date()): string {
    const startYear = now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear} - ${startYear + 1}`;
}

/** Formats a Date as the YYYY-MM-DD the ledger stores, in local time. */
export function toLedgerDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Which setup milestones the student has already reached in the active term.
 * Tolerates a missing/partial ledger — every field falls back to false.
 */
export function deriveOnboardingProgress(
    data: any,
    activeYearId: string | null,
    activeSemId: string | null
): OnboardingProgress {
    const hasTerm = Array.isArray(data?.years) && data.years.length > 0;
    const year = Array.isArray(data?.years)
        ? data.years.find((y: any) => y?.id === activeYearId)
        : undefined;
    const sem = Array.isArray(year?.semesters)
        ? year.semesters.find((s: any) => s?.id === activeSemId)
        : undefined;
    const subjects: any[] = Array.isArray(sem?.subjects) ? sem.subjects : [];

    return {
        hasTerm,
        hasSubjects: subjects.length > 0,
        hasClasses: Array.isArray(sem?.classes) && sem.classes.length > 0,
        hasTasks: subjects.some((s: any) => Array.isArray(s?.requirements) && s.requirements.length > 0),
    };
}

export interface CreateTermOptions {
    startDate?: string | null;
    endDate?: string | null;
    generateId?: () => string;
}

export interface CreateTermResult {
    data: any;
    yearId: string;
    semId: string;
    createdYear: boolean;
    createdSemester: boolean;
}

/**
 * Adds a year/semester pair to the ledger without touching anything else.
 * Names are matched case-insensitively so running setup twice tops up the
 * existing term instead of creating a confusing duplicate.
 */
export function createTermInLedger(
    data: any,
    yearName: string,
    semName: string,
    opts: CreateTermOptions = {}
): CreateTermResult {
    const generateId = opts.generateId || defaultGenerateId;
    const trimmedYear = (yearName || '').trim();
    const trimmedSem = (semName || '').trim();
    if (!trimmedYear || !trimmedSem) {
        throw new Error('Both a school year and a term name are required.');
    }

    const source = data && typeof data === 'object' ? data : {};
    const newData: any = { ...source, years: Array.isArray(source.years) ? [...source.years] : [] };

    let year = newData.years.find(
        (y: any) => (y?.name || '').trim().toLowerCase() === trimmedYear.toLowerCase()
    );
    const createdYear = !year;
    if (!year) {
        year = { id: generateId(), name: trimmedYear, semesters: [] };
        newData.years.push(year);
    }
    if (!Array.isArray(year.semesters)) year.semesters = [];

    let sem = year.semesters.find(
        (s: any) => (s?.name || '').trim().toLowerCase() === trimmedSem.toLowerCase()
    );
    const createdSemester = !sem;
    if (!sem) {
        sem = { id: generateId(), name: trimmedSem, subjects: [], classes: [], milestones: [] };
        year.semesters.push(sem);
    }

    if (opts.startDate) sem.startDate = opts.startDate;
    if (opts.endDate) sem.endDate = opts.endDate;

    return { data: newData, yearId: year.id, semId: sem.id, createdYear, createdSemester };
}
