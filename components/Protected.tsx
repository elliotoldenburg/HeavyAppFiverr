import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useSubscriptionContext } from '@/lib/context/SubscriptionContext';
import SubscriptionModal from '@/components/SubscriptionModal';

type Props = {
  children: React.ReactNode;
};

export default function Protected({ children }: Props) {
  const { isActive, isLoading } = useSubscriptionContext();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#009dff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {children}
      {!isActive && <SubscriptionModal />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
});