import React from 'react';
// Cache bust: 20240729
import { requestWidgetUpdate } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FinScholarWidget, WidgetClassData } from './FinScholarWidget';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimeStr(startHour: number): string {
  const hours = Math.floor(startHour);
  const mins  = Math.round((startHour - hours) * 60);
  const ampm  = hours >= 12 ? 'PM' : 'AM';
  const displayH = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
  return `${displayH}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

function formatCountdown(waitHours: number, isOngoing: boolean): string {
  if (isOngoing) return 'In progress';
  if (waitHours < 1) {
    const mLeft = Math.round(waitHours * 60);
    return `In ${mLeft}m`;
  }
  if (waitHours < 24) {
    const hLeft = Math.floor(waitHours);
    const mLeft = Math.round((waitHours - hLeft) * 60);
    return mLeft > 0 ? `In ${hLeft}h ${mLeft}m` : `In ${hLeft}h`;
  }
  const dLeft = Math.floor(waitHours / 24);
  return `In ${dLeft} day${dLeft > 1 ? 's' : ''}`;
}

function isValidClass(cls: any): boolean {
  return (
    cls &&
    cls.name && typeof cls.name === 'string' && cls.name.trim() !== '' &&
    typeof cls.startHour === 'number' &&
    typeof cls.day === 'number'
  );
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export async function widgetTaskHandler() {
  try {
    const dataStr = await AsyncStorage.getItem('grade_ledger_v2_data');

    let widgetClasses: WidgetClassData[] = [];

    if (dataStr) {
      const ledgerData = JSON.parse(dataStr);

      if (ledgerData.years) {
        const now              = new Date();
        const currentDayIdx    = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon…6=Sun
        const currentHourFloat = now.getHours() + (now.getMinutes() / 60);

        const activeYearId = await AsyncStorage.getItem('@selectedYear');
        const activeSemId  = await AsyncStorage.getItem('@selectedSemester');

        const currentYear = ledgerData.years.find((y: any) =>
          activeYearId ? y.id === activeYearId : true
        );

        if (currentYear) {
          const currentSem = currentYear.semesters.find((s: any) =>
            activeSemId ? s.id === activeSemId : true
          );

          if (currentSem && currentSem.classes) {
            const allClasses: any[] = currentSem.classes.filter(isValidClass);

            // ── Step 1: Find any ongoing class ──────────────────────────────
            const ongoingClass = allClasses.find((cls) => {
              const duration = typeof cls.duration === 'number' ? cls.duration : 1;
              return (
                cls.day === currentDayIdx &&
                currentHourFloat >= cls.startHour &&
                currentHourFloat < cls.startHour + duration
              );
            });

            if (ongoingClass) {
              widgetClasses.push({
                courseName:      String(ongoingClass.name),
                room:            String(ongoingClass.room || 'TBA'),
                timeStr:         formatTimeStr(ongoingClass.startHour),
                timeRemainingStr: formatCountdown(0, true),
                isOngoing:       true,
              });
            }

            // ── Step 2: Find next upcoming class ────────────────────────────
            // If today still has classes that haven't started yet, prefer those.
            // If today is over (no remaining classes), look at the next day(s).
            type ClassWithWait = { cls: any; waitHours: number };
            const upcoming: ClassWithWait[] = [];

            allClasses.forEach((cls) => {
              // Skip the already-found ongoing class
              if (ongoingClass && cls === ongoingClass) return;

              let daysUntil = cls.day - currentDayIdx;

              // If class is today but already finished or is the ongoing class, skip to next week
              const duration = typeof cls.duration === 'number' ? cls.duration : 1;
              const classEndHour = cls.startHour + duration;

              if (daysUntil === 0) {
                if (currentHourFloat >= classEndHour) {
                  // Class already ended today; consider it next week
                  daysUntil = 7;
                } else if (currentHourFloat >= cls.startHour) {
                  // This is an ongoing class we already handled above
                  return;
                }
                // else: class hasn't started yet today — valid upcoming
              } else if (daysUntil < 0) {
                daysUntil += 7;
              }

              const waitHours = (daysUntil * 24) + (cls.startHour - currentHourFloat);
              if (waitHours > 0) {
                upcoming.push({ cls, waitHours });
              }
            });

            // Sort by soonest first
            upcoming.sort((a, b) => a.waitHours - b.waitHours);

            // Add the next upcoming class to the widget
            if (upcoming.length > 0) {
              const { cls, waitHours } = upcoming[0];
              widgetClasses.push({
                courseName:      String(cls.name),
                room:            String(cls.room || 'TBA'),
                timeStr:         formatTimeStr(cls.startHour),
                timeRemainingStr: formatCountdown(waitHours, false),
                isOngoing:       false,
              });
            }
          }
        }
      }
    }

    requestWidgetUpdate({
      widgetName: 'FinScholarWidget',
      renderWidget: () => (
        <FinScholarWidget classes={widgetClasses} />
      ),
    });
  } catch (error) {
    console.error('Error updating widget:', error);
    // On error: render empty fallback so the widget doesn't freeze
    requestWidgetUpdate({
      widgetName: 'FinScholarWidget',
      renderWidget: () => <FinScholarWidget classes={[]} />,
    });
  }
}
