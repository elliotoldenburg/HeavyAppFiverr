import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Target, Calendar, Dumbbell, TrendingUp, TrendingDown } from 'lucide-react-native';

type CycleHistory = {
  id: string;
  goal: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  exercise_summary: {
    exercise_id: string;
    exercise_name: string;
    best_weight: number;
    total_sets: number;
  }[];
  total_workouts: number;
  unique_exercises: number;
};

export default function CycleHistoryScreen() {
  const [cycles, setCycles] = useState<CycleHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
  const [cycleProgress, setCycleProgress] = useState<{
    exercise_name: string;
    start_weight: number;
    end_weight: number;
    percentage_change: number;
    total_volume: number;
    total_sets: number;
  }[]>([]);

  useEffect(() => {
    fetchCycles();
  }, []);

  const fetchCycles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data, error: cyclesError } = await supabase
        .from('cycle_history')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false });

      if (cyclesError) throw cyclesError;
      setCycles(data || []);
    } catch (err) {
      console.error('Error fetching cycles:', err);
      setError('Kunde inte ladda träningscykler');
    } finally {
      setLoading(false);
    }
  };

  const fetchCycleProgress = async (cycleId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('get_cycle_progress', { p_cycle_id: cycleId });

      if (error) throw error;
      setCycleProgress(data || []);
    } catch (err) {
      console.error('Error fetching cycle progress:', err);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#009dff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(0,157,255,0.1)', 'rgba(0,0,0,1)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.3 }}
      />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>Tidigare cykler</Text>
      </View>

      <ScrollView style={styles.content}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={fetchCycles}>
              <Text style={styles.retryButtonText}>Försök igen</Text>
            </Pressable>
          </View>
        ) : cycles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Inga avslutade cykler hittades</Text>
          </View>
        ) : (
          <View style={styles.cycleList}>
            {cycles.map((cycle) => (
              <Pressable
                key={cycle.id}
                style={styles.cycleCard}
                onPress={() => {
                  setSelectedCycle(selectedCycle === cycle.id ? null : cycle.id);
                  if (selectedCycle !== cycle.id) {
                    fetchCycleProgress(cycle.id);
                  }
                }}
              >
                <View style={styles.cycleHeader}>
                  <View style={styles.goalContainer}>
                    <Target size={20} color="#009dff" />
                    <Text style={styles.goalText}>{cycle.goal}</Text>
                  </View>

                  <View style={styles.dateContainer}>
                    <Calendar size={16} color="#808080" />
                    <Text style={styles.dateText}>
                      {formatDate(cycle.start_date)} - {formatDate(cycle.end_date)}
                    </Text>
                  </View>
                </View>

                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{cycle.total_workouts}</Text>
                    <Text style={styles.statLabel}>Pass</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{cycle.unique_exercises}</Text>
                    <Text style={styles.statLabel}>Övningar</Text>
                  </View>
                </View>

                {selectedCycle === cycle.id && cycleProgress.length > 0 && (
                  <View style={styles.progressContainer}>
                    <Text style={styles.progressTitle}>Träningsutveckling</Text>
                    {cycleProgress.map((progress, index) => (
                      <View key={index} style={styles.progressCard}>
                        <View style={styles.exerciseHeader}>
                          <Dumbbell size={16} color="#FFFFFF" />
                          <Text style={styles.exerciseName}>{progress.exercise_name}</Text>
                        </View>

                        <View style={styles.progressDetails}>
                          <View style={styles.weightInfo}>
                            <Text style={styles.weightLabel}>Start</Text>
                            <Text style={styles.weightValue}>{progress.start_weight} kg</Text>
                          </View>

                          <View style={styles.arrow}>
                            {progress.percentage_change > 0 ? (
                              <TrendingUp size={20} color="#22C55E" />
                            ) : (
                              <TrendingDown size={20} color="#EF4444" />
                            )}
                          </View>

                          <View style={styles.weightInfo}>
                            <Text style={styles.weightLabel}>Slut</Text>
                            <Text style={styles.weightValue}>{progress.end_weight} kg</Text>
                          </View>

                          <View style={[
                            styles.percentageContainer,
                            progress.percentage_change > 0 ? styles.positiveChange : styles.negativeChange
                          ]}>
                            <Text style={[
                              styles.percentageText,
                              progress.percentage_change > 0 ? styles.positiveText : styles.negativeText
                            ]}>
                              {progress.percentage_change > 0 ? '+' : ''}{progress.percentage_change}%
                            </Text>
                          </View>
                        </View>

                        <View style={styles.volumeInfo}>
                          <Text style={styles.volumeLabel}>
                            Totalt: {progress.total_sets} set • {Math.round(progress.total_volume)} kg volym
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {cycle.notes && (
                  <Text style={styles.notes}>{cycle.notes}</Text>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
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
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: '#FF4444',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#333333',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#808080',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  cycleList: {
    gap: 16,
  },
  cycleCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  cycleHeader: {
    gap: 12,
    marginBottom: 16,
  },
  goalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#262626',
    padding: 12,
    borderRadius: 8,
  },
  goalText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#262626',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#333333',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#808080',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  progressContainer: {
    backgroundColor: '#262626',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  progressTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  progressCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  progressDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weightInfo: {
    alignItems: 'center',
  },
  weightLabel: {
    color: '#808080',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginBottom: 4,
  },
  weightValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  arrow: {
    marginHorizontal: 8,
  },
  percentageContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  positiveChange: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  negativeChange: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  percentageText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  positiveText: {
    color: '#22C55E',
  },
  negativeText: {
    color: '#EF4444',
  },
  volumeInfo: {
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingTop: 8,
    marginTop: 8,
  },
  volumeLabel: {
    color: '#808080',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  notes: {
    color: '#B0B0B0',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    fontStyle: 'italic',
    marginTop: 16,
  },
});