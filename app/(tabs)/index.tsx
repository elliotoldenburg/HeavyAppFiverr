import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Clock, TrendingUp } from 'lucide-react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { Program } from '@/types/database.types';
import SubscriptionBanner from '@/components/SubscriptionBanner';
import Protected from '@/components/Protected';

export default function TrainingScreen() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      console.log('🔵 [TrainingScreen] Fetching programs...');
      const { data, error: fetchError } = await supabase
        .from('program')
        .select('*')
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('❌ [TrainingScreen] Error fetching programs:', fetchError);
        throw fetchError;
      }

      console.log('✅ [TrainingScreen] Programs fetched:', data);
      setPrograms(data || []);
    } catch (err) {
      console.error('❌ [TrainingScreen] Error:', err);
      setError('Kunde inte ladda träningsprogram');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Protected>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Image
            source={require('../../assets/images/heavygymlogga_optimized.webp')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.title}>Välj ditt träningsprogram</Text>

          {/* Subscription Banner */}
          <SubscriptionBanner />

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={fetchPrograms}>
                <Text style={styles.retryButtonText}>Försök igen</Text>
              </Pressable>
            </View>
          ) : loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#009dff" />
            </View>
          ) : programs.length === 0 ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Inga träningsprogram tillgängliga</Text>
              <Pressable style={styles.retryButton} onPress={fetchPrograms}>
                <Text style={styles.retryButtonText}>Uppdatera</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.programsContainer}>
              {programs.map((program) => (
                <Link
                  key={program.id}
                  href={`/program/${program.id}`}
                  asChild
                >
                  <Pressable style={({ pressed }) => [
                    styles.programCard,
                    pressed && styles.programCardPressed,
                  ]}>
                    <Image
                      source={{ uri: program.image_url }}
                      style={styles.programImage}
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.9)']}
                      style={styles.gradient}
                    />
                    
                    <View style={styles.cardContent}>
                      <View style={styles.tagContainer}>
                        <TrendingUp size={16} color="#009dff" />
                        <Text style={styles.tag}>{program.category}</Text>
                      </View>

                      <Text style={styles.programTitle}>{program.name}</Text>
                      <Text style={styles.programDescription}>{program.description}</Text>

                      <View style={styles.programMetaContainer}>
                        <View style={styles.metaItem}>
                          <Calendar size={16} color="#FFFFFF" />
                          <Text style={styles.metaText}>{program.sessions_per_week}x / vecka</Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Clock size={16} color="#FFFFFF" />
                          <Text style={styles.metaText}>{program.difficulty}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </Link>
              ))}
            </View>
          )}
        </ScrollView>
      </Protected>
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
    padding: 48,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 48,
  },
  logo: {
    width: 180,
    height: 56,
    alignSelf: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 24,
    textAlign: 'center',
  },
  errorContainer: {
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
  programsContainer: {
    gap: 24,
  },
  programCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'transform 0.2s ease-in-out',
      },
      default: {
        elevation: 4,
      },
    }),
  },
  programCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  programImage: {
    width: '100%',
    height: 200,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
  },
  cardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  tagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,157,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,157,255,0.3)',
  },
  tag: {
    color: '#009dff',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  programTitle: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  programDescription: {
    fontSize: 16,
    color: '#B0B0B0',
    fontFamily: 'Inter-Regular',
    marginBottom: 16,
  },
  programMetaContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
});