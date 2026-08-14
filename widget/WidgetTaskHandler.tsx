import React from 'react';
import { Appearance } from 'react-native';
// Cache bust: 20240729
import { requestWidgetUpdate } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FinScholarWidget, WidgetClassData } from './FinScholarWidget';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatTimeStr(startHour: number): string {
  if (typeof startHour !== 'number' || !Number.isFinite(startHour)) return '12:00 AM';
  const totalMins = Math.round(startHour * 60);
  const normalizedMins = ((totalMins % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalizedMins / 60);
  const mins = normalizedMins % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayH = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
  return `${displayH}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

export function formatCountdown(waitHours: number, isOngoing: boolean): string {
  if (isOngoing) return 'In progress';
  if (typeof waitHours !== 'number' || !Number.isFinite(waitHours) || waitHours < 0) return 'In progress';
  const totalMinutes = Math.round(waitHours * 60);
  if (totalMinutes <= 0) return 'In 0m';
  if (totalMinutes < 60) {
    return `In ${totalMinutes}m`;
  }
  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  if (totalHours < 24) {
    return remMinutes > 0 ? `In ${totalHours}h ${remMinutes}m` : `In ${totalHours}h`;
  }
  const dLeft = Math.floor(totalHours / 24);
  return `In ${dLeft} day${dLeft > 1 ? 's' : ''}`;
}

export function isValidClass(cls: any): boolean {
  return Boolean(
    cls &&
    cls.name && typeof cls.name === 'string' && cls.name.trim() !== '' &&
    typeof cls.startHour === 'number' && Number.isFinite(cls.startHour) && cls.startHour >= 0 && cls.startHour < 24 &&
    typeof cls.day === 'number' && Number.isInteger(cls.day) && cls.day >= 0 && cls.day <= 6
  );
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export async function widgetTaskHandler() {
  const isDark = Appearance.getColorScheme() === 'dark';
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

            const semStartDate = currentSem.startDate ? new Date(currentSem.startDate) : null;
            if (semStartDate) semStartDate.setHours(0, 0, 0, 0);
            const isFutureSemester = !!(semStartDate && now < semStartDate);

            // ── Step 1: Find any ongoing class ──────────────────────────────
            let ongoingClass: any = null;
            if (!isFutureSemester) {
                ongoingClass = allClasses.find((cls) => {
                  const duration = typeof cls.duration === 'number' && Number.isFinite(cls.duration) && cls.duration > 0 ? cls.duration : 1;
                  return (
                    cls.day === currentDayIdx &&
                    currentHourFloat >= cls.startHour &&
                    currentHourFloat < cls.startHour + duration
                  );
                });
            }

            if (ongoingClass) {
              widgetClasses.push({
                courseName:      String(ongoingClass.name),
                room:            String(ongoingClass.room || 'TBA'),
                timeStr:         formatTimeStr(ongoingClass.startHour),
                timeRemainingStr: formatCountdown(0, true),
                isOngoing:       true,
              });
            }

            // ── Step 2: Find next upcoming classes ──────────────────────────
            const baseDate = isFutureSemester && semStartDate ? semStartDate : now;
            const baseDayIdx = baseDate.getDay() === 0 ? 6 : baseDate.getDay() - 1;
            const baseHourFloat = isFutureSemester ? 0 : currentHourFloat;

            type ClassWithWait = { cls: any; waitHours: number };
            const upcoming: ClassWithWait[] = [];

            allClasses.forEach((cls) => {
              // Skip the already-found ongoing class
              if (ongoingClass && cls === ongoingClass) return;

              let daysUntil = cls.day - baseDayIdx;

              // If class is today but already finished or is the ongoing class, skip to next week
              const duration = typeof cls.duration === 'number' && Number.isFinite(cls.duration) && cls.duration > 0 ? cls.duration : 1;
              const classEndHour = cls.startHour + duration;

              if (daysUntil === 0) {
                if (baseHourFloat >= classEndHour) {
                  // Class already ended today; consider it next week
                  daysUntil = 7;
                } else if (baseHourFloat >= cls.startHour) {
                  // This is an ongoing class we already handled above
                  return;
                }
                // else: class hasn't started yet today — valid upcoming
              } else if (daysUntil < 0) {
                daysUntil += 7;
              }

              let waitHours = (daysUntil * 24) + (cls.startHour - baseHourFloat);
              
              if (isFutureSemester && semStartDate) {
                  waitHours += (semStartDate.getTime() - now.getTime()) / (1000 * 60 * 60);
              }

              if (waitHours > 0) {
                upcoming.push({ cls, waitHours });
              }
            });

            // Sort by soonest first
            upcoming.sort((a, b) => a.waitHours - b.waitHours);

            // Add up to 4 total classes (1 ongoing + up to 3 upcoming, or up to 4 upcoming)
            const remainingSlots = 4 - widgetClasses.length;
            const upcomingToAdd = upcoming.slice(0, remainingSlots);

            for (const { cls, waitHours } of upcomingToAdd) {
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
      renderWidget: (widgetInfo) => (
        <FinScholarWidget classes={widgetClasses} isDark={isDark} widgetInfo={widgetInfo} />
      ),
    });
  } catch (error) {
    console.error('Error updating widget:', error);
    // On error: render empty fallback so the widget doesn't freeze
    requestWidgetUpdate({
      widgetName: 'FinScholarWidget',
      renderWidget: (widgetInfo) => <FinScholarWidget classes={[]} isDark={isDark} widgetInfo={widgetInfo} />,
    });
  }
}
