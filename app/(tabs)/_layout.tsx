import { Tabs } from 'expo-router';
import { Dumbbell, ListVideo, Apple, User, Users, CalendarDays } from 'lucide-react-native';
import WorkoutDraftButton from '@/components/WorkoutDraftButton';
import { View, Platform } from 'react-native';
import FriendNotificationBadge from '@/components/FriendNotificationBadge';

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#000000',
            borderTopColor: '#333333',
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
          },
          tabBarActiveTintColor: '#009dff',
          tabBarInactiveTintColor: '#808080',
          tabBarLabelStyle: {
            fontFamily: 'Inter-Regular',
            fontSize: 12,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Program',
            tabBarIcon: ({ size, color }) => <Dumbbell size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="workouts"
          options={{
            title: 'Pass',
            tabBarIcon: ({ size, color }) => <CalendarDays size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="exercises"
          options={{
            title: 'Övningar',
            tabBarIcon: ({ size, color }) => <ListVideo size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="nutrition"
          options={{
            title: 'Nutrition',
            tabBarIcon: ({ size, color }) => <Apple size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: 'Vänner',
            tabBarIcon: ({ size, color }) => (
              <FriendNotificationBadge size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profil',
            tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
          }}
        />
      </Tabs>
      
      <WorkoutDraftButton />
    </View>
  );
}