import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  LogOut, 
  Calendar, 
  ChevronRight, 
  History, 
  Plus,
  Scale, 
  Dumbbell, 
  TrendingDown, 
  TrendingUp, 
  Target, 
  Instagram,
  BookText as TikTok,
  Sparkles
} from 'lucide-react-native';
import type { TrainingProfile, TrainingCycle } from '@/types/database.types';
import ProfileImagePicker from '@/components/ProfileImagePicker';
import BannerImagePicker from '@/components/BannerImagePicker';
import WorkoutLogger from '@/components/WorkoutLogger';
import WorkoutHistory from '@/components/WorkoutHistory';
import ProgressGraphs from '@/components/ProgressGraphs';
import WeightProgress from '@/components/WeightProgress';
import WeightLogger from '@/components/WeightLogger';
import TrainingCycleCard from '@/components/TrainingCycleCard';
import { queryClient } from '@/lib/queryClient';
import { fetchLastWeight } from '@/lib/hooks/useLastWeight';
import Protected from '@/components/Protected';

type ActiveView = 'profile' | 'logger' | 'history' | 'graphs' | 'weight' | 'weight-log';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<TrainingProfile | null>(null);
  const [activeCycle, setActiveCycle] = useState<TrainingCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('profile');
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Use a ref to track if the component is mounted
  const isMountedRef = React.useRef(true);

  useEffect(() => {
    // Set the ref to true when the component mounts
    isMountedRef.current = true;
    
    fetchProfileData();
    
    // Set up real-time subscription for training cycles with debounce
    let debounceTimeout: NodeJS.Timeout | null = null;
    
    const cycleSubscription = supabase
      .channel('training_cycles_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'training_cycles'
      }, () => {
        console.log('Training cycle change detected, refreshing...');
        
        // Clear any existing timeout
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }
        
        // Set a new timeout to debounce multiple rapid changes
        debounceTimeout = setTimeout(() => {
          if (isMountedRef.current) {
            fetchProfileData();
          }
        }, 300);
      })
      .subscribe();
      
    return () => {
      // Set the ref to false when the component unmounts
      isMountedRef.current = false;
      
      // Clear any pending timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      
      // Unsubscribe from the channel
      cycleSubscription.unsubscribe();
    };
  }, []);

  const fetchProfileData = useCallback(async () => {
    // Don't proceed if component is unmounted
    if (!isMountedRef.current) return;
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) {
        router.replace('/(auth)/welcome');
        return;
      }

      // Prefetch last weight data
      queryClient.prefetchQuery(['lastWeight'], fetchLastWeight);

      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('training_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.warn('Error fetching profile data:', profileError);
        if (!profileData) {
          router.replace('/(auth)/onboarding/info');
          return;
        }
      }
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setProfile(profileData);
      }

      // Fetch active training cycle with explicit handling for no results
      const { data: cycleData, error: cycleError } = await supabase
        .from('training_cycles')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle();

      if (cycleError && !cycleError.message.includes('contains 0 rows')) {
        console.warn('Error fetching cycle data:', cycleError);
      }
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setActiveCycle(cycleData); // Will be null if no active cycle exists
      }

      // Check subscription status
      const { data: subscriptionData } = await supabase
        .from('stripe_user_subscriptions')
        .select('subscription_status')
        .maybeSingle();
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setIsSubscribed(
          subscriptionData?.subscription_status === 'active' || 
          subscriptionData?.subscription_status === 'trialing'
        );
      }

    } catch (err) {
      console.warn('Error in fetchProfileData:', err);
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setError('Kunde inte ladda profildata');
      }
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/welcome');
  };

  const handleProfileImageUpdate = (url: string | null) => {
    if (profile) {
      setProfile({ ...profile, profile_image_url: url });
    }
  };

  const handleBannerImageUpdate = (url: string | null) => {
    if (profile) {
      setProfile({ ...profile, banner_image_url: url });
    }
  };

  const handleSocialMediaPress = async (url: string | null) => {
    if (!url) return;

    try {
      if (Platform.OS === 'web') {
        // For web, use window.open in a new tab
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        // For native platforms, check if URL can be opened first
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          console.warn('Cannot open URL:', url);
        }
      }
    } catch (err) {
      // Ignore the "Network request failed" error since it's a false positive
      if (err instanceof Error && !err.message.includes('Network request failed')) {
        console.warn('Error opening URL:', err);
      }
    }
  };

  // Acceptera en parameter från WeightLogger för att direkt visa WeightProgress
  const handleWeightLoggerClose = (nextView?: string) => {
    if (nextView === 'weight') {
      setActiveView('weight');
    } else {
      setActiveView('profile');
    }
    fetchProfileData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#009dff" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Profilen kunde inte hittas'}</Text>
        <Pressable style={styles.retryButton} onPress={fetchProfileData}>
          <Text style={styles.retryButtonText}>Försök igen</Text>
        </Pressable>
      </View>
    );
  }

  const renderContent = () => {
    switch (activeView) {
      case 'logger':
        return (
          <WorkoutLogger
            onClose={() => setActiveView('profile')}
            onWorkoutLogged={() => {
              setActiveView('profile');
              fetchProfileData();
            }}
          />
        );
      case 'history':
        return (
          <WorkoutHistory
            onClose={() => setActiveView('profile')}
            onWorkoutUpdated={fetchProfileData}
          />
        );
      case 'graphs':
        return (
          <ProgressGraphs
            onClose={() => setActiveView('profile')}
          />
        );
      case 'weight':
        return (
          <WeightProgress
            onClose={() => setActiveView('profile')}
          />
        );
      case 'weight-log':
        return (
          <WeightLogger
            onClose={handleWeightLoggerClose}
          />
        );
      default:
        return (
          <Protected>
            <ScrollView style={styles.container}>
              <View style={styles.bannerContainer}>
                <BannerImagePicker
                  currentImageUrl={profile.banner_image_url}
                  onImageUpdate={handleBannerImageUpdate}
                />
                <LinearGradient
                  colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
                  style={styles.bannerGradient}
                />
                <View style={styles.profileImageContainer}>
                  <ProfileImagePicker
                    currentImageUrl={profile.profile_image_url}
                    onImageUpdate={handleProfileImageUpdate}
                  />
                </View>
              </View>

              <View style={styles.content}>
                <View style={styles.userInfoContainer}>
                  <Text style={styles.name}>{profile.full_name}</Text>
                  <View style={styles.socialLinks}>
                    {profile.instagram_url && (
                      <Pressable
                        style={styles.socialButton}
                        onPress={() => handleSocialMediaPress(profile.instagram_url)}
                      >
                        <Instagram size={20} color="#808080" />
                      </Pressable>
                    )}
                    {profile.tiktok_url && (
                      <Pressable
                        style={styles.socialButton}
                        onPress={() => handleSocialMediaPress(profile.tiktok_url)}
                      >
                        <TikTok size={20} color="#808080" />
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Subscription Status */}
                <Pressable 
                  style={styles.subscriptionCard}
                  onPress={() => router.push('/subscription')}
                >
                  <View style={styles.subscriptionIconContainer}>
                    <Sparkles size={24} color="#FFD700" />
                  </View>
                  <View style={styles.subscriptionInfo}>
                    <Text style={styles.subscriptionTitle}>
                      Premium Aktivt
                    </Text>
                    <Text style={styles.subscriptionDescription}>
                      Du har tillgång till alla premium-funktioner
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#FFFFFF" />
                </Pressable>

                {/* Training Cycle Section */}
                {activeCycle ? (
                  <TrainingCycleCard 
                    cycle={activeCycle} 
                    onUpdate={fetchProfileData} 
                  />
                ) : (
                  <Pressable
                    style={styles.newCycleButton}
                    onPress={() => router.push('/profile/new-cycle')}
                  >
                    <Target size={24} color="#FFFFFF" />
                    <Text style={styles.newCycleButtonText}>Starta ny träningscykel</Text>
                  </Pressable>
                )}

                {/* Quick Actions */}
                <View style={styles.quickActions}>
                  <Pressable 
                    style={styles.actionButton}
                    onPress={() => {
                      // Prefetch last weight data before navigating
                      queryClient.prefetchQuery(['lastWeight'], fetchLastWeight);
                      setActiveView('weight-log');
                    }}
                  >
                    <Scale size={24} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Logga vikt</Text>
                  </Pressable>

                  <Pressable 
                    style={styles.actionButton}
                    onPress={() => setActiveView('logger')}
                  >
                    <Plus size={24} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Logga pass</Text>
                  </Pressable>

                  <View style={styles.actionRow}>
                    <Pressable 
                      style={[styles.actionButton, styles.halfButton]}
                      onPress={() => setActiveView('history')}
                    >
                      <History size={20} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Träningshistorik</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Progress Cards */}
                <View style={styles.progressCards}>
                  {/* Training Progress Card */}
                  <Pressable 
                    style={styles.progressCard}
                    onPress={() => setActiveView('graphs')}
                  >
                    <LinearGradient
                      colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.progressCardContent}>
                      <Dumbbell size={32} color="#FFFFFF" />
                      <Text style={styles.progressCardTitle}>Träningsutveckling</Text>
                      <Text style={styles.progressCardDescription}>
                        Följ din utveckling i styrka och volym
                      </Text>
                      <ChevronRight size={24} color="#FFFFFF" />
                    </View>
                  </Pressable>

                  {/* Weight Progress Card */}
                  <Pressable 
                    style={styles.progressCard}
                    onPress={() => setActiveView('weight')}
                  >
                    <LinearGradient
                      colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.progressCardContent}>
                      <Scale size={32} color="#FFFFFF" />
                      <Text style={styles.progressCardTitle}>Viktutveckling</Text>
                      <Text style={styles.progressCardDescription}>
                        Följ din viktförändring över tid
                      </Text>
                      <ChevronRight size={24} color="#FFFFFF" />
                    </View>
                  </Pressable>
                </View>

                {/* Sign Out Button */}
                <Pressable
                  style={styles.signOutButton}
                  onPress={handleSignOut}
                >
                  <LogOut size={20} color="#FF4444" />
                  <Text style={styles.signOutText}>Logga ut</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Protected>
        );
    }
  };

  return renderContent();
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#000000',
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
  bannerContainer: {
    height: 240,
    width: '100%',
    position: 'relative',
  },
  bannerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  profileImageContainer: {
    position: 'absolute',
    bottom: -60,
    left: '50%',
    marginLeft: -60, // Half of width
    zIndex: 10,
  },
  content: {
    padding: 24,
    paddingTop: 72, // Account for profile image overflow
  },
  userInfoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  name: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 12,
  },
  socialLinks: {
    flexDirection: 'row',
    gap: 16,
  },
  socialButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  subscriptionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  subscriptionDescription: {
    fontSize: 12,
    color: '#B0B0B0',
    fontFamily: 'Inter-Regular',
  },
  newCycleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  newCycleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  quickActions: {
    gap: 16,
    marginBottom: 32,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#009dff',
    padding: 16,
    borderRadius: 12,
  },
  halfButton: {
    flex: 1,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  progressCards: {
    gap: 16,
    marginBottom: 32,
  },
  progressCard: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1A1A1A',
  },
  progressCardContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  progressCardTitle: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginTop: 12,
    marginBottom: 8,
  },
  progressCardDescription: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    marginBottom: 16,
    opacity: 0.9,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    marginTop: 24,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  signOutText: {
    color: '#FF4444',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});