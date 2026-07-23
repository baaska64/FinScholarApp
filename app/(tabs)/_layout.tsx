import { Tabs } from 'expo-router';
import CustomTabBar from '@/components/CustomTabBar';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="grades" options={{ title: 'Grades' }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="requirements" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="flashcards" options={{ title: 'Study' }} />
      <Tabs.Screen
        name="profile"
        options={{
          href: null, // Hides from tab bar but keeps routable
        }}
      />
      <Tabs.Screen
        name="academic-manager"
        options={{
          href: null, // Hides from tab bar but keeps routable
        }}
      />
    </Tabs>
  );
}
