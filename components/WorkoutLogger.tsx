import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Modal,
  ImageBackground,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Play, ChevronDown, Check, Plus, X, Info, Trash2, Search } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { supabase } from '@/lib/supabase';
import type { Exercise } from '@/types/database.types';
import AddExerciseButton from './AddExerciseButton';
import { useWorkoutDraftStore } from '@/lib/store';

type Props = {
  onClose: () => void;
  onWorkoutLogged: () => void;
};

export default function WorkoutLogger({ onClose, onWorkoutLogged }: Props) {
  // Get workout draft from store
  const { 
    exercises: draftExercises, 
    updateSet, 
    toggleSetCompletion, 
    addSet, 
    removeExercise,
    clearDraft,
    addExercise
  } = useWorkoutDraftStore();
  
  const [loading, setLoading] = useState(false);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutName, setWorkoutName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('ovningar')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;
      setExercises(data || []);
    } catch (err) {
      console.error('Error fetching exercises:', err);
      setError('Kunde inte ladda övningar');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorkout = async () => {
    if (draftExercises.length === 0) {
      Alert.alert('Fel', 'Du måste lägga till minst en övning');
      return;
    }
    
    try {
      setSavingWorkout(true);
      setError(null);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Create workout log
      const { data: workoutLog, error: workoutError } = await supabase
        .from('workout_logs')
        .insert({
          user_id: user.id,
          date: new Date().toISOString().split('T')[0],
          name: workoutName.trim() || 'Mitt träningspass'
        })
        .select()
        .single();
        
      if (workoutError) throw workoutError;
      
      // Create exercise logs and set logs
      for (const exercise of draftExercises) {
        // Create exercise log
        const { data: exerciseLog, error: exerciseError } = await supabase
          .from('exercise_logs')
          .insert({
            workout_id: workoutLog.id,
            exercise_id: exercise.exercise_id,
            rest_time: exercise.rest_time
          })
          .select()
          .single();
          
        if (exerciseError) throw exerciseError;
        
        // Create set logs
        for (let i = 0; i < exercise.sets.length; i++) {
          const set = exercise.sets[i];
          const { error: setError } = await supabase
            .from('set_logs')
            .insert({
              exercise_log_id: exerciseLog.id,
              set_number: i + 1,
              weight: set.weight === '' ? 0 : parseFloat(set.weight),
              reps: set.reps === '' ? 0 : parseInt(set.reps),
              completed: set.completed
            });
            
          if (setError) throw setError;
        }
      }
      
      // Clear draft after successful save
      clearDraft();
      
      // Navigate to profile
      Alert.alert(
        'Sparat!',
        'Ditt träningspass har sparats',
        [
          { text: 'OK', onPress: onWorkoutLogged }
        ]
      );
    } catch (err) {
      console.error('Error saving workout:', err);
      setError('Kunde inte spara träningspasset');
    } finally {
      setSavingWorkout(false);
      setShowSaveModal(false);
    }
  };

  const handleAddExercise = async (exercise: Exercise) => {
    addExercise(exercise, 1, 90);
    setShowExerciseSelector(false);
  };
  
  const handleClearDraft = () => {
    Alert.alert(
      'Töm korgen',
      'Är du säker på att du vill ta bort alla övningar från korgen?',
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Töm', style: 'destructive', onPress: () => clearDraft() }
      ]
    );
  };
  
  const getYouTubeEmbedUrl = (url: string) => {
    const videoId = url.split('v=')[1];
    return `https://www.youtube.com/embed/${videoId}`;
  };

  return (
    <ImageBackground 
      source={require('../assets/images/background_optimized.webp')}
      style={styles.container}
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>Logga träning</Text>
        {draftExercises.length > 0 && (
          <Pressable style={styles.clearButton} onPress={handleClearDraft}>
            <Trash2 size={20} color="#FF4444" />
          </Pressable>
        )}
      </View>

      <ScrollView style={styles.content}>
        {draftExercises.length === 0 ? (
          <AddExerciseButton onPress={() => setShowExerciseSelector(true)} />
        ) : (
          <>
            <View style={styles.nameInputContainer}>
              <Text style={styles.inputLabel}>Namn på passet</Text>
              <TextInput
                style={styles.nameInput}
                value={workoutName}
                onChangeText={setWorkoutName}
                placeholder="Mitt träningspass"
                placeholderTextColor="#808080"
              />
            </View>
            
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <Text style={styles.sectionTitle}>Övningar ({draftExercises.length})</Text>
            
            {draftExercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>
                      {exercise.exercise.name}
                    </Text>
                    <Text style={styles.exerciseCategory}>
                      {exercise.exercise.category}
                    </Text>
                  </View>
                  <View style={styles.exerciseActions}>
                    {exercise.exercise.video_url && (
                      <Pressable
                        style={styles.videoButton}
                        onPress={() => setSelectedVideo(exercise.exercise.video_url)}
                      >
                        <Play size={18} color="#FFFFFF" />
                      </Pressable>
                    )}
                    <Pressable
                      style={styles.removeButton}
                      onPress={() => removeExercise(exercise.id)}
                    >
                      <X size={18} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>
                
                <View style={styles.setsContainer}>
                  <View style={styles.setsHeader}>
                    <Text style={styles.setsHeaderText}>WEIGHT</Text>
                    <Text style={styles.setsHeaderText}>REPS</Text>
                    <Text style={styles.setsHeaderText}>LOG</Text>
                  </View>
                  
                  {exercise.sets.map((set, setIndex) => (
                    <View key={set.id} style={styles.setRow}>
                      <View style={styles.weightInput}>
                        <TextInput
                          style={styles.input}
                          value={set.weight}
                          onChangeText={(value) => updateSet(exercise.id, set.id, 'weight', value)}
                          keyboardType="numeric"
                          placeholder="kg"
                          placeholderTextColor="rgba(0, 157, 255, 0.3)"
                        />
                      </View>
                      <View style={styles.repsInput}>
                        <TextInput
                          style={styles.input}
                          value={set.reps}
                          onChangeText={(value) => updateSet(exercise.id, set.id, 'reps', value)}
                          keyboardType="numeric"
                          placeholder="reps"
                          placeholderTextColor="rgba(255, 255, 255, 0.3)"
                        />
                      </View>
                      <Pressable
                        style={[
                          styles.completeButton,
                          set.completed && styles.completeButtonActive
                        ]}
                        onPress={() => toggleSetCompletion(exercise.id, set.id)}
                      >
                        <Check size={20} color={set.completed ? '#FFFFFF' : '#808080'} />
                      </Pressable>
                    </View>
                  ))}
                </View>
                
                <Pressable
                  style={styles.addSetButton}
                  onPress={() => addSet(exercise.id)}
                >
                  <Plus size={16} color="#009dff" />
                  <Text style={styles.addSetText}>Lägg till set</Text>
                </Pressable>
                
                <View style={styles.restTimeInfo}>
                  <Info size={16} color="#808080" />
                  <Text style={styles.restTimeText}>
                    Vila {exercise.rest_time} sekunder mellan sets
                  </Text>
                </View>
              </View>
            ))}

            <View style={styles.buttonContainer}>
              <Pressable
                style={styles.addMoreButton}
                onPress={() => setShowExerciseSelector(true)}
              >
                <Plus size={20} color="#FFFFFF" />
                <Text style={styles.addMoreButtonText}>Lägg till övning</Text>
              </Pressable>

              <Pressable
                style={styles.saveWorkoutButton}
                onPress={() => setShowSaveModal(true)}
                disabled={savingWorkout}
              >
                {savingWorkout ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveWorkoutText}>SPARA PASS</Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      {/* Exercise selector modal */}
      <Modal
        visible={showExerciseSelector}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowExerciseSelector(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Välj övning</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setShowExerciseSelector(false)}
              >
                <X size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.searchContainer}>
              <Search size={20} color="#808080" />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Sök övningar..."
                placeholderTextColor="#808080"
              />
            </View>

            <ScrollView style={styles.exerciseList}>
              {exercises
                .filter(ex => 
                  ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  ex.category.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((exercise) => (
                  <Pressable
                    key={exercise.id}
                    style={styles.exerciseItem}
                    onPress={() => handleAddExercise(exercise)}
                  >
                    <View>
                      <Text style={styles.exerciseItemName}>{exercise.name}</Text>
                      <Text style={styles.exerciseItemCategory}>{exercise.category}</Text>
                    </View>
                    <ChevronDown size={20} color="#808080" />
                  </Pressable>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Save workout modal */}
      <Modal
        visible={showSaveModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Spara träningspass</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setShowSaveModal(false)}
              >
                <X size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Namn på passet</Text>
              <TextInput
                style={styles.formInput}
                value={workoutName}
                onChangeText={setWorkoutName}
                placeholder="T.ex. Ben & Axlar"
                placeholderTextColor="#808080"
              />
            </View>

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowSaveModal(false)}
              >
                <Text style={styles.cancelButtonText}>Avbryt</Text>
              </Pressable>

              <Pressable
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveWorkout}
                disabled={savingWorkout}
              >
                {savingWorkout ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Spara</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Video modal */}
      <Modal
        visible={!!selectedVideo}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedVideo(null)}
      >
        <View style={styles.videoModalContainer}>
          <View style={styles.videoModalContent}>
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
    </ImageBackground>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  clearButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,68,68,0.2)',
  },
  title: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  nameInputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  errorContainer: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.2)',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  exerciseCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  exerciseCategory: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  exerciseActions: {
    flexDirection: 'row',
    gap: 8,
  },
  videoButton: {
    padding: 8,
    backgroundColor: '#009dff',
    borderRadius: 8,
  },
  removeButton: {
    padding: 8,
    backgroundColor: 'rgba(255,68,68,0.8)',
    borderRadius: 8,
  },
  setsContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  setsHeader: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 12,
  },
  setsHeaderText: {
    flex: 1,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  weightInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  repsInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  completeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  completeButtonActive: {
    backgroundColor: '#009dff',
    borderColor: '#009dff',
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    marginTop: 16,
    backgroundColor: 'rgba(0,157,255,0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,157,255,0.3)',
  },
  addSetText: {
    color: '#009dff',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  restTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  restTimeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 24,
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  addMoreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  saveWorkoutButton: {
    backgroundColor: '#009dff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#009dff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveWorkoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backdropFilter: 'blur(10px)',
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
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  exerciseList: {
    maxHeight: 400,
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  exerciseItemName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  exerciseItemCategory: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  videoModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
  },
  videoModalContent: {
    backgroundColor: '#000000',
    margin: 24,
    borderRadius: 12,
    overflow: 'hidden',
    aspectRatio: 16 / 9,
  },
  webview: {
    flex: 1,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  saveButton: {
    backgroundColor: '#009dff',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});