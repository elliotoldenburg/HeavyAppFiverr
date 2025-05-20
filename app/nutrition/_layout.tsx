import { Stack } from 'expo-router';

export default function NutritionLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="goals" />
      <Stack.Screen name="calculator" />
    </Stack>
  );
}