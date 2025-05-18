import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Dumbbell, TrendingUp, TrendingDown } from 'lucide-react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';

type ExerciseProgress = {
  date: string;
  value: number;
};

type Exercise = {
  id: string;
  name: string;
  category: string;
};

export default function TrainingComparisonScreen() {
  const { friendId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [friendName, setFriendName] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [userProgress, setUserProgress] = useState<ExerciseProgress[]>([]);
  const [friendProgress, setFriendProgress] = useState<ExerciseProgress[]>([]);
  const [timeRange, setTimeRange] = useState<number>(12); // 12 weeks default

  useEffect(() => {
    if (!friendId) {
      router.back();
      return;
    }
    
    fetchFriendInfo();
    fetchExercises();
  }, [friendId]);

  useEffect(() => {
    if (selectedExercise) {
      fetchProgressData();
    }
  }, [selectedExercise, timeRange]);

  const fetchFriendInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('training_profiles')
        .select('full_name')
        .eq('user_id', friendId)
        .single();

      if (error) throw error;
      setFriendName(data.full_name);
    } catch (err) {
      console.error('Error fetching friend info:', err);
      setError('Kunde inte hämta vänninformation');
    }
  };

  const fetchExercises = async () => {
    try {
      // Get exercises that both users have logged
      const { data, error } = await supabase
        .from('ovningar')
        .select('id, name, category')
        .order('name');

      if (error) throw error;
      setExercises(data || []);
      
      // Select first exercise by default
      if (data && data.length > 0) {
        setSelectedExercise(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching exercises:', err);
      setError('Kunde inte hämta övningar');
    } finally {
      setLoading(false);
    }
  };

  const fetchProgressData = async () => {
    if (!selectedExercise) return;
    
    try {
      setLoading(true);
      
      // Calculate start date based on time range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (timeRange * 7));
      const startDateStr = startDate.toISOString().split('T')[0];
      
      // Fetch user's progress
      const { data: userData, error: userError } = await supabase
        .from('progress_tracking_logs')
        .select('workout_date, weight, reps')
        .eq('exercise_id', selectedExercise)
        .gte('workout_date', startDateStr)
        .order('workout_date');
        
      if (userError) throw userError;
      
      // Fetch friend's progress
      const { data: friendData, error: friendError } = await supabase
        .rpc('get_friend_progress', {
          p_friend_id: friendId,
          p_exercise_id: selectedExercise,
          p_start_date: startDateStr
        });
        
      if (friendError) throw friendError;
      
      // Process user data
      const userProcessedData = (userData || []).map(item => ({
        date: item.workout_date,
        value: item.weight * item.reps // Use volume
      }));
      
      // Process friend data
      const friendProcessedData = (friendData || []).map(item => ({
        date: item.workout_date,
        value: item.volume // Use volume
      }));
      
      setUserProgress(userProcessedData);
      setFriendProgress(friendProcessedData);
    } catch (err) {
      console.error('Error fetching progress data:', err);
      setError('Kunde inte hämta träningsdata');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('sv-SE', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getChartData = () => {
    // Combine dates from both datasets
    const allDates = [...new Set([
      ...userProgress.map(p => p.date),
      ...friendProgress.map(p => p.date)
    ])].sort();
    
    return {
      labels: allDates.map(date => formatDate(date)),
      datasets: [
        {
          data: userProgress.map(p => p.value),
          color: (opacity = 1) => `rgba(0, 157, 255, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: friendProgress.map(p => p.value),
          color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
          strokeWidth: 2,
        }
      ],
      legend: ['Din progress', `${friendName}s progress`]
    };
  };

  // Create a web-safe version of the chart config that doesn't include responder props
  const webSafeChartConfig = {
    backgroundColor: '#1A1A1A',
    backgroundGradientFrom: '#1A1A1A',
    backgroundGradientTo: '#1A1A1A',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#1A1A1A'
    }
  };

  const calculateProgress = (data: ExerciseProgress[]) => {
    if (data.length < 2) return { percentage: 0, isPositive: true };
    
    const firstValue = data[0].value;
    const lastValue = data[data.length - 1].value;
    const change = lastValue - firstValue;
    const percentage = firstValue > 0 ? (change / firstValue) * 100 : 0;
    
    return {
      percentage: Math.round(percentage),
      isPositive: percentage >= 0
    };
  };

  const userProgressStats = calculateProgress(userProgress);
  const friendProgressStats = calculateProgress(friendProgress);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>Jämför träning</Text>
      </View>

      <ScrollView style={styles.content}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : loading && !selectedExercise ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#009dff" />
          </View>
        ) : (
          <>
            <View style={styles.exerciseSelector}>
              <Text style={styles.sectionTitle}>Välj övning</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.exerciseScroll}
              >
                {exercises.map(exercise => (
                  <Pressable
                    key={exercise.id}
                    style={[
                      styles.exerciseChip,
                      selectedExercise === exercise.id && styles.exerciseChipSelected
                    ]}
                    onPress={() => setSelectedExercise(exercise.id)}
                  >
                    <Dumbbell 
                      size={16} 
                      color={selectedExercise === exercise.id ? '#FFFFFF' : '#808080'} 
                    />
                    <Text 
                      style={[
                        styles.exerciseChipText,
                        selectedExercise === exercise.id && styles.exerciseChipTextSelected
                      ]}
                    >
                      {exercise.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.timeRangeSelector}>
              <Text style={styles.sectionTitle}>Tidsperiod</Text>
              <View style={styles.timeRangeButtons}>
                {[4, 12, 24, 52].map(weeks => (
                  <Pressable
                    key={weeks}
                    style={[
                      styles.timeRangeButton,
                      timeRange === weeks && styles.timeRangeButtonSelected
                    ]}
                    onPress={() => setTimeRange(weeks)}
                  >
                    <Text 
                      style={[
                        styles.timeRangeButtonText,
                        timeRange === weeks && styles.timeRangeButtonTextSelected
                      ]}
                    >
                      {weeks} veckor
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {loading ? (
              <View style={styles.chartLoadingContainer}>
                <ActivityIndicator size="large" color="#009dff" />
              </View>
            ) : userProgress.length === 0 || friendProgress.length === 0 ? (
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>
                  Inte tillräckligt med data för att visa jämförelse
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.chartContainer}>
                  <View style={styles.legendContainer}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#009dff' }]} />
                      <Text style={styles.legendText}>Din progress</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#EF4444' }]} />
                      <Text style={styles.legendText}>{friendName}s progress</Text>
                    </View>
                  </View>

                  <LineChart
                    data={getChartData()}
                    width={Platform.OS === 'web' ? 600 : 350}
                    height={220}
                    chartConfig={webSafeChartConfig}
                    bezier
                    style={styles.chart}
                    withVerticalLines={false}
                    withHorizontalLines={true}
                    withVerticalLabels={true}
                    withHorizontalLabels={true}
                    fromZero={false}
                    yAxisSuffix=" kg"
                  />
                </View>

                <View style={styles.progressSummary}>
                  <View style={styles.progressCard}>
                    <Text style={styles.progressCardTitle}>Din utveckling</Text>
                    <View style={styles.progressIndicator}>
                      {userProgressStats.isPositive ? (
                        <TrendingUp size={24} color="#22C55E" />
                      ) : (
                        <TrendingDown size={24} color="#EF4444" />
                      )}
                      <Text 
                        style={[
                          styles.progressPercentage,
                          { color: userProgressStats.isPositive ? '#22C55E' : '#EF4444' }
                        ]}
                      >
                        {userProgressStats.isPositive ? '+' : ''}{userProgressStats.percentage}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressCard}>
                    <Text style={styles.progressCardTitle}>{friendName}s utveckling</Text>
                    <View style={styles.progressIndicator}>
                      {friendProgressStats.isPositive ? (
                        <TrendingUp size={24} color="#22C55E" />
                      ) : (
                        <TrendingDown size={24} color="#EF4444" />
                      )}
                      <Text 
                        style={[
                          styles.progressPercentage,
                          { color: friendProgressStats.isPositive ? '#22C55E' : '#EF4444' }
                        ]}
                      >
                        {friendProgressStats.isPositive ? '+' : ''}{friendProgressStats.percentage}%
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            )}
          </>
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
  content: {
    flex: 1,
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  exerciseSelector: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  exerciseScroll: {
    flexGrow: 0,
  },
  exerciseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    gap: 8,
  },
  exerciseChipSelected: {
    backgroundColor: '#009dff',
  },
  exerciseChipText: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  exerciseChipTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  timeRangeSelector: {
    marginBottom: 24,
  },
  timeRangeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeRangeButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  timeRangeButtonSelected: {
    backgroundColor: '#009dff',
  },
  timeRangeButtonText: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  timeRangeButtonTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  chartLoadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  noDataContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
  },
  noDataText: {
    color: '#808080',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  chartContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  progressSummary: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  progressCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  progressCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 12,
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressPercentage: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
  },
});