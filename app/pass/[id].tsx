import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Dumbbell, Clock, RotateCcw, Play, X, Plus } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import type { Pass, PassExercise } from '@/types/database.types';
import { WebView } from 'react-native-webview';
import { useWorkoutDraftStore } from '@/lib/store';

export default function PassScreen() {
  const { id } = useLocalSearchParams();
  const [pass, setPass] = useState<Pass | null>(null);
  const [exercises, setExercises] = useState<PassExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  
  const addExerciseToDraft = useWorkoutDraftStore(state => state.addExercise);

  useEffect(() => {
    fetchPassDetails();
  }, [id]);

  const fetchPassDetails = async () => {
    try {
      // Fetch pass details
      const { data: passData, error: passError } = await supabase
        .from('pass')
        .select('*')
        .eq('id', id)
        .single();

      if (passError) throw passError;
      setPass(passData);

      // Fetch exercises for this pass with exercise details
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('pass_ovningar')
        .select(`
          *,
          exercise:ovningar(*)
        `)
        .eq('pass_id', id)
        .order('order', { ascending: true });

      if (exercisesError) throw exercisesError;
      setExercises(exercisesData);
    } catch (err) {
      console.error('Error fetching pass details:', err);
      setError('Kunde inte ladda passdetaljer');
    } finally {
      setLoading(false);
    }
  };

  const getYouTubeEmbedUrl = (url: string) => {
    const videoId = url.split('v=')[1];
    return `https://www.youtube.com/embed/${videoId}`;
  };
  
  const handleLogExercise = (exercise: PassExercise) => {
    if (exercise.exercise) {
      // Add to draft store
      addExerciseToDraft(exercise.exercise, 1, exercise.rest_time);
      
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

  if (error || !pass) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Passet kunde inte hittas'}</Text>
        <Pressable style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Gå tillbaka</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <LinearGradient
          colors={['rgba(0,157,255,0.1)', 'rgba(0,0,0,1)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.3 }}
        />

        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title}>{pass.name}</Text>
          <Text style={styles.subtitle}>Dag {pass.day}</Text>
          <Text style={styles.description}>{pass.description}</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Övningar</Text>
          
          <View style={styles.exerciseList}>
            {exercises.map((exercise, index) => (
              <View key={exercise.id} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseNumber}>#{index + 1}</Text>
                    <Text style={styles.exerciseName}>{exercise.exercise?.name}</Text>
                  </View>
                  <View style={styles.categoryTag}>
                    <Dumbbell size={14} color="#009dff" />
                    <Text style={styles.categoryText}>{exercise.exercise?.category}</Text>
                  </View>
                </View>

                <View style={styles.exerciseDetails}>
                  <View style={styles.detailItem}>
                    <RotateCcw size={16} color="#FFFFFF" />
                    <Text style={styles.detailText}>{exercise.sets} set × {exercise.reps} reps</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Clock size={16} color="#FFFFFF" />
                    <Text style={styles.detailText}>{exercise.rest_time}s vila</Text>
                  </View>
                </View>

                <View style={styles.equipmentInfo}>
                  <Text style={styles.equipmentText}>
                    Utrustning: {exercise.exercise?.equipment}
                  </Text>
                </View>

                {exercise.exercise?.video_url && (
                  <Pressable
                    style={styles.videoButton}
                    onPress={() => setSelectedVideo(exercise.exercise?.video_url || null)}
                  >
                    <Play size={16} color="#FFFFFF" />
                    <Text style={styles.videoButtonText}>Visa instruktionsvideo</Text>
                  </Pressable>
                )}
                
                <Pressable
                  style={styles.logButton}
                  onPress={() => handleLogExercise(exercise)}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.logButtonText}>Lägg till i loggboken</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={!!selectedVideo}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedVideo(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Pressable
              style={styles.closeButton}
              onPress={() => setSelectedVideo(null)}
            >
              <X size={24} color="#FFFFFF" />
            </Pressable>
            {selectedVideo && (
              <WebView
                style={styles.webview}
                source={{ uri: getYouTubeEmbedUrl(selectedVideo) }}
                allowsFullscreenVideo
              />
            )}
          </View>
        </View>
      </Modal>
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
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    padding: 24,
    paddingTop: 48,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#009dff',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#B0B0B0',
    fontFamily: 'Inter-Regular',
    lineHeight: 24,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 24,
  },
  exerciseList: {
    gap: 16,
    marginBottom: 24,
  },
  exerciseCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  exerciseInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exerciseNumber: {
    color: '#009dff',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,157,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,157,255,0.3)',
  },
  categoryText: {
    color: '#009dff',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  exerciseDetails: {
    flexDirection: 'row',
    gap: 24,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  equipmentInfo: {
    backgroundColor: '#262626',
    padding: 12,
    borderRadius: 8,
  },
  equipmentText: {
    color: '#B0B0B0',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#009dff',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    justifyContent: 'center',
  },
  videoButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#009dff',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    justifyContent: 'center',
  },
  logButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#000000',
    margin: 24,
    borderRadius: 12,
    overflow: 'hidden',
    aspectRatio: 16 / 9,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 20,
  },
  webview: {
    flex: 1,
  },
});