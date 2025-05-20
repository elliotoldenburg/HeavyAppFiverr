import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Modal,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Search, Filter, Dumbbell, Play, X, Settings, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { router } from 'expo-router';
import type { Exercise } from '@/types/database.types';
import { useWorkoutDraftStore } from '@/lib/store';

type Category = string;
type Equipment = string;

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [showAddToWorkoutModal, setShowAddToWorkoutModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [numSets, setNumSets] = useState('1');
  
  const addExerciseToDraft = useWorkoutDraftStore(state => state.addExercise);

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('ovningar')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;

      setExercises(data || []);
      setFilteredExercises(data || []);

      // Extract unique categories and equipment
      const uniqueCategories = [...new Set(data?.map(ex => ex.category) || [])];
      const uniqueEquipment = [...new Set(data?.map(ex => ex.equipment) || [])];
      setCategories(uniqueCategories);
      setEquipment(uniqueEquipment);
    } catch (err) {
      console.error('Error fetching exercises:', err);
      setError('Kunde inte ladda övningar');
    } finally {
      setLoading(false);
    }
  };

  const filterExercises = () => {
    let filtered = exercises;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(ex => 
        ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.equipment.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(ex => ex.category === selectedCategory);
    }

    // Apply equipment filter
    if (selectedEquipment) {
      filtered = filtered.filter(ex => ex.equipment === selectedEquipment);
    }

    setFilteredExercises(filtered);
  };

  useEffect(() => {
    filterExercises();
  }, [searchQuery, selectedCategory, selectedEquipment]);

  const getYouTubeEmbedUrl = (url: string) => {
    const videoId = url.split('v=')[1];
    return `https://www.youtube.com/embed/${videoId}`;
  };

  const resetFilters = () => {
    setSelectedCategory(null);
    setSelectedEquipment(null);
  };

  const navigateToMachines = () => {
    router.push('/machines');
  };
  
  const handleAddToWorkout = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setShowAddToWorkoutModal(true);
  };
  
  const confirmAddToWorkout = () => {
    if (!selectedExercise) return;
    
    const sets = parseInt(numSets) || 1;
    addExerciseToDraft(selectedExercise, sets);
    
    setShowAddToWorkoutModal(false);
    setSelectedExercise(null);
    setNumSets('1');
    
    Alert.alert(
      'Övning tillagd',
      `${selectedExercise.name} har lagts till i din loggningskorg med ${sets} set.`,
      [{ text: 'OK' }]
    );
  };
  
  const handleLogExercise = (exercise: Exercise) => {
    // Add to draft store
    addExerciseToDraft(exercise, 1);
    
    // Navigate to workout logger
    router.push('/workout-logger');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#009dff" />
      </View>
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
        <Text style={styles.title}>Övningsbibliotek</Text>
        
        <View style={styles.searchContainer}>
          <Search size={20} color="#808080" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Sök övningar..."
            placeholderTextColor="#808080"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <Pressable
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}
          >
            <Filter size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <Pressable
          style={styles.machinesButton}
          onPress={navigateToMachines}
        >
          <Settings size={20} color="#FFFFFF" />
          <Text style={styles.machinesButtonText}>Våra maskiner</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchExercises}>
            <Text style={styles.retryButtonText}>Försök igen</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.exerciseList}>
            {filteredExercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <View style={styles.categoryTag}>
                      <Dumbbell size={14} color="#009dff" />
                      <Text style={styles.categoryText}>{exercise.category}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.equipmentText}>
                  Utrustning: {exercise.equipment}
                </Text>

                <View style={styles.exerciseActions}>
                  {exercise.video_url && (
                    <Pressable
                      style={styles.videoButton}
                      onPress={() => setSelectedVideo(exercise.video_url)}
                    >
                      <Play size={16} color="#FFFFFF" />
                      <Text style={styles.videoButtonText}>Visa instruktionsvideo</Text>
                    </Pressable>
                  )}
                  
                  <Pressable
                    style={styles.addToWorkoutButton}
                    onPress={() => handleAddToWorkout(exercise)}
                  >
                    <Plus size={16} color="#FFFFFF" />
                    <Text style={styles.addToWorkoutText}>Lägg till i korg</Text>
                  </Pressable>
                </View>
                
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
        </ScrollView>
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrera övningar</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setShowFilters(false)}
              >
                <X size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Kategori</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterOptions}>
                  {categories.map((category) => (
                    <Pressable
                      key={category}
                      style={[
                        styles.filterOption,
                        selectedCategory === category && styles.filterOptionSelected,
                      ]}
                      onPress={() => setSelectedCategory(
                        selectedCategory === category ? null : category
                      )}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        selectedCategory === category && styles.filterOptionTextSelected,
                      ]}>
                        {category}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Utrustning</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterOptions}>
                  {equipment.map((item) => (
                    <Pressable
                      key={item}
                      style={[
                        styles.filterOption,
                        selectedEquipment === item && styles.filterOptionSelected,
                      ]}
                      onPress={() => setSelectedEquipment(
                        selectedEquipment === item ? null : item
                      )}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        selectedEquipment === item && styles.filterOptionTextSelected,
                      ]}>
                        {item}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.filterActions}>
              <Pressable
                style={styles.resetButton}
                onPress={() => {
                  resetFilters();
                  setShowFilters(false);
                }}
              >
                <Text style={styles.resetButtonText}>Återställ filter</Text>
              </Pressable>
              <Pressable
                style={styles.applyButton}
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.applyButtonText}>Använd filter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Video Modal */}
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
      
      {/* Add to Workout Modal */}
      <Modal
        visible={showAddToWorkoutModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddToWorkoutModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lägg till i korg</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setShowAddToWorkoutModal(false)}
              >
                <X size={24} color="#FFFFFF" />
              </Pressable>
            </View>
            
            {selectedExercise && (
              <View style={styles.addToWorkoutForm}>
                <Text style={styles.addToWorkoutTitle}>{selectedExercise.name}</Text>
                
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Antal set</Text>
                  <TextInput
                    style={styles.formInput}
                    value={numSets}
                    onChangeText={setNumSets}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor="#808080"
                  />
                </View>
                
                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => setShowAddToWorkoutModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Avbryt</Text>
                  </Pressable>
                  
                  <Pressable
                    style={styles.confirmButton}
                    onPress={confirmAddToWorkout}
                  >
                    <Text style={styles.confirmButtonText}>Lägg till</Text>
                  </Pressable>
                </View>
              </View>
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
    marginBottom: 16,
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
  filterButton: {
    marginLeft: 12,
    padding: 8,
  },
  machinesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#009dff',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  machinesButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  content: {
    flex: 1,
  },
  exerciseList: {
    padding: 24,
    paddingTop: 0,
    gap: 16,
  },
  exerciseCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  exerciseInfo: {
    flex: 1,
    gap: 8,
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
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,157,255,0.3)',
  },
  categoryText: {
    color: '#009dff',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  equipmentText: {
    color: '#B0B0B0',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  exerciseActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  videoButton: {
    flex: 1,
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
  addToWorkoutButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    justifyContent: 'center',
  },
  addToWorkoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#009dff',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  logButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
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
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 24,
    gap: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  filterSection: {
    gap: 16,
  },
  filterTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    backgroundColor: '#262626',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  filterOptionSelected: {
    backgroundColor: '#009dff',
    borderColor: '#009dff',
  },
  filterOptionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  filterOptionTextSelected: {
    fontFamily: 'Inter-SemiBold',
  },
  filterActions: {
    flexDirection: 'row',
    gap: 16,
  },
  resetButton: {
    flex: 1,
    backgroundColor: '#262626',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#009dff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
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
  addToWorkoutForm: {
    gap: 16,
  },
  addToWorkoutTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  formInput: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#262626',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#22C55E',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});