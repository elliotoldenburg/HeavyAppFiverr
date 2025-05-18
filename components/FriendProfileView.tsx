import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Linking,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Instagram, BookText as TikTok, Target, ArrowLeft, MoveVertical as MoreVertical, Calendar, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

type Props = {
  profile: {
    user_id: string;
    full_name: string;
    username?: string | null;
    profile_image_url: string | null;
    banner_image_url?: string | null;
    training_goal?: string | null;
    instagram_url?: string | null;
    tiktok_url?: string | null;
  };
  onClose: () => void;
  onStatusChange?: () => void;
};

type FullProfile = {
  user_id: string;
  full_name: string;
  username: string | null;
  profile_image_url: string | null;
  banner_image_url: string | null;
  training_goal: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
};

type TrainingCycle = {
  id: string;
  goal: string;
  start_date: string;
  end_date: string | null;
  active: boolean;
};

type RecentActivity = {
  type: 'workout' | 'achievement';
  date: string;
  title: string;
  description: string;
};

export default function FriendProfileView({ profile, onClose, onStatusChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeCycle, setActiveCycle] = useState<TrainingCycle | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [friendSince, setFriendSince] = useState<string | null>(null);
  const [friendStatus, setFriendStatus] = useState<string>('friend');
  const [fullProfile, setFullProfile] = useState<FullProfile | null>(null);
  const [loadingFullProfile, setLoadingFullProfile] = useState(true);

  useEffect(() => {
    // Hämta fullständig profildata direkt från databasen
    const fetchFullProfile = async () => {
      setLoadingFullProfile(true);
      try {
        const { data, error } = await supabase
          .from('training_profiles')
          .select(`
            user_id,
            full_name,
            username,
            profile_image_url,
            banner_image_url,
            training_goal,
            instagram_url,
            tiktok_url
          `)
          .eq('user_id', profile.user_id)
          .single();
          
        if (error) {
          console.error('Error fetching full profile:', error);
        } else {
          console.log('Fetched full profile:', data);
          setFullProfile(data);
        }
      } catch (err) {
        console.error('Exception fetching full profile:', err);
      } finally {
        setLoadingFullProfile(false);
      }
    };
    
    fetchFullProfile();
    fetchFriendData();
    
    // Set up real-time subscription for friend's workout logs
    const workoutSubscription = supabase
      .channel('friend_workout_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'workout_logs',
        filter: `user_id=eq.${profile.user_id}`
      }, () => {
        console.log('Friend workout change detected, refreshing...');
        fetchFriendData();
      })
      .subscribe();
      
    // Set up real-time subscription for friend's training cycles
    const cycleSubscription = supabase
      .channel('friend_cycle_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'training_cycles',
        filter: `user_id=eq.${profile.user_id}`
      }, () => {
        console.log('Friend cycle change detected, refreshing...');
        fetchFriendData();
      })
      .subscribe();
    
    // Set up real-time subscription for friendship status
    const friendsSubscription = supabase
      .channel('friendship-status-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friends'
      }, () => {
        console.log('Friendship change detected, checking if it affects this relationship...');
        checkFriendshipStatus();
      })
      .subscribe();
    
    return () => {
      workoutSubscription.unsubscribe();
      cycleSubscription.unsubscribe();
      friendsSubscription.unsubscribe();
    };
  }, [profile.user_id]);

  const fetchFriendData = async () => {
    try {
      setLoading(true);
      
      // Fetch active training cycle
      const { data: cycleData, error: cycleError } = await supabase
        .from('training_cycles')
        .select('*')
        .eq('user_id', profile.user_id)
        .eq('active', true)
        .maybeSingle();

      if (cycleError) {
        console.error("Error fetching friend's training cycle:", cycleError);
      } else {
        setActiveCycle(cycleData);
      }

      // Fetch recent workouts
      const { data: workoutData, error: workoutError } = await supabase
        .from('workout_logs')
        .select(`
          id,
          date,
          name,
          exercise_logs (
            id,
            exercise_id,
            ovningar (name, category)
          )
        `)
        .eq('user_id', profile.user_id)
        .order('date', { ascending: false })
        .limit(3);

      if (workoutError) {
        console.error("Error fetching friend's workouts:", workoutError);
      } else if (workoutData) {
        // Transform workout data into activity items
        const activities: RecentActivity[] = workoutData.map(workout => {
          const categories = workout.exercise_logs
            ?.map(log => log.ovningar?.category)
            .filter((value, index, self) => value && self.indexOf(value) === index);
          
          const categoryText = categories?.length 
            ? categories.join(', ') 
            : 'Träning';

          return {
            type: 'workout',
            date: workout.date,
            title: workout.name || 'Träningspass',
            description: `Tränade ${categoryText}`
          };
        });

        setRecentActivity(activities);
      }

      // Fetch friendship date - using maybeSingle to avoid 406 errors
      try {
        const { data: friendData, error: friendError } = await supabase
          .from('friends')
          .select('created_at')
          .eq('user_id', await getCurrentUserId())
          .eq('friend_id', profile.user_id)
          .maybeSingle();

        if (!friendError && friendData) {
          setFriendSince(friendData.created_at);
        }
      } catch (err) {
        console.warn('Error fetching friendship date:', err);
        // Continue execution even if this fails
      }

    } catch (err) {
      console.error('Error fetching friend data:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkFriendshipStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if they are still friends
      const { data, error } = await supabase.rpc('check_friendship_status', {
        auth_user_id: user.id,
        other_user_id: profile.user_id
      });

      if (error) {
        console.error('Error checking friendship status:', error);
        return;
      }

      console.log('Current friendship status:', data);
      setFriendStatus(data);
      
      // If they're no longer friends, notify parent component
      if (data !== 'friend' && onStatusChange) {
        console.log('Friendship status changed, notifying parent');
        onStatusChange();
      }
    } catch (err) {
      console.error('Error checking friendship status:', err);
    }
  };

  const getCurrentUserId = async (): Promise<string> => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || '';
  };

  const handleSocialMediaPress = async (url: string | null) => {
    if (!url) return;

    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        }
      }
    } catch (err) {
      console.warn('Error opening URL:', err);
    }
  };

  const navigateToTrainingComparison = () => {
    // Navigate to training comparison screen
    router.push({
      pathname: '/comparison/training',
      params: { friendId: profile.user_id }
    });
  };

  const navigateToWeightComparison = () => {
    // Navigate to weight comparison screen
    router.push({
      pathname: '/comparison/weight',
      params: { friendId: profile.user_id }
    });
  };

  const handleRemoveFriend = async () => {
    try {
      // Show confirmation dialog
      Alert.alert(
        "Ta bort vän",
        `Är du säker på att du vill ta bort ${profile.full_name} som vän?`,
        [
          {
            text: "Avbryt",
            style: "cancel"
          },
          {
            text: "Ta bort",
            style: "destructive",
            onPress: async () => {
              const { data, error } = await supabase.rpc('remove_friend', {
                p_other_user_id: profile.user_id
              });
              
              if (error) {
                console.error('Error removing friend:', error);
                Alert.alert('Fel', 'Kunde inte ta bort vännen. Försök igen senare.');
                return;
              }
              
              if (data?.success) {
                // Navigate back to friends list
                onClose();
                
                // Notify parent component of status change
                if (onStatusChange) {
                  onStatusChange();
                }
              }
            }
          }
        ]
      );
    } catch (err) {
      console.error('Error removing friend:', err);
      Alert.alert('Fel', 'Kunde inte ta bort vännen. Försök igen senare.');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'd MMMM yyyy', { locale: sv });
    } catch (e) {
      return 'Okänt datum';
    }
  };

  // Visa laddningsindikator medan vi hämtar fullständig profildata
  if (loadingFullProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#009dff" />
        <Text style={styles.loadingText}>Laddar profil...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.bannerContainer}>
          {fullProfile?.banner_image_url ? (
            <Image
              source={{ uri: fullProfile.banner_image_url }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['rgba(0,157,255,0.1)', 'rgba(0,0,0,1)']}
              style={styles.bannerGradient}
            />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
            style={styles.bannerOverlay}
          />
          <Pressable style={styles.backButton} onPress={onClose}>
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable style={styles.menuButton} onPress={() => setShowMenu(!showMenu)}>
            <MoreVertical size={24} color="#FFFFFF" />
          </Pressable>
          
          {showMenu && (
            <View style={styles.menuContainer}>
              <Pressable 
                style={styles.menuItem}
                onPress={handleRemoveFriend}
              >
                <Text style={styles.menuItemText}>Ta bort vän</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.profileImageContainer}>
          {fullProfile?.profile_image_url ? (
            <Image
              source={{ uri: fullProfile.profile_image_url }}
              style={styles.profileImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.profileImage, styles.defaultProfileImage]} />
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.headerSection}>
            <Text style={styles.name}>{fullProfile?.full_name}</Text>
            
            {fullProfile?.username && (
              <Text style={styles.username}>@{fullProfile.username}</Text>
            )}

            <View style={styles.socialLinks}>
              {fullProfile?.instagram_url && (
                <Pressable
                  style={styles.socialButton}
                  onPress={() => handleSocialMediaPress(fullProfile.instagram_url)}
                >
                  <Instagram size={20} color="#808080" />
                </Pressable>
              )}
              {fullProfile?.tiktok_url && (
                <Pressable
                  style={styles.socialButton}
                  onPress={() => handleSocialMediaPress(fullProfile.tiktok_url)}
                >
                  <TikTok size={20} color="#808080" />
                </Pressable>
              )}
            </View>

            {friendSince && (
              <Text style={styles.friendSince}>
                Vänner sedan {formatDate(friendSince)}
              </Text>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#009dff" />
            </View>
          ) : (
            <>
              {/* Training Cycle Card */}
              {activeCycle ? (
                <View style={styles.cycleCard}>
                  <View style={styles.cycleHeader}>
                    <Target size={24} color="#009dff" />
                    <Text style={styles.cycleTitle}>Aktuellt träningsmål</Text>
                  </View>
                  <Text style={styles.cycleGoal}>{activeCycle.goal}</Text>
                  <View style={styles.cycleDateContainer}>
                    <Calendar size={16} color="#808080" />
                    <Text style={styles.cycleDateText}>
                      Startade {formatDate(activeCycle.start_date)}
                    </Text>
                  </View>
                </View>
              ) : fullProfile?.training_goal ? (
                <View style={styles.cycleCard}>
                  <View style={styles.cycleHeader}>
                    <Target size={24} color="#009dff" />
                    <Text style={styles.cycleTitle}>Aktuellt träningsmål</Text>
                  </View>
                  <Text style={styles.cycleGoal}>{fullProfile.training_goal}</Text>
                </View>
              ) : (
                <View style={styles.noCycleCard}>
                  <Text style={styles.noCycleText}>
                    {fullProfile?.full_name} har ingen aktiv träningscykel
                  </Text>
                </View>
              )}

              {/* Comparison Cards */}
              <View style={styles.comparisonCards}>
                <Pressable 
                  style={styles.comparisonCard}
                  onPress={navigateToTrainingComparison}
                >
                  <LinearGradient
                    colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.comparisonCardContent}>
                    <View style={styles.cardIconContainer}>
                      <View style={styles.cardIcon}>
                        <Target size={24} color="#FFFFFF" />
                      </View>
                    </View>
                    <View style={styles.cardTextContainer}>
                      <Text style={styles.cardTitle}>Träningsutveckling</Text>
                      <Text style={styles.cardDescription}>
                        Jämför din träningsutveckling med din vän
                      </Text>
                    </View>
                    <ChevronRight size={24} color="#FFFFFF" />
                  </View>
                </Pressable>
                
                <Pressable 
                  style={styles.comparisonCard}
                  onPress={navigateToWeightComparison}
                >
                  <LinearGradient
                    colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.comparisonCardContent}>
                    <View style={styles.cardIconContainer}>
                      <View style={styles.cardIcon}>
                        <Target size={24} color="#FFFFFF" />
                      </View>
                    </View>
                    <View style={styles.cardTextContainer}>
                      <Text style={styles.cardTitle}>Viktutveckling</Text>
                      <Text style={styles.cardDescription}>
                        Jämför din viktutveckling med din vän
                      </Text>
                    </View>
                    <ChevronRight size={24} color="#FFFFFF" />
                  </View>
                </Pressable>
              </View>

              {/* Recent Activity */}
              {recentActivity.length > 0 && (
                <View style={styles.activitySection}>
                  <Text style={styles.sectionTitle}>Senaste aktivitet</Text>
                  
                  {recentActivity.map((activity, index) => (
                    <View key={index} style={styles.activityCard}>
                      <View style={styles.activityHeader}>
                        <Text style={styles.activityTitle}>{activity.title}</Text>
                        <Text style={styles.activityDate}>
                          {formatDate(activity.date)}
                        </Text>
                      </View>
                      <Text style={styles.activityDescription}>
                        {activity.description}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  bannerContainer: {
    height: 200,
    width: '100%',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  menuButton: {
    position: 'absolute',
    top: 48,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  menuContainer: {
    position: 'absolute',
    top: 96,
    right: 24,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 8,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  menuItemText: {
    color: '#FF4444',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  profileImageContainer: {
    position: 'absolute',
    top: 120,
    left: '50%',
    marginLeft: -50,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#009dff',
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    zIndex: 10,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  defaultProfileImage: {
    backgroundColor: '#262626',
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 48,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  name: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
    textAlign: 'center',
  },
  username: {
    fontSize: 16,
    color: '#009dff',
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
    textAlign: 'center',
  },
  friendSince: {
    fontSize: 14,
    color: '#808080',
    fontFamily: 'Inter-Regular',
    marginBottom: 16,
    textAlign: 'center',
  },
  socialLinks: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
    padding: 8,
    minHeight: 40,
  },
  socialButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginTop: 16,
  },
  cycleCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  cycleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cycleTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  cycleGoal: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    marginBottom: 16,
    lineHeight: 24,
  },
  cycleDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cycleDateText: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  noCycleCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  noCycleText: {
    color: '#808080',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  comparisonCards: {
    gap: 16,
    marginBottom: 24,
  },
  comparisonCard: {
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1A1A1A',
  },
  comparisonCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardIconContainer: {
    marginRight: 16,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,157,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#B0B0B0',
    fontFamily: 'Inter-Regular',
  },
  activitySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  activityCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  activityDate: {
    fontSize: 14,
    color: '#808080',
    fontFamily: 'Inter-Regular',
  },
  activityDescription: {
    fontSize: 14,
    color: '#B0B0B0',
    fontFamily: 'Inter-Regular',
  },
  friendActionContainer: {
    marginTop: 16,
    marginBottom: 32,
  },
});