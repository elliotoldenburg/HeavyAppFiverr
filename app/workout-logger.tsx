import React from 'react';
import { router } from 'expo-router';
import WorkoutLogger from '@/components/WorkoutLogger';

export default function WorkoutLoggerScreen() {
  return (
    <WorkoutLogger
      onClose={() => router.back()}
      onWorkoutLogged={() => {
        router.replace('/(tabs)/profile');
      }}
    />
  );
}