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
  Dimensions,
  Modal,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Search, Filter, ArrowLeft, ChevronDown, X, Info, Target } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { LineChart } from 'react-native-chart-kit';
import type { Exercise } from '@/types/database.types';
import { useWorkoutProgress } from '@/lib/queries';

type Props = {
  onClose: () => void;
};

type Category = string;
type Equipment = string;

type TimeRange = 4 | 12 | 24 | 52 | -1 | 'cycle';

type GraphType = 'volume' | 'estimated1rm' | '1rm';

type DataPoint = {
  date: string;
  value: number;
  reps?: number;
  weight?: number;
};

type ProgressStats = {
  startValue: number;
  endValue: number;
  percentageChange: number;
};

export default function ProgressGraphs({ onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('cycle');
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);
  const [graphType, setGraphType] = useState<GraphType>('volume');
  const [volumeData, setVolumeData] = useState<DataPoint[]>([]);
  const [estimated1RMData, setEstimated1RMData] = useState<DataPoint[]>([]);
  const [actual1RMData, setActual1RMData] = useState<DataPoint[]>([]);
  const [showGraph, setShowGraph] = useState(false);
  const [progressStats, setProgressStats] = useState<ProgressStats | null>(null);
  const [selectedPointProgress, setSelectedPointProgress] = useState<ProgressStats | null>(null);
  const [noDataMessage, setNoDataMessage] = useState<string | null>(null);
  const [cycleGoal, setCycleGoal] = useState<string | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 48, 600);
  const chartHeight = Math.min(220, screenWidth * 0.3);

  // Use React Query hook for progress data
  const { data: progressQueryData, isLoading: isLoadingProgress } = useWorkoutProgress(selectedExercise, selectedTimeRange);

  useEffect(() => {
    fetchExercises();
  }, []);

  const calculateProgress = (data: DataPoint[], endIndex?: number) => {
    if (data.length < 2) return null;

    const relevantData = endIndex !== undefined ? data.slice(0, endIndex + 1) : data;
    const startValue = relevantData[0].value;
    const endValue = relevantData[relevantData.length - 1].value;
    const percentageChange = ((endValue - startValue) / startValue) * 100;

    return {
      startValue,
      endValue,
      percentageChange
    };
  };

  const fetchExercises = async () => {
    try {
      setLoading(true);
      const { data, error: exercisesError } = await supabase
        .from('ovningar')
        .select('*')
        .order('name');

      if (exercisesError) throw exercisesError;
      setExercises(data || []);

      const uniqueCategories = [...new Set(data?.map(ex => ex.category) || [])];
      setCategories(uniqueCategories);
    } catch (err) {
      console.error('Error fetching exercises:', err);
      setError('Kunde inte ladda övningar');
    } finally {
      setLoading(false);
    }
  };

  const fetchProgressData = async () => {
    if (!selectedExercise) {
      setError('Välj en övning först');
      return;
    }

    try {
      setError(null);
      setNoDataMessage(null);
      
      if (!progressQueryData) {
        setNoDataMessage('Ingen träningsdata hittad');
        return;
      }
      
      if (progressQueryData.noDataMessage) {
        setNoDataMessage(progressQueryData.noDataMessage);
        setVolumeData([]);
        setEstimated1RMData([]);
        setActual1RMData([]);
        setShowGraph(true);
        return;
      }
      
      setCycleGoal(progressQueryData.cycleGoal);
      
      const progressData = progressQueryData.data;

      // Process data for each graph type
      const volumePoints: DataPoint[] = progressData.map(d => ({
        date: d.workout_date,
        value: d.weight * d.reps,
        reps: d.reps,
        weight: d.weight
      }));

      const estimated1RMPoints: DataPoint[] = progressData.map(d => ({
        date: d.workout_date,
        value: d.weight * (1 + (d.reps / 30)), // Simple 1RM estimation
        reps: d.reps,
        weight: d.weight
      }));

      const actual1RMPoints: DataPoint[] = progressData
        .filter(d => d.reps === 1)
        .map(d => ({
          date: d.workout_date,
          value: d.weight,
          reps: 1,
          weight: d.weight
        }));

      setVolumeData(volumePoints);
      setEstimated1RMData(estimated1RMPoints);
      setActual1RMData(actual1RMPoints);

      // Calculate initial progress stats
      const currentData = {
        volume: volumePoints,
        estimated1rm: estimated1RMPoints,
        '1rm': actual1RMPoints
      }[graphType] || [];

      setProgressStats(calculateProgress(currentData));
      setSelectedPointProgress(null);
      setShowGraph(true);

    } catch (err) {
      console.error('Error generating charts:', err);
      setError('Kunde inte generera diagram');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('sv-SE', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getActiveData = () => {
    const data = {
      volume: volumeData,
      estimated1rm: estimated1RMData,
      '1rm': actual1RMData
    }[graphType] || [];

    if (data.length < 2) {
      return [{
        date: new Date(Date.now() - 86400000).toISOString(),
        value: 0
      }, {
        date: new Date().toISOString(),
        value: 0
      }];
    }

    return data;
  };

  const getGraphTitle = () => {
    switch (graphType) {
      case 'volume':
        return 'Best Set Volume';
      case 'estimated1rm':
        return 'Estimerat 1RM';
      case '1rm':
        return 'Faktiskt 1RM';
      default:
        return '';
    }
  };

  const chartConfig = {
    backgroundColor: '#1A1A1A',
    backgroundGradientFrom: '#1A1A1A',
    backgroundGradientTo: '#1A1A1A',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(0, 157, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#1A1A1A'
    },
    propsForLabels: {
      fontSize: 10,
    },
    formatYLabel: (value: string) => `${Math.round(parseFloat(value))} kg`,
  };

  const getYAxisSuffix = () => {
    switch (graphType) {
      case 'volume':
        return ' kg';
      case 'estimated1rm':
      case '1rm':
        return ' kg';
      default:
        return '';
    }
  };

  const renderProgressBar = (stats: ProgressStats | null) => {
    if (!stats) return null;

    const { percentageChange } = stats;
    const isPositive = percentageChange > 0;
    const progressWidth = Math.min(Math.abs(percentageChange), 100);

    return (
      <View style={styles.progressContainer}>
        <Text style={styles.progressLabel}>
          Progress: {percentageChange.toFixed(1)}%
        </Text>
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar,
              {
                width: `${progressWidth}%`,
                backgroundColor: isPositive ? '#22C55E' : '#EF4444'
              }
            ]} 
          />
        </View>
      </View>
    );
  };

  const handleDataPointClick = ({ index }: { index: number }) => {
    const activeData = getActiveData();
    setSelectedPoint(activeData[index]);
    setSelectedPointProgress(calculateProgress(activeData, index));
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
        <Text style={styles.title}>Utveckling</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#808080" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Sök övningar..."
            placeholderTextColor="#808080"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          <Pressable
            style={[
              styles.categoryChip,
              !selectedCategory && styles.categoryChipSelected
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[
              styles.categoryChipText,
              !selectedCategory && styles.categoryChipTextSelected
            ]}>
              Alla
            </Text>
          </Pressable>
          {categories.map(category => (
            <Pressable
              key={category}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.categoryChipSelected
              ]}
              onPress={() => setSelectedCategory(
                selectedCategory === category ? null : category
              )}
            >
              <Text style={[
                styles.categoryChipText,
                selectedCategory === category && styles.categoryChipTextSelected
              ]}>
                {category}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView style={styles.exerciseList}>
          {exercises
            .filter(ex => 
              (!selectedCategory || ex.category === selectedCategory) &&
              (ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
               ex.category.toLowerCase().includes(searchQuery.toLowerCase()))
            )
            .map(exercise => (
              <Pressable
                key={exercise.id}
                style={[
                  styles.exerciseItem,
                  selectedExercise === exercise.id && styles.exerciseItemSelected
                ]}
                onPress={() => setSelectedExercise(exercise.id)}
              >
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseCategory}>{exercise.category}</Text>
                </View>
                <ChevronDown 
                  size={20} 
                  color={selectedExercise === exercise.id ? '#009dff' : '#808080'} 
                />
              </Pressable>
            ))}
        </ScrollView>

        {selectedExercise && (
          <View style={styles.graphSection}>
            <View style={styles.graphTypeSelector}>
              <Pressable
                style={[
                  styles.graphTypeButton,
                  graphType === 'volume' && styles.graphTypeButtonActive
                ]}
                onPress={() => setGraphType('volume')}
              >
                <Text style={[
                  styles.graphTypeText,
                  graphType === 'volume' && styles.graphTypeTextActive
                ]}>
                  Volume
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.graphTypeButton,
                  graphType === 'estimated1rm' && styles.graphTypeButtonActive
                ]}
                onPress={() => setGraphType('estimated1rm')}
              >
                <Text style={[
                  styles.graphTypeText,
                  graphType === 'estimated1rm' && styles.graphTypeTextActive
                ]}>
                  Est. 1RM
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.graphTypeButton,
                  graphType === '1rm' && styles.graphTypeButtonActive
                ]}
                onPress={() => setGraphType('1rm')}
              >
                <Text style={[
                  styles.graphTypeText,
                  graphType === '1rm' && styles.graphTypeTextActive
                ]}>
                  1RM
                </Text>
              </Pressable>
            </View>

            <View style={styles.timeRangeContainer}>
              <Pressable
                style={[
                  styles.timeRangeButton,
                  selectedTimeRange === 'cycle' && styles.timeRangeButtonActive
                ]}
                onPress={() => setSelectedTimeRange('cycle')}
              >
                <Target size={16} color={selectedTimeRange === 'cycle' ? '#FFFFFF' : '#808080'} />
                <Text style={[
                  styles.timeRangeText,
                  selectedTimeRange === 'cycle' && styles.timeRangeTextActive
                ]}>
                  Nuvarande cykel
                </Text>
              </Pressable>
              {[4, 12, 24, 52, -1].map((range) => (
                <Pressable
                  key={range}
                  style={[
                    styles.timeRangeButton,
                    selectedTimeRange === range && styles.timeRangeButtonActive
                  ]}
                  onPress={() => setSelectedTimeRange(range as TimeRange)}
                >
                  <Text style={[
                    styles.timeRangeText,
                    selectedTimeRange === range && styles.timeRangeTextActive
                  ]}>
                    {range === -1 ? 'All tid' : `${range}v`}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={styles.generateButton}
              onPress={fetchProgressData}
            >
              <Text style={styles.generateButtonText}>VISA GRAF</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Modal
        visible={showGraph}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowGraph(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{getGraphTitle()}</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setShowGraph(false)}
              >
                <X size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : noDataMessage ? (
              <View style={styles.noDataContainer}>
                <Info size={24} color="#808080" style={styles.noDataIcon} />
                <Text style={styles.noDataText}>{noDataMessage}</Text>
              </View>
            ) : (
              <View style={styles.chartContainer}>
                {selectedTimeRange === 'cycle' && cycleGoal && (
                  <View style={styles.cycleInfo}>
                    <Target size={16} color="#009dff" />
                    <Text style={styles.cycleGoal}>{cycleGoal}</Text>
                  </View>
                )}

                <LineChart
                  data={{
                    labels: getActiveData().map(d => formatDate(d.date)),
                    datasets: [{
                      data: getActiveData().map(d => d.value || 0)
                    }]
                  }}
                  width={chartWidth}
                  height={chartHeight}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
                  onDataPointClick={handleDataPointClick}
                  withVerticalLines={false}
                  withHorizontalLines={true}
                  withVerticalLabels={true}
                  withHorizontalLabels={true}
                  fromZero={true}
                  yAxisSuffix={getYAxisSuffix()}
                  yAxisInterval={5}
                  segments={5}
                />

                {/* Total progress */}
                {renderProgressBar(progressStats)}

                {/* Selected point progress */}
                {selectedPointProgress && (
                  <View style={styles.selectedProgressContainer}>
                    <Text style={styles.selectedProgressTitle}>Progress till vald punkt:</Text>
                    {renderProgressBar(selectedPointProgress)}
                  </View>
                )}

                {selectedPoint && (
                  <View style={styles.pointDetails}>
                    <Text style={styles.pointDate}>
                      {new Date(selectedPoint.date).toLocaleDateString('sv-SE')}
                    </Text>
                    <Text style={styles.pointValue}>
                      {graphType === 'volume' ? (
                        `${selectedPoint.weight} kg × ${selectedPoint.reps} reps = ${selectedPoint.value} kg`
                      ) : (
                        `${selectedPoint.value} kg`
                      )}
                    </Text>
                  </View>
                )}
              </View>
            )}
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
  content: {
    flex: 1,
    padding: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  categoryScroll: {
    marginBottom: 12,
  },
  categoryScrollContent: {
    paddingRight: 24,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryChipSelected: {
    backgroundColor: '#009dff',
    borderColor: '#009dff',
  },
  categoryChipText: {
    color: '#808080',
    fontSize: 13,
    fontFamily: 'Inter-Regular',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  exerciseList: {
    flex: 1,
    maxHeight: 200,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  exerciseItemSelected: {
    backgroundColor: 'rgba(0,157,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,157,255,0.3)',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  exerciseCategory: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  graphSection: {
    marginTop: 24,
  },
  graphTypeSelector: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  graphTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  graphTypeButtonActive: {
    backgroundColor: '#009dff',
  },
  graphTypeText: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  graphTypeTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  timeRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A1A1A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  timeRangeButtonActive: {
    backgroundColor: '#009dff',
  },
  timeRangeText: {
    color: '#808080',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  timeRangeTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  generateButton: {
    backgroundColor: '#009dff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    margin: 24,
    borderRadius: 16,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chartContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
  },
  cycleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#262626',
    borderRadius: 8,
    marginBottom: 16,
  },
  cycleGoal: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  progressContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#262626',
    borderRadius: 8,
  },
  progressLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  selectedProgressContainer: {
    marginTop: 8,
    padding: 16,
    backgroundColor: '#262626',
    borderRadius: 8,
  },
  selectedProgressTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  pointDetails: {
    backgroundColor: '#262626',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  pointDate: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 4,
  },
  pointValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  errorContainer: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.2)',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  noDataContainer: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  noDataIcon: {
    opacity: 0.6,
  },
  noDataText: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  }
});