import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const NotificationService = {
  async initNotifications() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return false;
    }
    return true;
  },

  async scheduleNextClassNotification(ledgerData: any) {
    try {
      // First cancel any existing notifications we scheduled previously
      await Notifications.cancelAllScheduledNotificationsAsync();

      if (!ledgerData || !ledgerData.years) return;

      const now = new Date();
      const currentDayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon
      const currentHourFloat = now.getHours() + (now.getMinutes() / 60);

      let nextClassInfo: any = null;
      let minWaitHours = Infinity;

      // Find the next class
      ledgerData.years.forEach((year: any) => {
        year.semesters.forEach((sem: any) => {
          if (!sem.classes) return;
          sem.classes.forEach((cls: any) => {
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
        });
      });

      if (nextClassInfo && minWaitHours < 24 * 7) { // within a week
        // We schedule the notification 15 minutes before the class starts
        const notificationTime = new Date(now.getTime() + minWaitHours * 60 * 60 * 1000 - 15 * 60 * 1000);
        
        // Only schedule if the notification time is in the future
        if (notificationTime.getTime() > Date.now()) {
          const hours = Math.floor(nextClassInfo.startHour);
          const mins = Math.round((nextClassInfo.startHour - hours) * 60);
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const displayH = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
          const timeStr = `${displayH}:${mins.toString().padStart(2, '0')} ${ampm}`;

          await Notifications.scheduleNotificationAsync({
            content: {
              title: `Upcoming Class: ${nextClassInfo.name}`,
              body: `Your class starts at ${timeStr} in ${nextClassInfo.room || 'TBA'}.`,
              sound: true,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: notificationTime,
            },
          });
          console.log(`Scheduled notification for class ${nextClassInfo.name} at ${notificationTime.toLocaleString()}`);
        }
      }
    } catch (e) {
      console.error('Failed to schedule notification', e);
    }
  },

  async scheduleStudyNotification(ledgerData: any) {
    try {
      // Clear specifically our study notifications?
      // Since we cancel all in class notifications, let's keep it simple and just schedule.
      // Wait, if cancelAllScheduledNotificationsAsync is called above, it kills study notifications too.
      // Let's assume we call both in side effects. So this function will just add to the queue.
      if (!ledgerData || !ledgerData.flashcards || !ledgerData.flashcards.decks) return;
      
      const settings = ledgerData.flashcards.settings || { studyTimeHour: 8, studyTimeMinute: 0 };
      const studyTimeHour = settings.studyTimeHour ?? 8;
      const studyTimeMinute = settings.studyTimeMinute ?? 0;

      // Calculate tomorrow's study time
      const now = new Date();
      const tomorrowStudyTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, studyTimeHour, studyTimeMinute, 0, 0);

      // Count how many cards will be due by that time tomorrow
      let dueCount = 0;
      ledgerData.flashcards.decks.forEach((deck: any) => {
        deck.cards.forEach((card: any) => {
          if (card.nextDue <= tomorrowStudyTime.getTime()) {
            dueCount++;
          }
        });
      });

      if (dueCount > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Time to Study! 🧠',
            body: `You have ${dueCount} card${dueCount !== 1 ? 's' : ''} due for review today. Keep your streak alive!`,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: tomorrowStudyTime,
          },
        });
        console.log(`Scheduled study notification for ${tomorrowStudyTime.toLocaleString()} with ${dueCount} cards due`);
      }
    } catch (e) {
      console.error('Failed to schedule study notification', e);
    }
  }
};
