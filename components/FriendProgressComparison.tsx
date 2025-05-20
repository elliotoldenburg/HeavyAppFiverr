import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { LineChart } from 'react-native-chart-kit';
import { X, TrendingUp, TrendingDown, Target, Dumbbell } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { TrainingProfile } from '@/types/database.types';

type Props = {
  visible: boolean;
  onClose: () => void;
  exerciseId: string;
  exerciseName: string;
  userProgress: {
    date: string;
    value: number;
  }[];
  graphType: 'volume' | 'estimated1rm' | '1rm';
  timeRange: number | 'cycle' | -1;
};

type Friend = {
  friendship_id: string;
  status: string;
  profile: {
    id: string;
    full_name: string;
    username: string | null;
    profile_image_url: string | null;
  };
};

type FriendProgress = {
  workout_date: string;
  weight: number;
  reps: number;
  volume: number;
  estimated_1rm: number | null;
};

export default function FriendProgressComparison({
  visible,
  onClose,
  exerciseId,
  exerciseName,
  userProgress,
  graphType,
  timeRange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [friendProgress, setFriendProgress] = useState<FriendProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      fetchFriends();
    }
  }, [visible]);

  useEffect(() => {
    if (selectedFriend) {
      fetchFriendProgress();
    }
  }, [selectedFriend]);

  const fetchFriends = async () => {
    try {
      const { data, error: friendsError } = await supabase
        .rpc('get_friends_with_profiles', { include_pending: false });

      if (friendsError) throw friendsError;
      setFriends(data || []);
    } catch (err) {
      console.error('Error fetching friends:', err);
      setError('Kunde inte hämta vänlista');
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendProgress = async () => {
    if (!selectedFriend?.profile?.id) return;

    try {
      setLoading(true);
      
      let startDate: string | null = null;
      if (timeRange !== -1 && timeRange !== 'cycle') {
        const date = new Date();
        date.setDate(date.getDate() - (timeRange * 7));
        startDate = date.toISOString().split('T')[0];
      }

      const { data, error: progressError } = await supabase
        .rpc('get_friend_progress', {
          p_friend_id: selectedFriend.profile.id,
          p_exercise_id: exerciseId,
          p_start_date: startDate
        });

      if (progressError) throw progressError;
      setFriendProgress(data || []);
    } catch (err) {
      console.error('Error fetching friend progress:', err);
      setError('Kunde inte hämta vännens träningsdata');
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
    if (!selectedFriend?.profile?.full_name) return null;

    const friendData = friendProgress.map(p => ({
      date: p.workout_date,
      value: graphType === 'volume' ? p.volume :
             graphType === 'estimated1rm' ? (p.estimated_1rm || 0) :
             p.weight
    }));

    return {
      labels: [...new Set([...userProgress, ...friendData].map(d => formatDate(d.date)))],
      datasets: [
        {
          data: userProgress.map(d => d.value),
          color: (opacity = 1) => `rgba(0, 157, 255, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: friendData.map(d => d.value),
          color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
          strokeWidth: 2,
        }
      ],
      legend: ['Din progress', `${selectedFriend.profile.full_name}s progress`]
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

  // Create a web-safe version of the chart config that doesn't include responder props
  const webSafeChartConfig = Platform.OS === 'web' 
    ? {
        ...chartConfig,
        // Remove any responder props that might cause warnings on web
        propsForDots: {
          r: '6',
          strokeWidth: '2',
          stroke: '#1A1A1A'
        }
      }
    : chartConfig;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedFriend ? 'Jämför progress' : 'Välj vän'}
            </Text>
            <Pressable
              style={styles.closeButton}
              onPress={() => {
                setSelectedFriend(null);
                onClose();
              }}
            >
              <X size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#009dff" />
            </View>
          ) : !selectedFriend ? (
            <ScrollView style={styles.friendList}>
              {friends.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Inga vänner hittades</Text>
                </View>
              ) : (
                friends.map((friend) => (
                  friend?.profile && (
                    <Pressable
                      key={friend.friendship_id}
                      style={styles.friendItem}
                      onPress={() => setSelectedFriend(friend)}
                    >
                      <View style={styles.friendInfo}>
                        {friend.profile.profile_image_url ? (
                          <Image
                            source={{ uri: friend.profile.profile_image_url }}
                            style={styles.friendImage}
                          />
                        ) : (
                          <View style={[styles.friendImage, styles.defaultFriendImage]} />
                        )}
                        <View>
                          <Text style={styles.friendName}>{friend.profile.full_name}</Text>
                          {friend.profile.username && (
                            <Text style={styles.friendUsername}>@{friend.profile.username}</Text>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  )
                ))
              )}
            </ScrollView>
          ) : (
            <View style={styles.comparisonContainer}>
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{exerciseName}</Text>
                <View style={styles.legendContainer}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, styles.yourColor]} />
                    <Text style={styles.legendText}>Din progress</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendColor, styles.friendColor]} />
                    <Text style={styles.legendText}>{selectedFriend.profile.full_name}s progress</Text>
                  </View>
                </View>
              </View>

              {getChartData() && (
                <View style={styles.chartContainer}>
                  <LineChart
                    data={getChartData()!}
                    width={Platform.OS === 'web' ? 600 : 350}
                    height={220}
                    chartConfig={webSafeChartConfig}
                    bezier
                    style={styles.chart}
                    withVerticalLines={false}
                    withHorizontalLines={true}
                    withVerticalLabels={true}
                    withHorizontalLabels={true}
                    fromZero={true}
                    yAxisSuffix={graphType === 'volume' ? ' kg' : ' kg'}
                  />
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    margin: 24,
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  friendList: {
    padding: 24,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#808080',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  defaultFriendImage: {
    backgroundColor: '#333333',
  },
  friendName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  friendUsername: {
    color: '#009dff',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  comparisonContainer: {
    padding: 24,
  },
  exerciseInfo: {
    marginBottom: 24,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    gap: 16,
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
  yourColor: {
    backgroundColor: '#009dff',
  },
  friendColor: {
    backgroundColor: '#EF4444',
  },
  legendText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  chartContainer: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
});