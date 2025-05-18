import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, ChevronDown, CreditCard as Edit2, Trash2, X } from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';
import { useLastWeight } from '@/lib/hooks/useLastWeight';
import { queryClient } from '@/lib/queryClient';

type Props = {
  onClose: () => void;
};

type WeightData = {
  id: string;
  date: string;
  weight_kg: number;
};

type TimeRange = '4w' | '3m' | '6m' | '1y' | 'cycle' | 'all';

export default function WeightProgress({ onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weightData, setWeightData] = useState<WeightData[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('cycle');
  const [showTimeRangeDropdown, setShowTimeRangeDropdown] = useState(false);
  const [selectedWeight, setSelectedWeight] = useState<WeightData | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cycleGoal, setCycleGoal] = useState<string | null>(null);

  // Use React Query to get the latest weight
  const { data: lastWeight } = useLastWeight();

  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    fetchWeightData();
  }, [selectedTimeRange]);

  const fetchWeightData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      let startDateStr: string | null = null;

      if (selectedTimeRange === 'cycle') {
        // Get active cycle info
        const { data: cycleData, error: cycleError } = await supabase
          .from('training_cycles')
          .select('start_date, goal')
          .eq('user_id', user.id)
          .eq('active', true)
          .single();

        if (cycleError) {
          setError('Ingen aktiv träningscykel hittad');
          return;
        }

        startDateStr = cycleData.start_date;
        setCycleGoal(cycleData.goal);
      } else if (selectedTimeRange !== 'all') {
        const now = new Date();
        switch (selectedTimeRange) {
          case '4w':
            startDateStr = new Date(now.setDate(now.getDate() - 28)).toISOString().split('T')[0];
            break;
          case '3m':
            startDateStr = new Date(now.setMonth(now.getMonth() - 3)).toISOString().split('T')[0];
            break;
          case '6m':
            startDateStr = new Date(now.setMonth(now.getMonth() - 6)).toISOString().split('T')[0];
            break;
          case '1y':
            startDateStr = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString().split('T')[0];
            break;
        }
      }

      let query = supabase
        .from('weight_tracking')
        .select('*')
        .eq('user_id', user.id);

      if (startDateStr) {
        query = query.gte('date', startDateStr);
      }

      const { data, error: fetchError } = await query.order('date', { ascending: true });

      if (fetchError) throw fetchError;
      setWeightData(data || []);
    } catch (err) {
      console.error('Error fetching weight data:', err);
      setError('Kunde inte ladda viktdata');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWeight = async () => {
    if (!selectedWeight) return;

    try {
      setDeleting(true);
      const { error: deleteError } = await supabase
        .from('weight_tracking')
        .delete()
        .eq('id', selectedWeight.id);

      if (deleteError) throw deleteError;

      setWeightData(weightData.filter(w => w.id !== selectedWeight.id));
      setShowDeleteConfirm(false);
      setSelectedWeight(null);
      
      // Invalidate the lastWeight query to refresh the data
      queryClient.invalidateQueries(['lastWeight']);
    } catch (err) {
      console.error('Error deleting weight:', err);
      Alert.alert('Fel', 'Kunde inte ta bort vikten');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('sv-SE', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getChartData = () => {
    if (weightData.length === 0) return null;

    return {
      labels: weightData.map(d => formatDate(d.date)),
      datasets: [
        {
          data: weightData.map(d => d.weight_kg),
          color: (opacity = 1) => {
            // Get weight change direction
            const weightChange = weightData.length > 1 
              ? weightData[weightData.length - 1].weight_kg - weightData[0].weight_kg 
              : 0;

            if (weightChange < 0) return `rgba(34, 197, 94, ${opacity})`; // Green for weight loss
            if (weightChange > 0) return `rgba(239, 68, 68, ${opacity})`; // Red for weight gain
            return `rgba(0, 157, 255, ${opacity})`; // Blue for no change
          },
          strokeWidth: 2
        }
      ]
    };
  };

  const chartConfig = {
    backgroundColor: '#1A1A1A',
    backgroundGradientFrom: '#1A1A1A',
    backgroundGradientTo: '#1A1A1A',
    decimalPlaces: 1,
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
        <Text style={styles.title}>Viktutveckling</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.filters}>
          <Pressable
            style={styles.dropdown}
            onPress={() => setShowTimeRangeDropdown(!showTimeRangeDropdown)}
          >
            <Calendar size={20} color="#FFFFFF" />
            <Text style={styles.dropdownText}>
              {selectedTimeRange === 'cycle' ? 'Nuvarande cykel' :
               selectedTimeRange === '4w' ? 'Senaste 4 veckorna' :
               selectedTimeRange === '3m' ? 'Senaste 3 månaderna' :
               selectedTimeRange === '6m' ? 'Senaste 6 månaderna' :
               selectedTimeRange === '1y' ? 'Senaste året' :
               'All tid'}
            </Text>
            <ChevronDown 
              size={20} 
              color="#FFFFFF" 
              style={[
                styles.dropdownIcon,
                showTimeRangeDropdown && styles.dropdownIconActive
              ]} 
            />
          </Pressable>

          {showTimeRangeDropdown && (
            <View style={styles.dropdownMenu}>
              <Pressable
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedTimeRange('cycle');
                  setShowTimeRangeDropdown(false);
                }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  selectedTimeRange === 'cycle' && styles.dropdownItemTextActive
                ]}>
                  Nuvarande cykel
                </Text>
              </Pressable>
              <Pressable
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedTimeRange('4w');
                  setShowTimeRangeDropdown(false);
                }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  selectedTimeRange === '4w' && styles.dropdownItemTextActive
                ]}>
                  Senaste 4 veckorna
                </Text>
              </Pressable>
              <Pressable
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedTimeRange('3m');
                  setShowTimeRangeDropdown(false);
                }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  selectedTimeRange === '3m' && styles.dropdownItemTextActive
                ]}>
                  Senaste 3 månaderna
                </Text>
              </Pressable>
              <Pressable
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedTimeRange('6m');
                  setShowTimeRangeDropdown(false);
                }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  selectedTimeRange === '6m' && styles.dropdownItemTextActive
                ]}>
                  Senaste 6 månaderna
                </Text>
              </Pressable>
              <Pressable
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedTimeRange('1y');
                  setShowTimeRangeDropdown(false);
                }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  selectedTimeRange === '1y' && styles.dropdownItemTextActive
                ]}>
                  Senaste året
                </Text>
              </Pressable>
              <Pressable
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedTimeRange('all');
                  setShowTimeRangeDropdown(false);
                }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  selectedTimeRange === 'all' && styles.dropdownItemTextActive
                ]}>
                  All tid
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={fetchWeightData}>
              <Text style={styles.retryButtonText}>Försök igen</Text>
            </Pressable>
          </View>
        ) : weightData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Ingen viktdata loggad än</Text>
          </View>
        ) : (
          <>
            <View style={styles.chartContainer}>
              {selectedTimeRange === 'cycle' && cycleGoal && (
                <View style={styles.cycleInfo}>
                  <Text style={styles.cycleGoal}>{cycleGoal}</Text>
                </View>
              )}

              <LineChart
                data={getChartData()!}
                width={screenWidth - 48}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                yAxisLabel=""
                yAxisSuffix=" kg"
              />
            </View>

            <ScrollView style={styles.weightList}>
              {weightData.slice(-5).reverse().map((weight) => (
                <Pressable 
                  key={weight.id} 
                  style={styles.weightItem}
                  onPress={() => setSelectedWeight(weight)}
                >
                  <View style={styles.weightInfo}>
                    <Text style={styles.weightValue}>{weight.weight_kg} kg</Text>
                    <Text style={styles.weightDate}>
                      {new Date(weight.date).toLocaleDateString('sv-SE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </Text>
                  </View>
                  <View style={styles.weightActions}>
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
                        setSelectedWeight(weight);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <Trash2 size={20} color="#FF4444" />
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
      </View>

      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ta bort vikt?</Text>
            <Text style={styles.modalText}>
              Är du säker på att du vill ta bort denna viktregistrering?
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                <Text style={styles.cancelButtonText}>Avbryt</Text>
              </Pressable>

              <Pressable
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleDeleteWeight}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteButtonText}>Ta bort</Text>
                )}
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
  filters: {
    marginBottom: 24,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  dropdownText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  dropdownIcon: {
    transform: [{ rotate: '0deg' }],
  },
  dropdownIconActive: {
    transform: [{ rotate: '180deg' }],
  },
  dropdownMenu: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  dropdownItemText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  dropdownItemTextActive: {
    color: '#009dff',
    fontFamily: 'Inter-SemiBold',
  },
  chartContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  cycleInfo: {
    padding: 12,
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
  weightList: {
    flex: 1,
  },
  weightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  weightInfo: {
    flex: 1,
  },
  weightValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  weightDate: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  weightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#262626',
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
});