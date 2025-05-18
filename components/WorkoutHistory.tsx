import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, ChevronRight, ChevronDown, ChevronUp, Trash2, CreditCard as Edit2, X } from 'lucide-react-native';
import type { WorkoutLog, ExerciseLog } from '@/types/database.types';

type Props = {
  onClose: () => void;
  onWorkoutUpdated: () => void;
};

type ExpandedExercise = {
  workoutId: string;
  exerciseId: string;
};

type DateRange = {
  startDate: string | null;
  endDate: string | null;
};

type DateParts = {
  year: string;
  month: string;
  day: string;
};

export default function WorkoutHistory({ onClose, onWorkoutUpdated }: Props) {
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<ExpandedExercise | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutLog | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null
  });
  const [startDateParts, setStartDateParts] = useState<DateParts>({
    year: '',
    month: '',
    day: ''
  });
  const [endDateParts, setEndDateParts] = useState<DateParts>({
    year: '',
    month: '',
    day: ''
  });

  useEffect(() => {
    fetchWorkouts();
  }, [dateRange]);

  const fetchWorkouts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      let query = supabase
        .from('workout_logs')
        .select(`
          *,
          exercise_logs (
            *,
            exercise:ovningar (*),
            set_logs (*)
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (dateRange.startDate) {
        query = query.gte('date', dateRange.startDate);
      }
      if (dateRange.endDate) {
        query = query.lte('date', dateRange.endDate);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const processedWorkouts = data?.map(workout => {
        const totals = workout.exercise_logs?.reduce((acc, log) => {
          const setTotals = log.set_logs?.reduce((setAcc, set) => {
            setAcc.sets += 1;
            setAcc.reps += set.reps;
            setAcc.weight += (set.weight || 0) * set.reps;
            return setAcc;
          }, { sets: 0, reps: 0, weight: 0 });

          acc.sets += setTotals?.sets || 0;
          acc.reps += setTotals?.reps || 0;
          acc.weight += setTotals?.weight || 0;
          return acc;
        }, { sets: 0, reps: 0, weight: 0 });

        return {
          ...workout,
          total_sets: totals?.sets || 0,
          total_reps: totals?.reps || 0,
          total_weight_lifted: Math.round(totals?.weight || 0)
        };
      });

      setWorkouts(processedWorkouts || []);
    } catch (err) {
      console.error('Error fetching workouts:', err);
      setError('Kunde inte ladda träningshistorik');
    } finally {
      setLoading(false);
    }
  };

  const handleDatePartChange = (type: 'start' | 'end', part: keyof DateParts, value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');

    // Apply max length constraints
    let limitedValue = numericValue;
    if (part === 'year' && limitedValue.length > 4) {
      limitedValue = limitedValue.slice(0, 4);
    } else if ((part === 'month' || part === 'day') && limitedValue.length > 2) {
      limitedValue = limitedValue.slice(0, 2);
    }

    // Update the appropriate date parts
    if (type === 'start') {
      setStartDateParts(prev => ({ ...prev, [part]: limitedValue }));
    } else {
      setEndDateParts(prev => ({ ...prev, [part]: limitedValue }));
    }

    // Check if we have a complete date
    const dateParts = type === 'start' ? 
      { ...startDateParts, [part]: limitedValue } : 
      { ...endDateParts, [part]: limitedValue };

    if (dateParts.year.length === 4 && dateParts.month.length === 2 && dateParts.day.length === 2) {
      const dateStr = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
      // Validate date
      const date = new Date(dateStr);
      if (date.toString() !== 'Invalid Date') {
        setDateRange(prev => ({
          ...prev,
          [`${type}Date`]: dateStr
        }));
      }
    }
  };

  const clearDateRange = () => {
    setDateRange({
      startDate: null,
      endDate: null
    });
    setStartDateParts({
      year: '',
      month: '',
      day: ''
    });
    setEndDateParts({
      year: '',
      month: '',
      day: ''
    });
  };

  const handleDeleteWorkout = async () => {
    if (!selectedWorkout) return;

    try {
      setLoading(true);
      const { error: deleteError } = await supabase
        .from('workout_logs')
        .delete()
        .eq('id', selectedWorkout.id);

      if (deleteError) throw deleteError;

      setWorkouts(workouts.filter(w => w.id !== selectedWorkout.id));
      setShowDeleteConfirm(false);
      setSelectedWorkout(null);
      onWorkoutUpdated();
    } catch (err) {
      console.error('Error deleting workout:', err);
      setError('Kunde inte radera träningspasset');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('sv-SE', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  };

  const isExerciseExpanded = (workoutId: string, exerciseId: string) => {
    return expandedExercise?.workoutId === workoutId && 
           expandedExercise?.exerciseId === exerciseId;
  };

  const toggleExercise = (workoutId: string, exerciseId: string) => {
    if (isExerciseExpanded(workoutId, exerciseId)) {
      setExpandedExercise(null);
    } else {
      setExpandedExercise({ workoutId, exerciseId });
    }
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
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>Träningshistorik</Text>
      </View>

      <View style={styles.dateFilterContainer}>
        <View style={styles.dateInputRow}>
          <Calendar size={20} color="#808080" />
          <View style={styles.dateInputGroup}>
            <TextInput
              style={[styles.dateInput, styles.yearInput]}
              placeholder="ÅÅÅÅ"
              placeholderTextColor="#808080"
              value={startDateParts.year}
              onChangeText={(text) => handleDatePartChange('start', 'year', text)}
              keyboardType="numeric"
              maxLength={4}
            />
            <Text style={styles.dateSeparator}>-</Text>
            <TextInput
              style={[styles.dateInput, styles.monthInput]}
              placeholder="MM"
              placeholderTextColor="#808080"
              value={startDateParts.month}
              onChangeText={(text) => handleDatePartChange('start', 'month', text)}
              keyboardType="numeric"
              maxLength={2}
            />
            <Text style={styles.dateSeparator}>-</Text>
            <TextInput
              style={[styles.dateInput, styles.dayInput]}
              placeholder="DD"
              placeholderTextColor="#808080"
              value={startDateParts.day}
              onChangeText={(text) => handleDatePartChange('start', 'day', text)}
              keyboardType="numeric"
              maxLength={2}
            />
          </View>
        </View>

        <View style={styles.dateInputRow}>
          <Calendar size={20} color="#808080" />
          <View style={styles.dateInputGroup}>
            <TextInput
              style={[styles.dateInput, styles.yearInput]}
              placeholder="ÅÅÅÅ"
              placeholderTextColor="#808080"
              value={endDateParts.year}
              onChangeText={(text) => handleDatePartChange('end', 'year', text)}
              keyboardType="numeric"
              maxLength={4}
            />
            <Text style={styles.dateSeparator}>-</Text>
            <TextInput
              style={[styles.dateInput, styles.monthInput]}
              placeholder="MM"
              placeholderTextColor="#808080"
              value={endDateParts.month}
              onChangeText={(text) => handleDatePartChange('end', 'month', text)}
              keyboardType="numeric"
              maxLength={2}
            />
            <Text style={styles.dateSeparator}>-</Text>
            <TextInput
              style={[styles.dateInput, styles.dayInput]}
              placeholder="DD"
              placeholderTextColor="#808080"
              value={endDateParts.day}
              onChangeText={(text) => handleDatePartChange('end', 'day', text)}
              keyboardType="numeric"
              maxLength={2}
            />
          </View>
        </View>

        {(dateRange.startDate || dateRange.endDate) && (
          <Pressable
            style={styles.clearButton}
            onPress={clearDateRange}
          >
            <Text style={styles.clearButtonText}>Rensa filter</Text>
          </Pressable>
        )}
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchWorkouts}>
            <Text style={styles.retryButtonText}>Försök igen</Text>
          </Pressable>
        </View>
      ) : workouts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Inga loggade pass hittades</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {workouts.map((workout) => (
            <View key={workout.id} style={styles.workoutCard}>
              <View style={styles.workoutHeader}>
                <View style={styles.workoutInfo}>
                  <Calendar size={20} color="#009dff" />
                  <View>
                    {workout.name && (
                      <Text style={styles.workoutName}>{workout.name}</Text>
                    )}
                    <Text style={styles.workoutDate}>
                      {formatDate(workout.created_at)}
                    </Text>
                  </View>
                </View>
                <View style={styles.workoutActions}>
                  <Pressable 
                    style={styles.actionButton}
                    onPress={() => {
                      Alert.alert('Coming soon', 'Redigering kommer i nästa uppdatering');
                    }}
                  >
                    <Edit2 size={20} color="#009dff" />
                  </Pressable>
                  <Pressable 
                    style={styles.actionButton}
                    onPress={() => {
                      setSelectedWorkout(workout);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    <Trash2 size={20} color="#FF4444" />
                  </Pressable>
                </View>
              </View>

              <View style={styles.workoutStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{workout.total_sets}</Text>
                  <Text style={styles.statLabel}>Sets</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{workout.total_reps}</Text>
                  <Text style={styles.statLabel}>Reps</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{workout.total_weight_lifted}</Text>
                  <Text style={styles.statLabel}>Total vikt (kg)</Text>
                </View>
              </View>

              <View style={styles.exerciseList}>
                {workout.exercise_logs?.map((log) => (
                  <View key={log.id}>
                    <Pressable 
                      style={styles.exerciseItem}
                      onPress={() => toggleExercise(workout.id, log.id)}
                    >
                      <View style={styles.exerciseInfo}>
                        <Text style={styles.exerciseName}>
                          {log.exercise?.name || log.custom_exercise_name}
                        </Text>
                        <Text style={styles.exerciseDetails}>
                          {log.set_logs?.length} sets
                        </Text>
                      </View>
                      {isExerciseExpanded(workout.id, log.id) ? (
                        <ChevronUp size={20} color="#808080" />
                      ) : (
                        <ChevronDown size={20} color="#808080" />
                      )}
                    </Pressable>

                    {isExerciseExpanded(workout.id, log.id) && (
                      <View style={styles.setList}>
                        {log.set_logs?.map((set) => (
                          <View key={set.id} style={styles.setItem}>
                            <Text style={styles.setNumber}>Set {set.set_number}</Text>
                            <Text style={styles.setDetails}>
                              {set.reps} reps @ {set.weight} kg
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Radera träningspass</Text>
            <Text style={styles.modalText}>
              Är du säker på att du vill radera detta träningspass? Detta går inte att ångra.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.cancelButtonText}>Avbryt</Text>
              </Pressable>

              <Pressable
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleDeleteWorkout}
              >
                <Text style={styles.deleteButtonText}>Radera</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
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
  dateFilterContainer: {
    padding: 24,
    gap: 16,
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  dateInputGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateInput: {
    backgroundColor: '#262626',
    borderRadius: 8,
    padding: 8,
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  yearInput: {
    width: 80,
  },
  monthInput: {
    width: 50,
  },
  dayInput: {
    width: 50,
  },
  dateSeparator: {
    color: '#808080',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  clearButton: {
    backgroundColor: '#333333',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#808080',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  workoutCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  workoutInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  workoutActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#262626',
  },
  workoutName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  workoutDate: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  workoutStats: {
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
  exerciseList: {
    gap: 12,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    borderRadius: 8,
    padding: 12,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  exerciseDetails: {
    color: '#808080',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  setList: {
    backgroundColor: '#333333',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginTop: 1,
    padding: 12,
  },
  setItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  setNumber: {
    color: '#009dff',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  setDetails: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#B0B0B0',
    fontFamily: 'Inter-Regular',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#333333',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  deleteButton: {
    backgroundColor: '#FF4444',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});