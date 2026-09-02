import type { SpotlightStep } from '@/components/spotlight/types';

/**
 * Ids shared between the controls that register themselves as spotlight
 * targets and the tour steps that point at them. Keeping them in one place
 * means a renamed control fails loudly in review rather than silently
 * degrading to an unanchored step.
 */
export const SPOTLIGHT_IDS = {
    homeTerm: 'home.term',
    homeSettings: 'home.settings',
    tabGrades: 'tab.grades',
    tabSchedule: 'tab.schedule',
    tabCalendar: 'tab.calendar',
    tabTasks: 'tab.requirements',
    tabStudy: 'tab.flashcards',
    gradesAddSubject: 'grades.addSubject',
    scheduleAddClass: 'schedule.addClass',
    calendarImport: 'calendar.import',
    tasksAdd: 'tasks.add',
    studyCreateDeck: 'study.createDeck',
} as const;

export const TOUR_KEYS = {
    main: 'main',
    grades: 'grades',
    schedule: 'schedule',
    calendar: 'calendar',
    tasks: 'tasks',
    study: 'study',
} as const;

export type TourKey = (typeof TOUR_KEYS)[keyof typeof TOUR_KEYS];

/** Every tour key, used to mark existing installs as already toured. */
export const ALL_TOUR_KEYS: string[] = Object.values(TOUR_KEYS);

/**
 * The welcome tour. Every target lives on the dashboard or the tab bar, both
 * of which are mounted together, so the tour never has to navigate mid-flight.
 */
export const MAIN_TOUR: SpotlightStep[] = [
    {
        id: 'term',
        targetId: SPOTLIGHT_IDS.homeTerm,
        icon: 'calendar',
        shape: 'pill',
        title: 'Start with your term',
        body: 'Every subject, class, grade and task belongs to a term. Tap here to create one or switch between them.',
    },
    {
        id: 'grades',
        targetId: SPOTLIGHT_IDS.tabGrades,
        icon: 'school',
        title: 'Grades live here',
        body: 'Add your subjects with their units, then log scores. Your GWA updates as you go.',
    },
    {
        id: 'schedule',
        targetId: SPOTLIGHT_IDS.tabSchedule,
        icon: 'time',
        title: 'Your class schedule',
        body: 'Scan a photo of your printed timetable or add classes by hand. Today’s classes show on the dashboard and your home screen widget.',
    },
    {
        id: 'calendar',
        targetId: SPOTLIGHT_IDS.tabCalendar,
        icon: 'calendar-outline',
        title: 'School calendar',
        body: 'Exam weeks, holidays and school events — scan the academic calendar or add dates yourself.',
    },
    {
        id: 'tasks',
        targetId: SPOTLIGHT_IDS.tabTasks,
        icon: 'list',
        title: 'Assignments and exams',
        body: 'Track what is due. The dashboard surfaces whatever is most urgent so nothing sneaks up on you.',
    },
    {
        id: 'study',
        targetId: SPOTLIGHT_IDS.tabStudy,
        icon: 'layers',
        title: 'Study with flashcards',
        body: 'Build decks per subject and review daily to keep your streak alive.',
    },
    {
        id: 'settings',
        targetId: SPOTLIGHT_IDS.homeSettings,
        icon: 'settings-outline',
        shape: 'circle',
        title: 'Everything else is in here',
        body: 'Dark mode, the home screen widget, study options — and you can replay this tour any time.',
    },
];

/**
 * One-step nudges shown the first time a student opens each tab, pointing at
 * the action that actually gets them started on that screen.
 */
export const GRADES_TOUR: SpotlightStep[] = [
    {
        id: 'add-subject',
        targetId: SPOTLIGHT_IDS.gradesAddSubject,
        icon: 'add-circle',
        shape: 'pill',
        title: 'Add your subjects',
        body: 'Give each subject its units and passing mark. Only subjects you track are counted in your GWA.',
    },
];

export const SCHEDULE_TOUR: SpotlightStep[] = [
    {
        id: 'add-class',
        targetId: SPOTLIGHT_IDS.scheduleAddClass,
        icon: 'sparkles',
        title: 'Fill your timetable fast',
        body: 'Scan a photo of your printed schedule, or add each class by hand. Subjects you already added are reused automatically.',
    },
];

export const CALENDAR_TOUR: SpotlightStep[] = [
    {
        id: 'import-calendar',
        targetId: SPOTLIGHT_IDS.calendarImport,
        icon: 'sparkles',
        shape: 'circle',
        title: 'Import your school calendar',
        body: 'Scan the academic calendar your school published and Fin will pull out enrollment, deadlines and exam weeks for you.',
    },
];

export const TASKS_TOUR: SpotlightStep[] = [
    {
        id: 'add-task',
        targetId: SPOTLIGHT_IDS.tasksAdd,
        icon: 'add',
        title: 'Add your first task',
        body: 'Give it a due date and a priority. Anything urgent is pulled onto your dashboard automatically.',
    },
];

export const STUDY_TOUR: SpotlightStep[] = [
    {
        id: 'create-deck',
        targetId: SPOTLIGHT_IDS.studyCreateDeck,
        icon: 'albums',
        title: 'Make your first deck',
        body: 'Create a deck per subject, add cards, then review daily to build your streak.',
    },
];

export const SCREEN_TOURS: Record<string, SpotlightStep[]> = {
    [TOUR_KEYS.grades]: GRADES_TOUR,
    [TOUR_KEYS.schedule]: SCHEDULE_TOUR,
    [TOUR_KEYS.calendar]: CALENDAR_TOUR,
    [TOUR_KEYS.tasks]: TASKS_TOUR,
    [TOUR_KEYS.study]: STUDY_TOUR,
};
