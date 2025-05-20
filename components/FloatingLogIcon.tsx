import { View, Text, StyleSheet } from 'react-native';
import Animated, { 
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { Plus } from 'lucide-react-native';

export default function FloatingLogIcon() {
  const floatingAnimation = useAnimatedStyle(() => {
    return {
      transform: [{
        translateY: withRepeat(
          withSequence(
            withTiming(-15, { duration: 2000 }),
            withDelay(100, withTiming(0, { duration: 2000 }))
          ),
          -1,
          true
        ),
      }],
      opacity: withRepeat(
        withSequence(
          withTiming(0.8, { duration: 2000 }),
          withDelay(100, withTiming(1, { duration: 2000 }))
        ),
        -1,
        true
      ),
    };
  });

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Lägg till övning</Text>
      <Animated.View style={[styles.container, floatingAnimation]}>
        <View style={styles.iconContainer}>
          <Plus color="#FFFFFF" size={64} strokeWidth={1.5} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 24,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  container: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
});