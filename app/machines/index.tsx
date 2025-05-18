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
  useWindowDimensions,
  Platform,
  FlatList,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Search, ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

type MachineExercise = {
  id: string;
  name: string;
  image_url: string | null;
  video_url: string | null;
  description: string | null;
  exercise_id: string | null;
  created_at: string;
};

export default function MachineLibraryScreen() {
  const [machines, setMachines] = useState<MachineExercise[]>([]);
  const [filteredMachines, setFilteredMachines] = useState<MachineExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { width } = useWindowDimensions();
  const numColumns = 2; // Always use 2 columns
  const cardSize = (width - 48 - (numColumns - 1) * 16) / numColumns; // Account for padding and gap
  
  useEffect(() => {
    fetchMachines();
  }, []);
  
  const fetchMachines = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('machine_exercises')
        .select('*')
        .order('name');
        
      if (fetchError) throw fetchError;
      
      setMachines(data || []);
      setFilteredMachines(data || []);
    } catch (err) {
      console.error('Error fetching machines:', err);
      setError('Kunde inte ladda maskinövningar');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (searchQuery) {
      const filtered = machines.filter(machine => 
        machine.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMachines(filtered);
    } else {
      setFilteredMachines(machines);
    }
  }, [searchQuery, machines]);
  
  const handleMachinePress = (machine: MachineExercise) => {
    router.push(`/machines/${machine.id}`);
  };
  
  const renderMachineItem = ({ item }: { item: MachineExercise }) => (
    <Pressable
      style={[styles.machineCard, { width: cardSize, height: cardSize }]}
      onPress={() => handleMachinePress(item)}
    >
      <View style={styles.imageContainer}>
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
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
      </View>
      <Text style={styles.machineName} numberOfLines={2}>{item.name}</Text>
    </Pressable>
  );
  
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
        <View style={styles.headerTop}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title}>Våra maskiner</Text>
        </View>
        
        <View style={styles.searchContainer}>
          <Search size={20} color="#808080" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Sök maskiner..."
            placeholderTextColor="#808080"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>
      
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchMachines}>
            <Text style={styles.retryButtonText}>Försök igen</Text>
          </Pressable>
        </View>
      ) : filteredMachines.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery ? 'Inga maskiner matchade din sökning' : 'Inga maskiner tillgängliga'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredMachines}
          renderItem={renderMachineItem}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          contentContainerStyle={styles.contentContainer}
          columnWrapperStyle={styles.columnWrapper}
        />
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
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  title: {
    fontSize: 28,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
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
  contentContainer: {
    padding: 24,
    paddingTop: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  machineCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  machineImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#262626',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  machineName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    padding: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
  emptyText: {
    color: '#808080',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
});