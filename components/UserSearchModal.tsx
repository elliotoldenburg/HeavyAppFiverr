import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Search, X, User } from 'lucide-react-native';
import FriendRequestButton from './FriendRequestButton';
import LimitedProfileView from './LimitedProfileView';
import { debounce } from 'lodash';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type UserProfile = {
  user_id: string;
  full_name: string;
  username: string | null;
  profile_image_url: string | null;
  status: string;
};

export default function UserSearchModal({ visible, onClose }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Reset state when modal visibility changes
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
      setSelectedProfile(null);
    } else {
      // Get current user ID when modal opens
      getCurrentUserId();
    }
  }, [visible]);

  // Get the current user ID
  const getCurrentUserId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      } else {
        console.error('No user found in auth');
      }
    } catch (err) {
      console.error('Error getting current user:', err);
    }
  };

  const performSearch = async (query: string) => {
    if (!query || query.length < 1) {
      setSearchResults([]);
      return;
    }

    if (!currentUserId) {
      setError('User not authenticated');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: searchError } = await supabase
        .rpc('search_users_with_status', {
          auth_user_id: currentUserId,
          search_text: query
        });

      if (searchError) {
        console.error('Search error:', searchError);
        throw searchError;
      }
      
      console.log('Search results:', data);
      
      if (Array.isArray(data)) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(`Kunde inte söka efter användare: ${err.message || 'Okänt fel'}`);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Create debounced search function
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      performSearch(query);
    }, 300),
    [currentUserId]
  );

  // Handle search query changes
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.length === 0) {
      setSearchResults([]);
    } else {
      debouncedSearch(text);
    }
  };

  const handleProfilePress = (profile: UserProfile) => {
    setSelectedProfile(profile);
  };

  const handleFriendStatusChange = () => {
    // Refresh search results
    if (searchQuery.length > 0) {
      performSearch(searchQuery);
    }
  };

  // If a profile is selected, show the limited profile view
  if (selectedProfile) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setSelectedProfile(null);
        }}
      >
        <LimitedProfileView
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          onStatusChange={handleFriendStatusChange}
        />
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sök</Text>
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
            >
              <X size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.searchContainer}>
            <Search size={20} color="#808080" />
            <TextInput
              style={styles.searchInput}
              placeholder="Sök på namn eller användarnamn..."
              placeholderTextColor="#808080"
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <Pressable
                style={styles.clearButton}
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              >
                <X size={16} color="#808080" />
              </Pressable>
            )}
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable 
                style={styles.retryButton}
                onPress={() => performSearch(searchQuery)}
              >
                <Text style={styles.retryButtonText}>Försök igen</Text>
              </Pressable>
            </View>
          ) : loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#009dff" />
              <Text style={styles.loadingText}>Söker...</Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.resultsContainer} 
              keyboardShouldPersistTaps="handled"
            >
              {searchQuery.length === 0 ? (
                <View style={styles.instructionContainer}>
                  <Text style={styles.instructionText}>
                    Sök efter användare genom att skriva deras namn eller användarnamn
                  </Text>
                </View>
              ) : searchResults.length > 0 ? (
                searchResults.map((profile) => (
                  <Pressable
                    key={profile.user_id}
                    style={styles.resultItem}
                    onPress={() => handleProfilePress(profile)}
                  >
                    <View style={styles.resultInfo}>
                      {profile.profile_image_url ? (
                        <Image
                          source={{ uri: profile.profile_image_url }}
                          style={styles.profileImage}
                        />
                      ) : (
                        <View style={[styles.profileImage, styles.defaultProfileImage]}>
                          <User size={20} color="#808080" />
                        </View>
                      )}
                      <View>
                        <Text style={styles.fullName}>{profile.full_name}</Text>
                        {profile.username && (
                          <Text style={styles.username}>@{profile.username}</Text>
                        )}
                      </View>
                    </View>
                    <FriendRequestButton
                      userId={profile.user_id}
                      initialStatus={profile.status}
                      onStatusChange={handleFriendStatusChange}
                    />
                  </Pressable>
                ))
              ) : searchQuery.length > 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    Inga användare hittades
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-start',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  clearButton: {
    padding: 8,
  },
  resultsContainer: {
    flex: 1,
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 12,
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.2)',
    marginBottom: 24,
  },
  errorText: {
    color: '#FF4444',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: 'rgba(255,68,68,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  resultInfo: {
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
    backgroundColor: '#333333',
  },
  fullName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  username: {
    color: '#009dff',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
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
    marginBottom: 16,
  },
  instructionContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginBottom: 8,
  },
});