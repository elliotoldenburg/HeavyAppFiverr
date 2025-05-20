import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Target, Calendar } from 'lucide-react-native';
import { router } from 'expo-router';
import type { TrainingCycle } from '@/types/database.types';
import CycleSummaryModal from './CycleSummaryModal';

type Props = {
  cycle: TrainingCycle;
  onUpdate: () => void;
};

export default function TrainingCycleCard({ cycle, onUpdate }: Props) {
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [cycleProgress, setCycleProgress] = useState<{
    exercise: string;
    startWeight: number;
    endWeight: number;
    percentageChange: number;
  }[]>([]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Target size={24} color="#009dff" />
        </View>
        <Text style={styles.title}>Aktuellt träningsmål</Text>
      </View>

      <Text style={styles.goal}>{cycle.goal}</Text>

      <View style={styles.dateContainer}>
        <Calendar size={16} color="#808080" />
        <Text style={styles.dateText}>
          Startade {formatDate(cycle.start_date)}
        </Text>
      </View>

      <Pressable
        style={styles.newCycleButton}
        onPress={() => router.push('/profile/new-cycle')}
      >
        <Text style={styles.newCycleButtonText}>Starta ny cykel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,157,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,157,255,0.3)',
  },
  title: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  goal: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    marginBottom: 16,
    lineHeight: 24,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dateText: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  newCycleButton: {
    backgroundColor: '#009dff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  newCycleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});