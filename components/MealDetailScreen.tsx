import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Trash2, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { MealEntry } from '@/lib/hooks/useNutritionData';

type Props = {
  onClose: () => void;
  mealName: string;
  onMealUpdated: () => void;
  onBackToSearch: () => void;
  onViewItemDetail?: (item: MealEntry) => void;
};

export default function MealDetailScreen({ onClose, mealName, onMealUpdated, onBackToSearch, onViewItemDetail }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mealEntries, setMealEntries] = useState<MealEntry[]>([]);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [totalCalories, setTotalCalories] = useState(0);
  const [totalProtein, setTotalProtein] = useState(0);
  const [totalCarbs, setTotalCarbs] = useState(0);
  const [totalFat, setTotalFat] = useState(0);

  useEffect(() => {
    fetchMealData();
  }, [mealName]);

  const fetchMealData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Get current date
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0];
      
      // Convert meal name to English for the database
      const mealType = convertMealTypeToEnglish(mealName);
      
      // Get meal entries
      const { data, error } = await supabase
        .rpc('get_meal_entries', {
          p_user_id: user.id,
          p_date: formattedDate,
          p_meal_type: mealType
        });

      if (error) throw error;

      setMealEntries(data || []);
      
      // Calculate totals
      if (data) {
        const totals = data.reduce((acc, entry) => ({
          calories: acc.calories + Number(entry.calories_total),
          protein: acc.protein + Number(entry.protein_total),
          carbs: acc.carbs + Number(entry.carbs_total),
          fat: acc.fat + Number(entry.fat_total)
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        setTotalCalories(totals.calories);
        setTotalProtein(totals.protein);
        setTotalCarbs(totals.carbs);
        setTotalFat(totals.fat);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const convertMealTypeToEnglish = (swedishMealName: string): string => {
    const mealTypeMap: { [key: string]: string } = {
      'Frukost': 'breakfast',
      'Lunch': 'lunch',
      'Middag': 'dinner',
      'Mellanmål': 'snack'
    };
    return mealTypeMap[swedishMealName] || swedishMealName.toLowerCase();
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      setDeletingItemId(entryId);
      const { error } = await supabase
        .from('meal_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      // Refresh meal data after deletion
      await fetchMealData();
      onMealUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    } finally {
      setDeletingItemId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backButton}>
          <ArrowLeft size={24} color="#000" />
        </Pressable>
        <Text style={styles.title}>{mealName}</Text>
        <Pressable onPress={onBackToSearch} style={styles.addButton}>
          <Plus size={24} color="#000" />
        </Pressable>
      </View>

      <View style={styles.totalsContainer}>
        <Text style={styles.totalsTitle}>Totalt</Text>
        <View style={styles.totalsGrid}>
          <View style={styles.totalItem}>
            <Text style={styles.totalValue}>{Math.round(totalCalories)}</Text>
            <Text style={styles.totalLabel}>kcal</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalValue}>{Math.round(totalProtein)}g</Text>
            <Text style={styles.totalLabel}>Protein</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalValue}>{Math.round(totalCarbs)}g</Text>
            <Text style={styles.totalLabel}>Kolhydrater</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalValue}>{Math.round(totalFat)}g</Text>
            <Text style={styles.totalLabel}>Fett</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {mealEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Inga måltider loggade än</Text>
          </View>
        ) : (
          mealEntries.map((entry) => (
            <Pressable
              key={entry.id}
              style={styles.entryContainer}
              onPress={() => onViewItemDetail && onViewItemDetail(entry)}
            >
              <View style={styles.entryContent}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryName}>{entry.product_name}</Text>
                  <Text style={styles.entryQuantity}>{entry.quantity_grams}g</Text>
                </View>
                <View style={styles.macroContainer}>
                  <Text style={styles.macroText}>
                    {Math.round(entry.calories_total)} kcal
                  </Text>
                  <Text style={styles.macroText}>
                    P: {Math.round(entry.protein_total)}g
                  </Text>
                  <Text style={styles.macroText}>
                    K: {Math.round(entry.carbs_total)}g
                  </Text>
                  <Text style={styles.macroText}>
                    F: {Math.round(entry.fat_total)}g
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDeleteEntry(entry.id)}
              >
                {deletingItemId === entry.id ? (
                  <ActivityIndicator size="small" color="#FF0000" />
                ) : (
                  <Trash2 size={20} color="#FF0000" />
                )}
              </Pressable>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    padding: 8,
  },
  totalsContainer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  totalsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  totalsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalItem: {
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalLabel: {
    fontSize: 12,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    color: '#c62828',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  entryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  entryContent: {
    flex: 1,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  entryName: {
    fontSize: 16,
    fontWeight: '500',
  },
  entryQuantity: {
    fontSize: 16,
    color: '#666',
  },
  macroContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  macroText: {
    fontSize: 14,
    color: '#666',
  },
  deleteButton: {
    padding: 8,
  },
});