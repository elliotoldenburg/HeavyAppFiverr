import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Play, Dumbbell, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import { useWorkoutDraftStore } from '@/lib/store';
import { Modal } from 'react-native';

type MachineExercise = {
  id: string;
  name: string;
  image_url: string | null;
  video_url: string | null;
  description: string | null;
  exercise_id: string | null;
  created_at: string;
  exercise?: {
    id: string;
    name: string;
    category: string;
    equipment: string;
  };
};

export default function MachineDetailScreen() {
  const { id } = useLocalSearchParams();
  const [machine, setMachine] = useState<MachineExercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  
  const addExerciseToDraft = useWorkoutDraftStore(state => state.addExercise);
  
  useEffect(() => {
    fetchMachineDetails();
  }, [id]);
  
  const fetchMachineDetails = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('machine_exercises')
        .select(`
          *,
          exercise:exercise_id (
            id,
            name,
            category,
            equipment
          )
        `)
        .eq('id', id)
        .single();
        
      if (fetchError) throw fetchError;
      
      setMachine(data);
    } catch (err) {
      console.error('Error fetching machine details:', err);
      setError('Kunde inte ladda maskindetaljer');
    } finally {
      setLoading(false);
    }
  };
  
  const getYouTubeEmbedUrl = (url: string | null) => {
    if (!url) return '';
    const videoId = url.split('v=')[1];
    return `https://www.youtube.com/embed/${videoId}`;
  };
  
  const handleLogExercise = () => {
    if (machine?.exercise) {
      // Add to draft store
      addExerciseToDraft(machine.exercise, 1);
      
      // Navigate to workout logger
      router.push('/workout-logger');
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#009dff" />
      </View>
    );
  }
  
  if (error || !machine) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Maskinen kunde inte hittas'}</Text>
        <Pressable style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Gå tillbaka</Text>
        </Pressable>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent}>
        <View style={styles.imageContainer}>
          {machine.image_url ? (
            <Image
              source={{ uri: machine.image_url }}
              style={styles.machineImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderImage} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.imageOverlay}
          />
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.title}>{machine.name}</Text>
          
          {machine.exercise?.category && (
            <View style={styles.categoryTag}>
              <Dumbbell size={16} color="#009dff" />
              <Text style={styles.categoryText}>{machine.exercise.category}</Text>
            </View>
          )}
          
          {machine.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionTitle}>Beskrivning</Text>
              <Text style={styles.descriptionText}>{machine.description}</Text>
            </View>
          )}
          
          <View style={styles.actionButtons}>
            {machine.video_url && (
              <Pressable
                style={styles.videoButton}
                onPress={() => setShowVideo(true)}
              >
                <Play size={20} color="#FFFFFF" />
                <Text style={styles.videoButtonText}>Visa instruktionsvideo</Text>
              </Pressable>
            )}
          </View>
          
          {machine.exercise_id && (
            <Pressable
              style={styles.logButton}
              onPress={handleLogExercise}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.logButtonText}>Lägg till i loggboken</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
      
      {/* Video Modal */}
      {showVideo && machine.video_url && (
        <View style={styles.videoModalContainer}>
          <View style={styles.videoModalContent}>
            <Pressable
              style={styles.closeVideoButton}
              onPress={() => setShowVideo(false)}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </Pressable>
            <WebView
              style={styles.webview}
              source={{ uri: getYouTubeEmbedUrl(machine.video_url) }}
              allowsFullscreenVideo
            />
          </View>
        </View>
      )}
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
  scrollContent: {
    flexGrow: 1,
  },
  imageContainer: {
    height: 300,
    position: 'relative',
  },
  machineImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1A1A1A',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 24,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,157,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,157,255,0.3)',
    marginBottom: 24,
  },
  categoryText: {
    color: '#009dff',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  descriptionContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  descriptionTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    color: '#B0B0B0',
    fontFamily: 'Inter-Regular',
    lineHeight: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  videoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#009dff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  videoButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#009dff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  logButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  videoModalContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    justifyContent: 'center',
    zIndex: 1000,
  },
  videoModalContent: {
    flex: 1,
    position: 'relative',
  },
  closeVideoButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 24,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  webview: {
    flex: 1,
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
});