import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Calendar, Clock, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import type { Program, Pass } from '@/types/database.types';

export default function ProgramScreen() {
  const { id } = useLocalSearchParams();
  const [program, setProgram] = useState<Program | null>(null);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProgramDetails();
  }, [id]);

  const fetchProgramDetails = async () => {
    try {
      // Fetch program details
      const { data: programData, error: programError } = await supabase
        .from('program')
        .select('*')
        .eq('id', id)
        .single();

      if (programError) throw programError;
      setProgram(programData);

      // Fetch program passes
      const { data: passesData, error: passesError } = await supabase
        .from('pass')
        .select('*')
        .eq('program_id', id)
        .order('day', { ascending: true });

      if (passesError) throw passesError;
      setPasses(passesData);
    } catch (err) {
      console.error('Error fetching program details:', err);
      setError('Kunde inte ladda programdetaljer');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#009dff" />
      </View>
    );
  }

  if (error || !program) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Programmet kunde inte hittas'}</Text>
        <Pressable style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Gå tillbaka</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Image
            source={{ uri: program.image_url }}
            style={styles.headerImage}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'transparent', 'rgba(0,0,0,1)']}
            style={styles.headerGradient}
          />
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.tagContainer}>
            <Text style={styles.tag}>{program.category}</Text>
          </View>

          <Text style={styles.title}>{program.name}</Text>
          <Text style={styles.description}>{program.description}</Text>

          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <Calendar size={20} color="#009dff" />
              <Text style={styles.metaText}>{program.sessions_per_week}x / vecka</Text>
            </View>
            <View style={styles.metaItem}>
              <Clock size={20} color="#009dff" />
              <Text style={styles.metaText}>{program.difficulty}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Träningspass</Text>

          <View style={styles.passList}>
            {passes.map((pass) => (
              <Link
                key={pass.id}
                href={`/pass/${pass.id}`}
                asChild
              >
                <Pressable style={({ pressed }) => [
                  styles.passCard,
                  pressed && styles.passCardPressed,
                ]}>
                  <View style={styles.passInfo}>
                    <Text style={styles.passDay}>Dag {pass.day}</Text>
                    <Text style={styles.passName}>{pass.name}</Text>
                    <Text style={styles.passDescription}>{pass.description}</Text>
                  </View>
                  <ChevronRight size={20} color="#808080" />
                </Pressable>
              </Link>
            ))}
          </View>
        </View>
      </ScrollView>
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
    height: 300,
    position: 'relative',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 32,
  },
  tagContainer: {
    backgroundColor: 'rgba(0,157,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,157,255,0.3)',
  },
  tag: {
    color: '#009dff',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  title: {
    fontSize: 32,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#B0B0B0',
    fontFamily: 'Inter-Regular',
    marginBottom: 24,
    lineHeight: 24,
  },
  metaContainer: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 40,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  sectionTitle: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 24,
  },
  passList: {
    gap: 16,
  },
  passCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'transform 0.2s ease-in-out',
    } : {}),
  },
  passCardPressed: {
    opacity: 0.8,
    transform: Platform.OS === 'web' ? [{ scale: 1.02 }] : [{ scale: 0.98 }],
  },
  passInfo: {
    flex: 1,
  },
  passDay: {
    color: '#009dff',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  passName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  passDescription: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
});