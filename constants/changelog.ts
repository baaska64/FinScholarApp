/**
 * Release notes, newest first.
 *
 * The changelog used to be a JSX list inside the modal, which meant it silently
 * went stale — the app shipped 1.0.7 still telling people about flashcard
 * features from two releases earlier. Keeping it as data means updating it is a
 * one-place edit next to the version bump, and it lets the modal show history
 * rather than only the release the user happens to have landed on.
 *
 * `tint` is a key into `Tints` (constants/Theme.ts) so an entry is colour-coded
 * by the area of the app it touches, the same code the rest of the UI uses.
 */

import type { TintName } from './Theme';

export interface ChangelogItem {
  /** Ionicons name. */
  icon: string;
  tint: TintName;
  title: string;
  desc: string;
}

export interface ChangelogEntry {
  version: string;
  /** Shown next to the version. Keep it human: "September 2026". */
  date: string;
  /** One line answering "why should I care about this release?" */
  headline: string;
  items: ChangelogItem[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.1.0',
    date: 'September 2026',
    headline: 'Five home screen widgets, rebuilt from scratch.',
    items: [
      {
        icon: 'albums',
        tint: 'schedule',
        title: 'A widget family, not one widget',
        desc: 'Up Next, Today, Deadlines, Next Class and Semester Pulse — add whichever ones suit you.',
      },
      {
        icon: 'color-palette',
        tint: 'grades',
        title: 'Redesigned to match the app',
        desc: 'Classes keep their timetable colour, and widgets follow your light or dark theme.',
      },
      {
        icon: 'resize',
        tint: 'tools',
        title: 'Resize them however you like',
        desc: 'Every widget re-lays itself out as you drag it, at any size.',
      },
      {
        icon: 'open-outline',
        tint: 'attendance',
        title: 'Tapping one takes you somewhere useful',
        desc: 'Each one opens the screen it is about, not wherever you left the app.',
      },
      {
        icon: 'bug',
        tint: 'danger',
        title: 'Fixes',
        desc: 'Fixed a dashboard crash, and sign-in errors now explain themselves.',
      },
    ],
  },
  {
    version: '1.0.7',
    date: 'August 2026',
    headline: 'Direct manipulation on the timetable.',
    items: [
      {
        icon: 'move',
        tint: 'schedule',
        title: 'Drag your classes',
        desc: 'Press and hold a block in Quick Edit to move it; drag its edge to resize.',
      },
      {
        icon: 'arrow-undo',
        tint: 'tools',
        title: 'One-step undo',
        desc: 'Every drag, resize and bulk nudge can be taken back while Quick Edit is open.',
      },
    ],
  },
  {
    version: '1.0.5',
    date: 'July 2026',
    headline: 'Study tools got serious.',
    items: [
      {
        icon: 'albums',
        tint: 'grades',
        title: 'Flash Study overhaul',
        desc: 'A redesigned dashboard for your decks, with SM-2 scheduling and daily review goals.',
      },
      {
        icon: 'trophy',
        tint: 'tasks',
        title: 'Streaks and XP',
        desc: 'Earn XP and keep a daily streak alive by reviewing your flashcards.',
      },
      {
        icon: 'game-controller',
        tint: 'attendance',
        title: 'Speed Match',
        desc: 'Race the clock in a mini-game built from any of your decks.',
      },
    ],
  },
];

export const LATEST_RELEASE: ChangelogEntry = CHANGELOG[0];

/** The entry matching a version string, or the newest one if it is not listed. */
export function releaseFor(version: string): ChangelogEntry {
  return CHANGELOG.find((entry) => entry.version === version) ?? LATEST_RELEASE;
}
