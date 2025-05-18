import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { ChevronRight, Dumbbell } from 'lucide-react-native';
import type { Pass } from '@/types/database.types';
import Protected from '@/components/Protected';

export default function WorkoutsScreen() {
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPasses();
  }, []);

  const fetchPasses = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('pass')
        .select(`
          *,
          program:program (
            name,
            category
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setPasses(data || []);
    } catch (err) {
      console.error('Error fetching passes:', err);
      setError('Kunde inte ladda träningspass');
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

  return (
    <Protected>
      <View style={styles.container}>
        <LinearGradient
          colors={['rgba(0,157,255,0.1)', 'rgba(0,0,0,1)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.3 }}
        />

        <View style={styles.header}>
          <Text style={styles.title}>Träningspass</Text>
          <Text style={styles.subtitle}>Välj ett pass och börja träna</Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={fetchPasses}>
              <Text style={styles.retryButtonText}>Försök igen</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView style={styles.content}>
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
                      <View style={styles.programTag}>
                        <Dumbbell size={14} color="#009dff" />
                        <Text style={styles.programText}>
                          {pass.program?.category}
                        </Text>
                      </View>
                      <Text style={styles.passName}>{pass.name}</Text>
                      <Text style={styles.passDescription}>{pass.description}</Text>
                      <Text style={styles.programName}>
                        {pass.program?.name}
                      </Text>
                    </View>
                    <ChevronRight size={20} color="#808080" />
                  </Pressable>
                </Link>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </Protected>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#808080',
    fontFamily: 'Inter-Regular',
  },
  content: {
    flex: 1,
  },
  passList: {
    padding: 24,
    paddingTop: 0,
    gap: 16,
  },
  passCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  passCardPressed: {
    opacity: 0.8,
  },
  passInfo: {
    flex: 1,
    gap: 8,
  },
  programTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,157,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,157,255,0.3)',
    alignSelf: 'flex-start',
  },
  programText: {
    color: '#009dff',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  passName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  passDescription: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  programName: {
    color: '#808080',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
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
});