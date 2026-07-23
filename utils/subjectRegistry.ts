/**
 * subjectRegistry.ts
 * 
 * Utility functions for the Global Subject Registry.
 * All subjects across Schedule, Grades, and Tasks share the same
 * semester.subjects[] array as the single source of truth.
 * 
 * Subject shape (extended):
 *   id, name, units, passingPercent, periods     — existing grade ledger fields
 *   hasSchedule: boolean                          — NEW: true if linked class blocks exist
 *   gradeTrackingEnabled: boolean                 — NEW: false = excluded from GWA calculations
 */

export interface SubjectRegistryEntry {
    id: string;
    name: string;
    units: number;
    passingPercent: number;
    periods: any[];
    hasSchedule: boolean;
    gradeTrackingEnabled: boolean;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

function getSem(data: any, yearId: string | null, semId: string | null): any | null {
    if (!data || !yearId || !semId) return null;
    const year = data.years?.find((y: any) => y.id === yearId);
    if (!year) return null;
    return year.semesters?.find((s: any) => s.id === semId) ?? null;
}

/**
 * Ensures a subject with the given name exists in the semester's subjects array.
 * Uses case-insensitive matching to prevent duplicates.
 * 
 * @returns The subjectId (existing or newly created)
 */
export function ensureSubjectExists(
    data: any,
    yearId: string | null,
    semId: string | null,
    name: string,
    opts: { fromSchedule?: boolean } = {}
): { data: any; subjectId: string; isNew: boolean } {
    const nd = JSON.parse(JSON.stringify(data)); // deep copy
    const sem = getSem(nd, yearId, semId);
    if (!sem) return { data: nd, subjectId: '', isNew: false };

    if (!sem.subjects) sem.subjects = [];

    const normalizedName = name.trim();
    const existing = sem.subjects.find(
        (s: any) => s.name.trim().toLowerCase() === normalizedName.toLowerCase()
    );

    if (existing) {
        // Apply default flags if they're missing (backwards compat)
        if (existing.gradeTrackingEnabled === undefined) existing.gradeTrackingEnabled = true;
        if (existing.hasSchedule === undefined) existing.hasSchedule = false;
        return { data: nd, subjectId: existing.id, isNew: false };
    }

    // Create new subject
    const newSubject: SubjectRegistryEntry = {
        id: generateId(),
        name: normalizedName,
        units: 3,
        passingPercent: 60,
        periods: [],
        hasSchedule: false,
        // If created from schedule, default grade tracking OFF (user must opt-in)
        // If created from grades, default grade tracking ON
        gradeTrackingEnabled: opts.fromSchedule ? false : true,
    };

    sem.subjects.push(newSubject);
    return { data: nd, subjectId: newSubject.id, isNew: true };
}

/**
 * Updates the hasSchedule flag for a subject based on whether any
 * class blocks in the semester still link to it.
 */
export function refreshHasSchedule(
    data: any,
    yearId: string | null,
    semId: string | null,
    subjectId: string
): any {
    const nd = JSON.parse(JSON.stringify(data));
    const sem = getSem(nd, yearId, semId);
    if (!sem) return nd;

    const subject = sem.subjects?.find((s: any) => s.id === subjectId);
    if (!subject) return nd;

    const linkedClasses = (sem.classes || []).filter(
        (c: any) => c.subjectId === subjectId
    );
    subject.hasSchedule = linkedClasses.length > 0;
    return nd;
}

/**
 * Toggles grade tracking on/off for a subject.
 * When disabled the subject is excluded from GWA calculations.
 */
export function toggleGradeTracking(
    data: any,
    yearId: string | null,
    semId: string | null,
    subjectId: string
): any {
    const nd = JSON.parse(JSON.stringify(data));
    const sem = getSem(nd, yearId, semId);
    if (!sem) return nd;

    const subject = sem.subjects?.find((s: any) => s.id === subjectId);
    if (subject) {
        subject.gradeTrackingEnabled =
            subject.gradeTrackingEnabled === undefined ? false : !subject.gradeTrackingEnabled;
    }
    return nd;
}

/**
 * Returns all subjects for a semester with defaults applied.
 */
export function getSubjectsWithDefaults(sem: any): SubjectRegistryEntry[] {
    if (!sem?.subjects) return [];
    return sem.subjects.map((s: any) => ({
        ...s,
        gradeTrackingEnabled: s.gradeTrackingEnabled !== false, // default true
        hasSchedule: s.hasSchedule === true,
    }));
}

/**
 * Returns subjects that have no schedule linked yet.
 */
export function getUnscheduledSubjects(sem: any): SubjectRegistryEntry[] {
    return getSubjectsWithDefaults(sem).filter(s => !s.hasSchedule);
}

/**
 * Returns subjects where gradeTrackingEnabled is true —
 * these are the ones that should be included in GWA calculations.
 */
export function getTrackedSubjects(sem: any): SubjectRegistryEntry[] {
    return getSubjectsWithDefaults(sem).filter(s => s.gradeTrackingEnabled);
}
