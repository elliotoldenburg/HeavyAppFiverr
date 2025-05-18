import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Check, Calculator, Target, Dumbbell, Flame } from 'lucide-react-native';

type MacroGoals = {
  id: string;
  weight_kg: number;
  height_cm: number;
  gender: string;
  age: number;
  activity_level: string;
  goal: string;
  calculated_calories: number;
  calculated_protein: number;
  calculated_carbs: number;
  calculated_fat: number;
  created_at: string;
};

export default function NutritionCalculatorScreen() {
  const [macroGoals, setMacroGoals] = useState<MacroGoals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMacroGoals();
  }, []);

  const fetchMacroGoals = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .rpc('get_latest_macro_goals');

      if (fetchError) throw fetchError;
      
      if (data) {
        setMacroGoals(data);
      }
    } catch (err) {
      console.error('Error fetching macro goals:', err);
      setError('Kunde inte ladda dina näringsbehov');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>Näringskalkylator</Text>
      </View>

      <ScrollView style={styles.content}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={fetchMacroGoals}>
              <Text style={styles.retryButtonText}>Försök igen</Text>
            </Pressable>
          </View>
        ) : macroGoals ? (
          <>
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Calculator size={24} color="#009dff" />
                <Text style={styles.resultTitle}>Dina beräknade näringsbehov</Text>
              </View>
              
              <View style={styles.goalInfo}>
                <Target size={20} color="#009dff" />
                <Text style={styles.goalText}>{macroGoals.goal}</Text>
              </View>
              
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Flame size={24} color="#FF4444" />
                  <Text style={styles.statValue}>{macroGoals.calculated_calories}</Text>
                  <Text style={styles.statLabel}>Kalorier</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{macroGoals.calculated_protein}g</Text>
                  <Text style={styles.statLabel}>Protein</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{macroGoals.calculated_carbs}g</Text>
                  <Text style={styles.statLabel}>Kolhydrater</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{macroGoals.calculated_fat}g</Text>
                  <Text style={styles.statLabel}>Fett</Text>
                </View>
              </View>
              
              <View style={styles.infoContainer}>
                <Text style={styles.infoLabel}>Baserad på:</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>Vikt: {macroGoals.weight_kg} kg</Text>
                  <Text style={styles.infoText}>Längd: {macroGoals.height_cm} cm</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>Ålder: {macroGoals.age} år</Text>
                  <Text style={styles.infoText}>Kön: {macroGoals.gender}</Text>
                </View>
                <Text style={styles.infoText}>Aktivitetsnivå: {macroGoals.activity_level}</Text>
                <Text style={styles.dateText}>Beräknad: {formatDate(macroGoals.created_at)}</Text>
              </View>
            </View>
            
            <View style={styles.macroDistribution}>
              <Text style={styles.distributionTitle}>Makrofördelning</Text>
              
              <View style={styles.distributionBar}>
                <View 
                  style={[
                    styles.distributionSegment, 
                    { 
                      flex: macroGoals.calculated_protein * 4 / macroGoals.calculated_calories,
                      backgroundColor: '#22C55E' 
                    }
                  ]} 
                />
                <View 
                  style={[
                    styles.distributionSegment, 
                    { 
                      flex: macroGoals.calculated_carbs * 4 / macroGoals.calculated_calories,
                      backgroundColor: '#009dff' 
                    }
                  ]} 
                />
                <View 
                  style={[
                    styles.distributionSegment, 
                    { 
                      flex: macroGoals.calculated_fat * 9 / macroGoals.calculated_calories,
                      backgroundColor: '#FF4444' 
                    }
                  ]} 
                />
              </View>
              
              <View style={styles.distributionLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#22C55E' }]} />
                  <Text style={styles.legendText}>Protein</Text>
                  <Text style={styles.legendPercent}>
                    {Math.round((macroGoals.calculated_protein * 4 / macroGoals.calculated_calories) * 100)}%
                  </Text>
                </View>
                
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#009dff' }]} />
                  <Text style={styles.legendText}>Kolhydrater</Text>
                  <Text style={styles.legendPercent}>
                    {Math.round((macroGoals.calculated_carbs * 4 / macroGoals.calculated_calories) * 100)}%
                  </Text>
                </View>
                
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#FF4444' }]} />
                  <Text style={styles.legendText}>Fett</Text>
                  <Text style={styles.legendPercent}>
                    {Math.round((macroGoals.calculated_fat * 9 / macroGoals.calculated_calories) * 100)}%
                  </Text>
                </View>
              </View>
            </View>
            
            <Pressable
              style={styles.recalculateButton}
              onPress={() => router.push('/nutrition/goals')}
            >
              <Calculator size={20} color="#FFFFFF" />
              <Text style={styles.recalculateButtonText}>Beräkna om</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=2940&auto=format&fit=crop' }}
              style={styles.emptyImage}
            />
            <Text style={styles.emptyTitle}>Inga näringsbehov beräknade</Text>
            <Text style={styles.emptyText}>
              Beräkna dina näringsbehov baserat på dina mål och fysiska egenskaper
            </Text>
            <Pressable
              style={styles.calculateButton}
              onPress={() => router.push('/nutrition/goals')}
            >
              <Calculator size={20} color="#FFFFFF" />
              <Text style={styles.calculateButtonText}>Beräkna näringsbehov</Text>
            </Pressable>
          </View>
        )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
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
  resultCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  goalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#262626',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  goalText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
    width: '48%',
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statValue: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#808080',
    fontFamily: 'Inter-Regular',
  },
  infoContainer: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: '#808080',
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#808080',
    fontFamily: 'Inter-Regular',
    marginTop: 8,
    textAlign: 'right',
  },
  macroDistribution: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  distributionTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  distributionBar: {
    height: 24,
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 16,
  },
  distributionSegment: {
    height: '100%',
  },
  distributionLegend: {
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  legendPercent: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  recalculateButton: {
    backgroundColor: '#009dff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  recalculateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#808080',
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  calculateButton: {
    backgroundColor: '#009dff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    width: '100%',
  },
  calculateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});