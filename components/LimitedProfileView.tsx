import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { X, User } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FriendRequestButton from './FriendRequestButton';

type UserProfile = {
  user_id: string;
  full_name: string;
  username: string | null;
  profile_image_url: string | null;
  status: string;
};

type Props = {
  profile: UserProfile;
  onClose: () => void;
  onStatusChange?: () => void;
};

export default function LimitedProfileView({ profile, onClose, onStatusChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>(profile.status || 'none');
  const [error, setError] = useState<string | null>(null);

  // Update status when profile changes
  useEffect(() => {
    if (profile.status) {
      setStatus(profile.status);
    } else {
      checkFriendshipStatus();
    }
  }, [profile.user_id, profile.status]);

  const checkFriendshipStatus = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Use the centralized RPC function to check friendship status
      const { data, error } = await supabase.rpc('check_friendship_status', {
        auth_user_id: user.id,
        other_user_id: profile.user_id
      });

      if (error) {
        console.error('Error checking friendship status:', error);
        return false;
      }

      console.log('Friendship status (RPC):', data);
      
      // Update status based on the result from the RPC
      const newStatus = data;
      setStatus(newStatus);
      
      // If status is 'friend', notify parent component
      if (newStatus === 'friend' && onStatusChange) {
        onStatusChange();
      }
      
      return newStatus === 'friend';
    } catch (err) {
      console.error('Error checking friendship status:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <X size={24} color="#FFFFFF" />
        </Pressable>
      </View>
      
      <View style={styles.content}>
        {profile.profile_image_url ? (
          <Image
            source={{ uri: profile.profile_image_url }}
            style={styles.profileImage}
          />
        ) : (
          <View style={[styles.profileImage, styles.defaultProfileImage]}>
            <User size={48} color="#808080" />
          </View>
        )}
        
        <Text style={styles.username}>@{profile.username}</Text>
        <Text style={styles.fullName}>{profile.full_name}</Text>
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        {loading ? (
          <View style={styles.actionButton}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : (
          <FriendRequestButton
            userId={profile.user_id}
            initialStatus={status}
            onStatusChange={(newStatus) => {
              setStatus(newStatus);
              if (onStatusChange) onStatusChange();
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24,
  },
  defaultProfileImage: {
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  fullName: {
    color: '#808080',
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    marginBottom: 32,
  },
  errorContainer: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.2)',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  actionButton: {
    width: '100%',
    maxWidth: 320,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#009dff',
  },
});