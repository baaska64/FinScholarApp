import React from 'react';
// Cache bust: 12345
import { requestWidgetUpdate } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FinScholarWidget } from './FinScholarWidget';

export async function widgetTaskHandler() {
  try {
    const dataStr = await AsyncStorage.getItem('grade_ledger_v2_data');
    let courseName = undefined;
    let room = undefined;
    let timeStr = undefined;
    let timeRemainingStr = undefined;
    let isOngoingClass = false;

    if (dataStr) {
      const ledgerData = JSON.parse(dataStr);
      if (ledgerData.years) {
        const now = new Date();
        const currentDayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon
        const currentHourFloat = now.getHours() + (now.getMinutes() / 60);

        const activeYearId = await AsyncStorage.getItem('@selectedYear');
        const activeSemId = await AsyncStorage.getItem('@selectedSemester');
        
        let nextClassInfo: any = null;
        let minWaitHours = Infinity;

        const currentYear = ledgerData.years.find((y: any) => activeYearId ? y.id === activeYearId : true);
        if (currentYear) {
          const currentSem = currentYear.semesters.find((s: any) => activeSemId ? s.id === activeSemId : true);
          if (currentSem && currentSem.classes) {
            currentSem.classes.forEach((cls: any) => {
              if (!cls.name || cls.name.trim() === '' || typeof cls.startHour !== 'number' || typeof cls.day !== 'number') {
                return;
              }
              if (cls.day === currentDayIdx && currentHourFloat >= cls.startHour && currentHourFloat < cls.startHour + (cls.duration || 1)) {
                nextClassInfo = cls;
                isOngoingClass = true;
                minWaitHours = 0;
              }
            });

            if (!isOngoingClass) {
              currentSem.classes.forEach((cls: any) => {
                if (!cls.name || cls.name.trim() === '' || typeof cls.startHour !== 'number' || typeof cls.day !== 'number') {
                  return;
                }
                let daysUntil = cls.day - currentDayIdx;
                if (daysUntil < 0 || (daysUntil === 0 && cls.startHour <= currentHourFloat)) {
                  daysUntil += 7; // Next week
                }
                const waitHours = (daysUntil * 24) + (cls.startHour - currentHourFloat);
                if (waitHours > 0 && waitHours < minWaitHours) {
                  minWaitHours = waitHours;
                  nextClassInfo = cls;
                }
              });
            }
          }
        }

        if (nextClassInfo && minWaitHours < 24 * 7) {
          courseName = nextClassInfo.name;
          room = nextClassInfo.room;
          
          const hours = Math.floor(nextClassInfo.startHour);
          const mins = Math.round((nextClassInfo.startHour - hours) * 60);
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const displayH = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
          timeStr = `${displayH}:${mins.toString().padStart(2, '0')} ${ampm}`;

          if (isOngoingClass) {
            timeRemainingStr = "Ongoing";
          } else if (minWaitHours < 24) {
            const hLeft = Math.floor(minWaitHours);
            const mLeft = Math.round((minWaitHours - hLeft) * 60);
            if (hLeft > 0) {
              timeRemainingStr = `In ${hLeft}h ${mLeft}m`;
            } else {
              timeRemainingStr = `In ${mLeft}m`;
            }
          } else {
            const dLeft = Math.floor(minWaitHours / 24);
            timeRemainingStr = `In ${dLeft} day${dLeft > 1 ? 's' : ''}`;
          }
        }
      }
    }

    requestWidgetUpdate({
      widgetName: 'FinScholarWidget',
      renderWidget: () => (
        <FinScholarWidget courseName={courseName} room={room} timeStr={timeStr} timeRemainingStr={timeRemainingStr} isOngoing={isOngoingClass} />
      ),
    });
  } catch (error) {
    console.error('Error updating widget:', error);
  }
}
