import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { UserPlus, Check, X, UserMinus } from 'lucide-react-native';

type Props = {
  userId: string;
  initialStatus?: string;
  onStatusChange?: (status: string) => void;
};

export default function FriendRequestButton({ userId, initialStatus, onStatusChange }: Props) {
  const [status, setStatus] = useState<string>(initialStatus || 'none');
  const [loading, setLoading] = useState(false);

  // Update status when initialStatus prop changes
  useEffect(() => {
    if (initialStatus && initialStatus !== status) {
      setStatus(initialStatus);
    }
  }, [initialStatus, userId, status]);

  // Check current friendship status on mount and when userId changes
  useEffect(() => {
    if (!initialStatus) {
      checkFriendshipStatus();
    }
  }, [userId, initialStatus]);

  // Set up real-time subscriptions for friend requests and friendships
  useEffect(() => {
    const setupSubscriptions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to friend requests where this user is the sender or receiver
      const friendRequestsSubscription = supabase
        .channel('friend-requests-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `sender_id=eq.${user.id},receiver_id=eq.${userId}`
        }, () => {
          console.log('Friend request change detected for this user, refreshing status...');
          checkFriendshipStatus();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `sender_id=eq.${userId},receiver_id=eq.${user.id}`
        }, () => {
          console.log('Friend request change detected from this user, refreshing status...');
          checkFriendshipStatus();
        })
        .subscribe();

      // Subscribe to friends table for changes in friendship status
      const friendsSubscription = supabase
        .channel('friends-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'friends',
          filter: `user_id=eq.${user.id},friend_id=eq.${userId}`
        }, () => {
          console.log('Friendship change detected, refreshing status...');
          checkFriendshipStatus();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'friends',
          filter: `user_id=eq.${userId},friend_id=eq.${user.id}`
        }, () => {
          console.log('Friendship change detected, refreshing status...');
          checkFriendshipStatus();
        })
        .subscribe();

      return () => {
        friendRequestsSubscription.unsubscribe();
        friendsSubscription.unsubscribe();
      };
    };

    setupSubscriptions();
  }, [userId]);

  const checkFriendshipStatus = async () => {
    try {
      setLoading(true);
      console.log("Checking friendship status for user:", userId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user found');
        setStatus('none');
        return;
      }

      // Use the centralized RPC function to check friendship status
      const { data, error } = await supabase.rpc('check_friendship_status', {
        auth_user_id: user.id,
        other_user_id: userId
      });

      if (error) {
        console.error('Error checking friendship status:', error);
        return;
      }

      console.log('Friendship status (RPC):', data);
      
      // Update the status state
      setStatus(data);
      
      if (onStatusChange) onStatusChange(data);
    } catch (err) {
      console.error('Error checking friendship status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user found');
        return;
      }
      
      // Call the RPC function to remove the friendship
      const { data, error } = await supabase.rpc('remove_friend', {
        p_other_user_id: userId
      });
      
      if (error) {
        console.error("Error removing friend:", error);
        throw error;
      }
      
      console.log("Friendship successfully removed");
      const newStatus = 'none';
      setStatus(newStatus);
      if (onStatusChange) onStatusChange(newStatus);
    } catch (err) {
      console.error("Error removing friend:", err);
      Alert.alert("Fel", "Kunde inte ta bort vännen. Försök igen senare.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user found');
        return;
      }

      if (status === 'none') {
        // Send friend request
        const { data, error } = await supabase
          .rpc('send_friend_request', {
            p_receiver_id: userId
          });

        if (error) {
          throw error;
        }

        if (data.success) {
          const newStatus = 'requested';
          setStatus(newStatus);
          if (onStatusChange) onStatusChange(newStatus);
        } else {
          console.error('Failed to send request:', data.message);
        }
      } else if (status === 'requested') {
        // Cancel friend request
        const { data: requestData, error: findError } = await supabase
          .from('friend_requests')
          .select('id')
          .eq('sender_id', user.id)
          .eq('receiver_id', userId)
          .eq('status', 'pending');

        if (findError) {
          console.error('Error finding friend request:', findError);
          return;
        }

        if (!requestData || requestData.length === 0) {
          console.error('Friend request not found');
          return;
        }

        // Delete the request
        const { error: deleteError } = await supabase
          .from('friend_requests')
          .delete()
          .eq('id', requestData[0].id);

        if (deleteError) throw deleteError;

        const newStatus = 'none';
        setStatus(newStatus);
        if (onStatusChange) onStatusChange(newStatus);
      } else if (status === 'friend') {
        // Show confirmation dialog
        Alert.alert(
          "Ta bort vän",
          "Är du säker på att du vill ta bort denna vän?",
          [
            {
              text: "Avbryt",
              style: "cancel"
            },
            {
              text: "Ta bort",
              style: "destructive",
              onPress: handleRemoveFriend
            }
          ]
        );
        return; // Return early to prevent setting loading to false
      } else if (status === 'incoming') {
        // Accept friend request
        const { data: requestData, error: findError } = await supabase
          .from('friend_requests')
          .select('id')
          .eq('sender_id', userId)
          .eq('receiver_id', user.id)
          .eq('status', 'pending');

        if (findError) {
          console.error('Error finding friend request:', findError);
          return;
        }

        if (!requestData || requestData.length === 0) {
          console.error('Friend request not found');
          return;
        }

        // Accept the request
        const { data, error } = await supabase
          .rpc('respond_to_friend_request', {
            p_request_id: requestData[0].id,
            p_accept: true
          });

        if (error) throw error;

        if (data.success) {
          // Show notification
          Alert.alert(
            "Vänförfrågan accepterad",
            `Du och ${data.sender_name} är nu vänner!`,
            [{ text: "OK" }]
          );
          
          // Immediately set to friend status
          const newStatus = 'friend';
          setStatus(newStatus);
          
          // ✅ Force status refresh from backend
          console.log('Re-checking friendship status after accept');
          await checkFriendshipStatus();
          
          // Always notify parent of status change
          if (onStatusChange) {
            onStatusChange(newStatus);
          }
        }
      }
    } catch (err) {
      console.error('Error handling friend request:', err);
      Alert.alert("Fel", "Ett fel uppstod. Försök igen senare.");
    } finally {
      if (status !== 'friend') { // Only set loading to false if we're not in the friend removal flow
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.button}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  const ButtonComponent = Platform.OS === 'web' ? TouchableOpacity : TouchableOpacity;

  switch (status) {
    case 'friend':
      return (
        <ButtonComponent 
          style={[styles.button, styles.removeButton]}
          onPress={handleRequest}
        >
          <UserMinus size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Ta bort vän</Text>
        </ButtonComponent>
      );
      
    case 'requested':
      return (
        <ButtonComponent 
          style={[styles.button, styles.pendingButton]}
          onPress={handleRequest}
        >
          <X size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Avbryt förfrågan</Text>
        </ButtonComponent>
      );

    case 'incoming':
      return (
        <ButtonComponent 
          style={[styles.button, styles.respondButton]}
          onPress={handleRequest}
        >
          <Check size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Acceptera</Text>
        </ButtonComponent>
      );

    default:
      return (
        <ButtonComponent 
          style={styles.button}
          onPress={handleRequest}
        >
          <UserPlus size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Lägg till vän</Text>
        </ButtonComponent>
      );
  }
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#009dff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  pendingButton: {
    backgroundColor: '#EF4444',
  },
  respondButton: {
    backgroundColor: '#F59E0B',
  },
  removeButton: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
});