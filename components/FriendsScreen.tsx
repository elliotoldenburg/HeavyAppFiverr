import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Search, Users, UserPlus, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FriendRequestButton from '@/components/FriendRequestButton';
import FriendProfileView from '@/components/FriendProfileView';
import UserSearchModal from '@/components/UserSearchModal';

type Friend = {
  friendship_id: string;
  status: string;
  profile: {
    id: string;
    full_name: string;
    profile_image_url: string | null;
    banner_image_url: string | null;
    training_goal: string | null;
    instagram_url: string | null;
    tiktok_url: string | null;
  };
};

export default function FriendsScreen() {
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: friendsError } = await supabase
        .rpc('get_friends_with_profiles', { include_pending: true });

      if (friendsError) throw friendsError;
      
      // Remove duplicates by friendship_id
      const uniqueFriends = data ? 
        Array.from(new Map(data.map(item => [item.friendship_id, item])).values()) : 
        [];
        
      setFriends(uniqueFriends);
    } catch (err) {
      console.error('Error fetching friends:', err);
      setError('Kunde inte hämta vänlista');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (friendshipId: string, newStatus: string) => {
    setFriends(currentFriends => 
      currentFriends.map(friend => 
        friend.friendship_id === friendshipId 
          ? { ...friend, status: newStatus }
          : friend
      )
    );
    
    // If a friend was removed, refresh the list
    if (newStatus === 'none') {
      fetchFriends();
    }
  };

  // Filter friends based on search query
  const filteredFriends = friends.filter(friend => 
    friend.profile.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#009dff" />
      </View>
    );
  }

  if (selectedFriend) {
    return (
      <FriendProfileView
        profile={selectedFriend.profile}
        onClose={() => setSelectedFriend(null)}
      />
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
        <Text style={styles.title}>Vänner</Text>
        
        <View style={styles.searchContainer}>
          <Search size={20} color="#808080" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Sök vänner..."
            placeholderTextColor="#808080"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Pressable
            style={styles.addButton}
            onPress={() => setShowSearch(true)}
          >
            <UserPlus size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchFriends}>
            <Text style={styles.retryButtonText}>Försök igen</Text>
          </Pressable>
        </View>
      ) : friends.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Users size={48} color="#808080" style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>Inga vänner än</Text>
          <Text style={styles.emptyText}>
            Börja med att söka efter andra användare för att lägga till dem som vänner
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {/* Pending Requests Section */}
          {filteredFriends.some(f => f.status === 'pending') && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vänförfrågningar</Text>
              {filteredFriends
                .filter(friend => friend.status === 'pending')
                .map((friend) => (
                  <Pressable
                    key={friend.friendship_id}
                    style={styles.friendCard}
                    onPress={() => setSelectedFriend(friend)}
                  >
                    <View style={styles.friendInfo}>
                      {friend.profile.profile_image_url ? (
                        <Image
                          source={{ uri: friend.profile.profile_image_url }}
                          style={styles.profileImage}
                        />
                      ) : (
                        <View style={[styles.profileImage, styles.defaultProfileImage]}>
                          <User size={20} color="#808080" />
                        </View>
                      )}
                      <Text style={styles.friendName}>{friend.profile.full_name}</Text>
                    </View>
                    <FriendRequestButton
                      userId={friend.profile.id}
                      initialStatus={friend.status}
                      onStatusChange={(status) => handleStatusChange(friend.friendship_id, status)}
                    />
                  </Pressable>
                ))}
            </View>
          )}

          {/* Friends Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dina vänner</Text>
            {filteredFriends
              .filter(friend => friend.status === 'accepted')
              .map((friend) => (
                <Pressable
                  key={friend.friendship_id}
                  style={styles.friendCard}
                  onPress={() => setSelectedFriend(friend)}
                >
                  <View style={styles.friendInfo}>
                    {friend.profile.profile_image_url ? (
                      <Image
                        source={{ uri: friend.profile.profile_image_url }}
                        style={styles.profileImage}
                      />
                    ) : (
                      <View style={[styles.profileImage, styles.defaultProfileImage]}>
                        <User size={20} color="#808080" />
                      </View>
                    )}
                    <Text style={styles.friendName}>{friend.profile.full_name}</Text>
                  </View>
                  <FriendRequestButton
                    userId={friend.profile.id}
                    initialStatus={friend.status}
                    onStatusChange={(status) => handleStatusChange(friend.friendship_id, status)}
                  />
                </Pressable>
              ))}
          </View>
        </ScrollView>
      )}

      <UserSearchModal 
        visible={showSearch}
        onClose={() => {
          setShowSearch(false);
          // Refresh friends list when search modal is closed
          fetchFriends();
        }}
      />
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
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 32,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 24,
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
  addButton: {
    marginLeft: 12,
    padding: 8,
    backgroundColor: '#009dff',
    borderRadius: 8,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
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
  friendName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
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
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
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
});