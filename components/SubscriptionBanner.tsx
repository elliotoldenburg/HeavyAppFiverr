import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { useSubscription, isActiveSubscription } from '@/lib/hooks/useSubscription';

type Props = {
  compact?: boolean;
};

export default function SubscriptionBanner({ compact = false }: Props) {
  const { data: subscription, isLoading } = useSubscription();
  
  // Don't show banner if loading or user has active subscription
  if (isLoading || isActiveSubscription(subscription?.subscription_status)) {
    return null;
  }

  const handlePress = () => {
    router.push('/subscription');
  };

  if (compact) {
    return (
      <Pressable style={styles.compactContainer} onPress={handlePress}>
        <Sparkles size={16} color="#FFD700" />
        <Text style={styles.compactText}>Uppgradera till Premium</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Sparkles size={20} color="#FFD700" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Uppgradera till Premium</Text>
          <Text style={styles.description}>
            Få tillgång till alla funktioner och träningsprogram
          </Text>
        </View>
      </View>
      <Pressable style={styles.button} onPress={handlePress}>
        <Text style={styles.buttonText}>Uppgradera</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 157, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(0, 157, 255, 0.3)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#B0B0B0',
  },
  button: {
    backgroundColor: '#009dff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 157, 255, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 157, 255, 0.3)',
    alignSelf: 'flex-start',
    gap: 6,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  compactText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
});