import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import { Dumbbell } from 'lucide-react-native';
import { useWorkoutDraftStore } from '@/lib/store';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSequence,
  Easing,
  withTiming
} from 'react-native-reanimated';

type Props = {
  position?: 'bottom' | 'floating';
};

export default function WorkoutDraftButton({ position = 'floating' }: Props) {
  const exerciseCount = useWorkoutDraftStore(state => state.getExerciseCount());
  const [prevCount, setPrevCount] = useState(exerciseCount);
  
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  
  useEffect(() => {
    if (exerciseCount > prevCount) {
      // Animate when adding exercises
      scale.value = withSequence(
        withTiming(1.2, { duration: 200, easing: Easing.bounce }),
        withTiming(1, { duration: 200 })
      );
      
      opacity.value = withSequence(
        withTiming(0.7, { duration: 100 }),
        withTiming(1, { duration: 200 })
      );
    }
    setPrevCount(exerciseCount);
  }, [exerciseCount]);
  
  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value
    };
  });
  
  if (exerciseCount === 0) {
    return null;
  }
  
  const handlePress = () => {
    router.push('/workout-logger');
  };
  
  if (position === 'bottom') {
    return (
      <Pressable 
        style={styles.bottomButton}
        onPress={handlePress}
      >
        <Dumbbell size={20} color="#FFFFFF" />
        <Text style={styles.buttonText}>
          {exerciseCount} {exerciseCount === 1 ? 'övning' : 'övningar'} i korgen
        </Text>
      </Pressable>
    );
  }
  
  return (
    <Animated.View style={[styles.floatingContainer, animatedStyles]}>
      <Pressable 
        style={styles.floatingButton}
        onPress={handlePress}
      >
        <Dumbbell size={24} color="#FFFFFF" />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{exerciseCount}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 100,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#009dff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    paddingHorizontal: 6,
  },
  bottomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#009dff',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    margin: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  }
});