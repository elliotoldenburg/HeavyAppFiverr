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
import { ArrowLeft, TrendingUp, TrendingDown, Scale } from 'lucide-react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';

type WeightData = {
  date: string;
  weight_kg: number;
};

export default function WeightComparisonScreen() {
  const { friendId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [friendName, setFriendName] = useState('');
  const [userWeights, setUserWeights] = useState<WeightData[]>([]);
  const [friendWeights, setFriendWeights] = useState<WeightData[]>([]);
  const [timeRange, setTimeRange] = useState<number>(12); // 12 weeks default

  useEffect(() => {
    if (!friendId) {
      router.back();
      return;
    }
    
    fetchFriendInfo();
    fetchWeightData();
  }, [friendId, timeRange]);

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

  const fetchWeightData = async () => {
    try {
      setLoading(true);
      
      // Calculate start date based on time range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (timeRange * 7));
      const startDateStr = startDate.toISOString().split('T')[0];
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');
      
      // Fetch user's weight data
      const { data: userData, error: userError } = await supabase
        .from('weight_tracking')
        .select('date, weight_kg')
        .eq('user_id', user.id)
        .gte('date', startDateStr)
        .order('date');
        
      if (userError) throw userError;
      
      // Fetch friend's weight data
      const { data: friendData, error: friendError } = await supabase
        .from('weight_tracking')
        .select('date, weight_kg')
        .eq('user_id', friendId)
        .gte('date', startDateStr)
        .order('date');
        
      if (friendError) throw friendError;
      
      setUserWeights(userData || []);
      setFriendWeights(friendData || []);
    } catch (err) {
      console.error('Error fetching weight data:', err);
      setError('Kunde inte hämta viktdata');
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
      ...userWeights.map(w => w.date),
      ...friendWeights.map(w => w.date)
    ])].sort();
    
    return {
      labels: allDates.map(date => formatDate(date)),
      datasets: [
        {
          data: userWeights.map(w => w.weight_kg),
          color: (opacity = 1) => `rgba(0, 157, 255, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: friendWeights.map(w => w.weight_kg),
          color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
          strokeWidth: 2,
        }
      ],
      legend: ['Din vikt', `${friendName}s vikt`]
    };
  };

  // Create a web-safe version of the chart config that doesn't include responder props
  const webSafeChartConfig = {
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

  const calculateWeightChange = (data: WeightData[]) => {
    if (data.length < 2) return { change: 0, percentage: 0, isPositive: true };
    
    const firstWeight = data[0].weight_kg;
    const lastWeight = data[data.length - 1].weight_kg;
    const change = lastWeight - firstWeight;
    const percentage = firstWeight > 0 ? (change / firstWeight) * 100 : 0;
    
    return {
      change: Math.round(change * 10) / 10, // Round to 1 decimal
      percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
      isPositive: change >= 0
    };
  };

  const userWeightChange = calculateWeightChange(userWeights);
  const friendWeightChange = calculateWeightChange(friendWeights);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>Jämför vikt</Text>
      </View>

      <ScrollView style={styles.content}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#009dff" />
          </View>
        ) : (
          <>
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

            {userWeights.length === 0 || friendWeights.length === 0 ? (
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
                      <Text style={styles.legendText}>Din vikt</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendColor, { backgroundColor: '#EF4444' }]} />
                      <Text style={styles.legendText}>{friendName}s vikt</Text>
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

                <View style={styles.weightSummary}>
                  <View style={styles.weightCard}>
                    <View style={styles.weightCardHeader}>
                      <Scale size={20} color="#FFFFFF" />
                      <Text style={styles.weightCardTitle}>Din viktförändring</Text>
                    </View>
                    <View style={styles.weightCardContent}>
                      <Text style={styles.currentWeight}>
                        {userWeights.length > 0 ? userWeights[userWeights.length - 1].weight_kg : 0} kg
                      </Text>
                      <View style={styles.changeIndicator}>
                        {userWeightChange.change !== 0 && (
                          <>
                            {userWeightChange.isPositive ? (
                              <TrendingUp size={20} color="#22C55E" />
                            ) : (
                              <TrendingDown size={20} color="#EF4444" />
                            )}
                            <Text 
                              style={[
                                styles.changeText,
                                { color: userWeightChange.isPositive ? '#22C55E' : '#EF4444' }
                              ]}
                            >
                              {userWeightChange.isPositive ? '+' : ''}{userWeightChange.change} kg
                              ({userWeightChange.isPositive ? '+' : ''}{userWeightChange.percentage}%)
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={styles.weightCard}>
                    <View style={styles.weightCardHeader}>
                      <Scale size={20} color="#FFFFFF" />
                      <Text style={styles.weightCardTitle}>{friendName}s viktförändring</Text>
                    </View>
                    <View style={styles.weightCardContent}>
                      <Text style={styles.currentWeight}>
                        {friendWeights.length > 0 ? friendWeights[friendWeights.length - 1].weight_kg : 0} kg
                      </Text>
                      <View style={styles.changeIndicator}>
                        {friendWeightChange.change !== 0 && (
                          <>
                            {friendWeightChange.isPositive ? (
                              <TrendingUp size={20} color="#22C55E" />
                            ) : (
                              <TrendingDown size={20} color="#EF4444" />
                            )}
                            <Text 
                              style={[
                                styles.changeText,
                                { color: friendWeightChange.isPositive ? '#22C55E' : '#EF4444' }
                              ]}
                            >
                              {friendWeightChange.isPositive ? '+' : ''}{friendWeightChange.change} kg
                              ({friendWeightChange.isPositive ? '+' : ''}{friendWeightChange.percentage}%)
                            </Text>
                          </>
                        )}
                      </View>
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
  sectionTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
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
  weightSummary: {
    gap: 16,
    marginBottom: 24,
  },
  weightCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  weightCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  weightCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  weightCardContent: {
    alignItems: 'center',
  },
  currentWeight: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changeText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});