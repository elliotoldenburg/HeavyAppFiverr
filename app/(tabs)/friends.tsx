import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Search, Users, User, Bell, X, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LimitedProfileView from '@/components/LimitedProfileView';
import FriendProfileView from '@/components/FriendProfileView';
import { debounce } from 'lodash';
import Protected from '@/components/Protected';

type UserProfile = {
  user_id: string;
  full_name: string;
  username: string | null;
  profile_image_url: string | null;
  status: string;
};

type FriendRequest = {
  id: string;
  sender_id: string;
  created_at: string;
  profile: {
    full_name: string;
    username: string;
    profile_image_url: string | null;
  };
};

// Type for profile cache entries
type ProfileCacheEntry = {
  profile: UserProfile;
  status: string;
  timestamp: number;
};

export default function FriendsScreen() {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [showRequests, setShowRequests] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [emptyResults, setEmptyResults] = useState(false);
  const [friendStatus, setFriendStatus] = useState<string>('none');
  const [loadingFriendStatus, setLoadingFriendStatus] = useState(false);
  const [friendStatuses, setFriendStatuses] = useState<Record<string, string>>({});
  const [initialStatusesLoaded, setInitialStatusesLoaded] = useState(false);
  
  // Profile cache to store friendship status and profile data
  const [profileCache, setProfileCache] = useState<Record<string, ProfileCacheEntry>>({});
  
  // Cache expiration time (30 minutes in milliseconds)
  const CACHE_EXPIRATION = 30 * 60 * 1000;

  // Use a ref to track if the component is mounted
  const isMountedRef = React.useRef(true);

  useEffect(() => {
    // Set the ref to true when the component mounts
    isMountedRef.current = true;
    
    fetchPendingRequests();
    getCurrentUserId();
    
    // Set up real-time subscription for friend requests with debounce
    let debounceTimeout: NodeJS.Timeout | null = null;
    
    const friendRequestsSubscription = supabase
      .channel('friend_requests_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friend_requests'
      }, () => {
        console.log('Friend request change detected, refreshing...');
        
        // Clear any existing timeout
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }
        
        // Set a new timeout to debounce multiple rapid changes
        debounceTimeout = setTimeout(() => {
          if (isMountedRef.current) {
            fetchPendingRequests();
          }
        }, 300);
      })
      .subscribe();
      
    // Set up real-time subscription for friends table with debounce
    const friendsSubscription = supabase
      .channel('friends_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friends'
      }, () => {
        console.log('Friends table change detected, refreshing...');
        
        // Clear any existing timeout
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }
        
        // Set a new timeout to debounce multiple rapid changes
        debounceTimeout = setTimeout(() => {
          if (isMountedRef.current) {
            if (searchQuery.length > 0) {
              performSearch(searchQuery);
            }
            if (selectedProfile) {
              checkFriendshipStatus(selectedProfile.user_id).then(status => {
                if (isMountedRef.current) {
                  setFriendStatus(status);
                  
                  // Update cache with new status
                  setProfileCache(prev => ({
                    ...prev,
                    [selectedProfile.user_id]: {
                      profile: selectedProfile,
                      status,
                      timestamp: Date.now()
                    }
                  }));
                }
              });
            }
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
      
      // Unsubscribe from the channels
      friendRequestsSubscription.unsubscribe();
      friendsSubscription.unsubscribe();
    };
  }, []);

  const getCurrentUserId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    } catch (err) {
      console.error('Error getting current user:', err);
    }
  };

  const fetchPendingRequests = async () => {
    if (!isMountedRef.current) return;
    
    try {
      const { data, error: requestsError } = await supabase
        .rpc('get_pending_friend_requests');

      if (requestsError) throw requestsError;
      
      if (isMountedRef.current) {
        setPendingRequests(data || []);
      }
    } catch (err) {
      console.error('Error fetching pending requests:', err);
    }
  };

  const performSearch = useCallback(async (query: string) => {
    if (!query || query.length < 1 || !isMountedRef.current) {
      return;
    }

    if (!currentUserId) {
      setError('User not authenticated');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setEmptyResults(false);
      setInitialStatusesLoaded(false);
      
      const { data, error: searchError } = await supabase
        .rpc('search_users_with_status', {
          auth_user_id: currentUserId,
          search_text: query
        });

      if (searchError) {
        throw searchError;
      }
      
      if (Array.isArray(data)) {
        const formattedResults = data.map(item => ({
          user_id: item.user_id,
          full_name: item.full_name,
          username: item.username,
          profile_image_url: item.profile_image_url,
          status: item.status
        }));
        
        if (isMountedRef.current) {
          setSearchResults(formattedResults);
          setEmptyResults(formattedResults.length === 0);
          
          // Pre-check friendship status for all results before rendering
          const statusPromises = formattedResults.map(user => 
            checkFriendshipStatus(user.user_id)
          );
          
          const statuses = await Promise.all(statusPromises);
          
          if (isMountedRef.current) {
            const statusMap: Record<string, string> = {};
            formattedResults.forEach((user, index) => {
              statusMap[user.user_id] = statuses[index];
            });
            
            setFriendStatuses(statusMap);
            setInitialStatusesLoaded(true);
          }
        }
      } else {
        if (isMountedRef.current) {
          setSearchResults([]);
          setEmptyResults(true);
          setInitialStatusesLoaded(true);
        }
      }
    } catch (err: any) {
      console.error('Search error:', err);
      if (isMountedRef.current) {
        setError(`Kunde inte söka efter användare: ${err.message || 'Okänt fel'}`);
        setSearchResults([]);
        setInitialStatusesLoaded(true);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [currentUserId]);

  // Create a properly memoized debounced search function
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      performSearch(query);
    }, 500),
    [performSearch]
  );

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.length === 0) {
      setSearchResults([]);
      setEmptyResults(false);
      setInitialStatusesLoaded(false);
    } else {
      debouncedSearch(text);
    }
  };

  const handleProfilePress = async (profile: UserProfile) => {
    // Check if we have a valid cached entry
    const cachedEntry = profileCache[profile.user_id];
    const now = Date.now();
    
    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_EXPIRATION)) {
      // Use cached data if it's still valid
      console.log("Using cached profile data for:", profile.full_name);
      setSelectedProfile(cachedEntry.profile);
      setFriendStatus(cachedEntry.status);
      return;
    }
    
    // No valid cache, need to fetch fresh data
    setSelectedProfile(profile);
    setLoadingFriendStatus(true);
    
    // Always check friendship status directly from the database
    const status = await checkFriendshipStatus(profile.user_id);
    
    // Update the cache with fresh data
    setProfileCache(prev => ({
      ...prev,
      [profile.user_id]: {
        profile,
        status,
        timestamp: now
      }
    }));
    
    setFriendStatus(status);
    setLoadingFriendStatus(false);
    
    console.log("Profile selected:", profile.full_name);
    console.log("Friendship status from RPC:", status);
  };

  const handleStatusChange = () => {
    console.log("Status change detected in friends.tsx");
    if (searchQuery.length > 0) {
      performSearch(searchQuery);
    }
    fetchPendingRequests();
    
    // If we have a selected profile, update its friendship status
    // and invalidate the cache for this user
    if (selectedProfile) {
      checkFriendshipStatus(selectedProfile.user_id).then(status => {
        setFriendStatus(status);
        
        // Update cache with new status
        setProfileCache(prev => ({
          ...prev,
          [selectedProfile.user_id]: {
            profile: selectedProfile,
            status,
            timestamp: Date.now()
          }
        }));
      });
    }
  };
  
  const checkFriendshipStatus = async (userId: string): Promise<string> => {
    try {
      console.log("Checking friendship status for user:", userId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 'none';

      // Use the centralized RPC function to check friendship status
      const { data, error } = await supabase.rpc('check_friendship_status', {
        auth_user_id: user.id,
        other_user_id: userId
      });

      if (error) {
        console.error('Error checking friendship status:', error);
        return 'none';
      }

      // Handle the case where no data is returned
      if (data === null) {
        return 'none';
      }

      return data || 'none';
    } catch (err) {
      console.error('Error checking friendship status:', err);
      return 'none';
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('respond_to_friend_request', {
          p_request_id: requestId,
          p_accept: true
        });

      if (error) throw error;

      if (data?.success) {
        // Show notification
        Alert.alert(
          "Vänförfrågan accepterad",
          `Du och ${data.sender_name} är nu vänner!`,
          [{ text: "OK" }]
        );
        
        setPendingRequests(current => 
          current.filter(request => request.id !== requestId)
        );
        
        // Clear cache for the sender to ensure fresh status check
        const request = pendingRequests.find(req => req.id === requestId);
        if (request) {
          setProfileCache(prev => {
            const newCache = {...prev};
            delete newCache[request.sender_id];
            return newCache;
          });
        }
        
        if (searchQuery.length > 0) {
          performSearch(searchQuery);
        }
      }
    } catch (err) {
      console.error('Error accepting friend request:', err);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('respond_to_friend_request', {
          p_request_id: requestId,
          p_accept: false
        });

      if (error) throw error;

      if (data?.success) {
        // Show notification
        Alert.alert(
          "Vänförfrågan avvisad",
          `Du avvisade ${data.sender_name}s vänförfrågan`,
          [{ text: "OK" }]
        );
        
        setPendingRequests(current => 
          current.filter(request => request.id !== requestId)
        );
        
        // Clear cache for the sender to ensure fresh status check
        const request = pendingRequests.find(req => req.id === requestId);
        if (request) {
          setProfileCache(prev => {
            const newCache = {...prev};
            delete newCache[request.sender_id];
            return newCache;
          });
        }
      }
    } catch (err) {
      console.error('Error rejecting friend request:', err);
    }
  };

  const handleCloseProfile = () => {
    setSelectedProfile(null);
    setFriendStatus('none');
  };

  if (selectedProfile) {
    console.log("Rendering profile view. friendStatus:", friendStatus);
    
    // Show loading indicator while checking friendship status
    if (loadingFriendStatus) {
      return (
        <View style={styles.loadingProfileContainer}>
          <ActivityIndicator size="large" color="#009dff" />
          <Text style={styles.loadingText}>Laddar profil...</Text>
        </View>
      );
    }
    
    // Use the friendStatus state to determine which view to show
    return friendStatus === 'friend' ? (
      <FriendProfileView
        profile={selectedProfile}
        onClose={handleCloseProfile}
        onStatusChange={() => {
          console.log("Status change callback from FriendProfileView");
          handleStatusChange();
          checkFriendshipStatus(selectedProfile.user_id);
        }}
      />
    ) : (
      <LimitedProfileView
        profile={selectedProfile}
        onClose={handleCloseProfile}
        onStatusChange={() => {
          console.log("Status change callback from LimitedProfileView");
          handleStatusChange();
          checkFriendshipStatus(selectedProfile.user_id);
        }}
      />
    );
  }

  return (
    <Protected>
      <View style={styles.container}>
        <LinearGradient
          colors={['rgba(0,157,255,0.1)', 'rgba(0,0,0,1)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.3 }}
        />

        {showRequests ? (
          <View style={styles.container}>
            <LinearGradient
              colors={['rgba(0,157,255,0.1)', 'rgba(0,0,0,1)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.3 }}
            />

            <View style={styles.header}>
              <Pressable 
                style={styles.backButton}
                onPress={() => setShowRequests(false)}
              >
                <Text style={styles.backButtonText}>Tillbaka</Text>
              </Pressable>
              <Text style={styles.title}>Vänförfrågningar</Text>
            </View>

            {pendingRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Inga vänförfrågningar</Text>
                <Text style={styles.emptyText}>
                  Du har inga väntande vänförfrågningar just nu
                </Text>
              </View>
            ) : (
              <FlatList
                data={pendingRequests}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.requestsList}
                renderItem={({ item }) => (
                  <View style={styles.requestCard}>
                    <View style={styles.friendInfo}>
                      {item.profile.profile_image_url ? (
                        <Image
                          source={{ uri: item.profile.profile_image_url }}
                          style={styles.profileImage}
                        />
                      ) : (
                        <View style={[styles.profileImage, styles.defaultProfileImage]}>
                          <User size={20} color="#808080" />
                        </View>
                      )}
                      <View>
                        <Text style={styles.friendName}>{item.profile.full_name}</Text>
                        {item.profile.username && (
                          <Text style={styles.friendUsername}>@{item.profile.username}</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.requestActions}>
                      <Pressable 
                        style={[styles.requestButton, styles.rejectButton]}
                        onPress={() => handleRejectRequest(item.id)}
                      >
                        <X size={20} color="#FFFFFF" />
                      </Pressable>
                      <Pressable 
                        style={[styles.requestButton, styles.acceptButton]}
                        onPress={() => handleAcceptRequest(item.id)}
                      >
                        <Check size={20} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        ) : (
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
          >
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <Text style={styles.title}>Vänner</Text>
                <Pressable 
                  style={[
                    styles.notificationButton,
                    pendingRequests.length > 0 && styles.notificationButtonActive
                  ]}
                  onPress={() => setShowRequests(true)}
                >
                  <Bell size={24} color="#FFFFFF" />
                  {pendingRequests.length > 0 && (
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationBadgeText}>{pendingRequests.length}</Text>
                    </View>
                  )}
                </Pressable>
              </View>
              
              <View style={styles.searchContainer}>
                <Search size={20} color="#808080" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Sök efter användare..."
                  placeholderTextColor="#808080"
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <Pressable
                    style={styles.clearButton}
                    onPress={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setEmptyResults(false);
                      setInitialStatusesLoaded(false);
                    }}
                  >
                    <X size={16} color="#808080" />
                  </Pressable>
                )}
              </View>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable style={styles.retryButton} onPress={() => performSearch(searchQuery)}>
                  <Text style={styles.retryButtonText}>Försök igen</Text>
                </Pressable>
              </View>
            ) : loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#009dff" />
                <Text style={styles.loadingText}>Söker...</Text>
              </View>
            ) : searchQuery.length === 0 ? (
              <View style={styles.emptySearchContainer}>
                <Users size={48} color="#808080" style={styles.emptyIcon} />
                <Text style={styles.emptySearchTitle}>Sök efter användare</Text>
                <Text style={styles.emptySearchText}>
                  Hitta vänner genom att söka på deras namn eller användarnamn
                </Text>
              </View>
            ) : emptyResults ? (
              <View style={styles.emptyResultsContainer}>
                <Text style={styles.emptyResultsText}>
                  Inga användare hittades för "{searchQuery}"
                </Text>
              </View>
            ) : !initialStatusesLoaded ? (
              // Show loading while checking friendship statuses
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#009dff" />
                <Text style={styles.loadingText}>Laddar användardata...</Text>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.user_id}
                contentContainerStyle={styles.resultsList}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.resultItem}
                    onPress={() => handleProfilePress(item)}
                  >
                    <View style={styles.resultInfo}>
                      {item.profile_image_url ? (
                        <Image
                          source={{ uri: item.profile_image_url }}
                          style={styles.profileImage}
                        />
                      ) : (
                        <View style={[styles.profileImage, styles.defaultProfileImage]}>
                          <User size={20} color="#808080" />
                        </View>
                      )}
                      <View>
                        <Text style={styles.fullName}>{item.full_name}</Text>
                        {item.username && (
                          <Text style={styles.username}>@{item.username}</Text>
                        )}
                      </View>
                    </View>
                  </Pressable>
                )}
              />
            )}
          </KeyboardAvoidingView>
        )}
      </View>
    </Protected>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingProfileContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginTop: 16,
  },
  header: {
    padding: 24,
    paddingTop: 48,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  notificationButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  notificationButtonActive: {
    backgroundColor: 'rgba(0,157,255,0.2)',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    paddingHorizontal: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
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
  clearButton: {
    padding: 8,
  },
  resultsList: {
    padding: 24,
    paddingTop: 0,
  },
  requestsList: {
    padding: 24,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  resultInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultProfileImage: {
    backgroundColor: '#262626',
  },
  fullName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  friendName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  username: {
    color: '#009dff',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  friendUsername: {
    color: '#009dff',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  requestButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#22C55E',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
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
  emptySearchContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptySearchTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  emptySearchText: {
    color: '#808080',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 24,
  },
  emptyResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyResultsText: {
    color: '#808080',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  emptyText: {
    color: '#808080',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 24,
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    color: '#009dff',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});