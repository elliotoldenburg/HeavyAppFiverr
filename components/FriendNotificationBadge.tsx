import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Users } from 'lucide-react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSequence, 
  withTiming,
  Easing
} from 'react-native-reanimated';

type Props = {
  size?: number;
  color?: string;
};

export default function FriendNotificationBadge({ size = 24, color = '#FFFFFF' }: Props) {
  const [count, setCount] = useState(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  
  useEffect(() => {
    fetchPendingRequests();
    
    // Set up real-time subscription for friend requests
    const friendRequestsSubscription = supabase
      .channel('friend_requests_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friend_requests'
      }, () => {
        fetchPendingRequests();
      })
      .subscribe();
      
    return () => {
      friendRequestsSubscription.unsubscribe();
    };
  }, []);
  
  useEffect(() => {
    if (count > 0) {
      // Animate the badge when count changes
      scale.value = withSequence(
        withTiming(1.3, { duration: 200, easing: Easing.bounce }),
        withTiming(1, { duration: 200 })
      );
      
      opacity.value = withSequence(
        withTiming(0.7, { duration: 100 }),
        withTiming(1, { duration: 200 })
      );
    }
  }, [count]);
  
  const fetchPendingRequests = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_pending_friend_requests');
        
      if (error) {
        console.error('Error fetching pending requests:', error);
        return;
      }
      
      const requestCount = Array.isArray(data) ? data.length : 0;
      setCount(requestCount);
    } catch (err) {
      console.error('Error fetching pending requests:', err);
    }
  };
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value
    };
  });
  
  if (count === 0) {
    return <Users size={size} color={color} />;
  }
  
  return (
    <View style={styles.container}>
      <Users size={size} color={color} />
      <Animated.View style={[styles.badge, animatedStyle]}>
        <Text style={styles.badgeText}>{count}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    paddingHorizontal: 4,
  },
});