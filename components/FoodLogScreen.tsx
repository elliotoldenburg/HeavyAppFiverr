import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { 
  searchProductsByName, 
  createMeal, 
  addFoodToMeal,
  getDailyNutritionSummary,
  FoodProduct,
  NutritionSummary
} from '@/lib/macrotracker';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, Clock, Heart, List, Plus, X } from 'lucide-react-native';

type Props = {
  onClose: () => void;
  mealName?: string;
};

export default function FoodLogScreen({ onClose, mealName = 'Frukost' }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodProduct[]>([]);
  const [recentItems, setRecentItems] = useState<FoodProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nutritionSummary, setNutritionSummary] = useState<NutritionSummary>({
    total_calories: 0,
    total_protein: 0,
    total_carbs: 0,
    total_fat: 0,
    meals: []
  });

  // User goals
  const userGoals = {
    calories: 3876,
    protein: 194,
    carbs: 485,
    fat: 129
  };

  useEffect(() => {
    fetchNutritionData();
    fetchRecentItems();
  }, []);

  const fetchNutritionData = async () => {
    try {
      const data = await getDailyNutritionSummary(new Date());
      setNutritionSummary(data || {
        total_calories: 0,
        total_protein: 0,
        total_carbs: 0,
        total_fat: 0,
        meals: []
      });
    } catch (err) {
      console.error('Error fetching nutrition data:', err);
    }
  };

  const fetchRecentItems = async () => {
    // This would normally fetch from a database
    // For now, we'll use mock data
    setRecentItems([
      {
        name: 'Donut White Crushed Candy (knuste non stop), Grekisk Yog...',
        brand: 'Bakehuset',
        calories: 247,
        protein: 3,
        carbs: 30,
        fat: 12,
        image_url: ''
      },
      {
        name: 'Donut White Crushed Candy (knuste non stop)',
        brand: 'Bakehuset',
        calories: 247,
        protein: 3,
        carbs: 30,
        fat: 12,
        image_url: ''
      },
      {
        name: 'Kyckling lårfile',
        brand: '',
        calories: 112,
        protein: 25,
        carbs: 0,
        fat: 2,
        image_url: ''
      },
      {
        name: 'Thai sweet chili sauce',
        brand: 'ICA Asia',
        calories: 17,
        protein: 0,
        carbs: 4,
        fat: 0,
        image_url: ''
      },
      {
        name: 'Italienskt lantbröd osötat',
        brand: 'Pågen',
        calories: 260,
        protein: 8,
        carbs: 48,
        fat: 3,
        image_url: ''
      }
    ]);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);
      
      const results = await searchProductsByName(searchQuery.trim());
      setSearchResults(results);
    } catch (err: any) {
      console.error('Error searching products:', err);
      setError(err.message || 'Kunde inte söka efter produkter');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFood = async (product: FoodProduct) => {
    try {
      setLoading(true);
      
      // Create a new meal
      const meal = await createMeal(mealName);
      
      // Add the food to the meal (default 100g)
      await addFoodToMeal(meal.id!, product, 100);
      
      // Refresh data
      await fetchNutritionData();
      
      // Add to recent items
      setRecentItems(prev => [product, ...prev.slice(0, 3)]);
    } catch (err) {
      console.error('Error adding food:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate progress percentages for macros
  const caloriePercentage = Math.min((nutritionSummary.total_calories / userGoals.calories) * 100, 100);
  const proteinPercentage = Math.min((nutritionSummary.total_protein / userGoals.protein) * 100, 100);
  const carbsPercentage = Math.min((nutritionSummary.total_carbs / userGoals.carbs) * 100, 100);
  const fatPercentage = Math.min((nutritionSummary.total_fat / userGoals.fat) * 100, 100);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>03:18</Text>
        <View style={styles.statusIcons}>
          <View style={styles.statusIcon}></View>
          <View style={styles.statusIcon}></View>
          <View style={styles.statusIcon}></View>
        </View>
      </View>
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backButton}>
          <X size={24} color="#000000" />
        </Pressable>
        <Text style={styles.headerTitle}>{mealName}</Text>
        <Text style={styles.menuDots}>•••</Text>
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#808080" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Matvara, måltid eller varumärke"
            placeholderTextColor="#808080"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
        <View style={styles.scanButton}>
          <Image 
            source={require('../assets/images/icon.png')} 
            style={styles.scanIcon}
          />
        </View>
      </View>
      
      {/* Nutrition Summary */}
      <View style={styles.nutritionCard}>
        <View style={styles.nutritionHeader}>
          <Text style={styles.nutritionTitle}>Dagligt intag</Text>
          <Text style={styles.calorieText}>
            {nutritionSummary.total_calories} / {userGoals.calories} kcal
          </Text>
        </View>
        
        <View style={styles.calorieBar}>
          <View 
            style={[
              styles.calorieProgress, 
              { width: `${caloriePercentage}%` }
            ]} 
          />
        </View>
        
        <View style={styles.macroGrid}>
          <View style={styles.macroColumn}>
            <Text style={styles.macroTitle}>KH</Text>
            <Text style={styles.macroValue}>
              {nutritionSummary.total_carbs} / {userGoals.carbs} g
            </Text>
          </View>
          
          <View style={styles.macroColumn}>
            <Text style={styles.macroTitle}>Protein</Text>
            <Text style={styles.macroValue}>
              {nutritionSummary.total_protein} / {userGoals.protein} g
            </Text>
          </View>
          
          <View style={styles.macroColumn}>
            <Text style={styles.macroTitle}>Fett</Text>
            <Text style={styles.macroValue}>
              {nutritionSummary.total_fat} / {userGoals.fat} g
            </Text>
          </View>
        </View>
      </View>
      
      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Pressable style={[styles.actionButton, styles.actionButtonActive]}>
          <Clock size={20} color="#22C55E" />
        </Pressable>
        <Pressable style={styles.actionButton}>
          <Heart size={20} color="#808080" />
        </Pressable>
        <Pressable style={styles.actionButton}>
          <List size={20} color="#808080" />
        </Pressable>
      </View>
      
      {/* Section Headers */}
      <Text style={styles.sectionTitle}>SAMMA SOM IGÅR?</Text>
      
      {/* Recent Items */}
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.foodItem}>
          <View style={styles.foodInfo}>
            <Text style={styles.foodName} numberOfLines={2}>
              {recentItems[0]?.name}
            </Text>
          </View>
          <Pressable style={styles.addButton} onPress={() => handleAddFood(recentItems[0])}>
            <Plus size={24} color="#000000" />
          </Pressable>
        </View>
        
        <Text style={[styles.sectionTitle, {marginTop: 20}]}>SENASTE</Text>
        
        {/* Search Results or Recent Items */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#22C55E" />
          </View>
        ) : searchResults.length > 0 ? (
          searchResults.map((item, index) => (
            <View key={index} style={styles.foodItem}>
              <View style={styles.foodInfo}>
                <Text style={styles.foodName} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.brand && (
                  <View style={styles.foodDetails}>
                    <Text style={styles.brandText}>{item.brand} • {item.calories} kcal</Text>
                  </View>
                )}
              </View>
              <Pressable style={styles.addButton} onPress={() => handleAddFood(item)}>
                <Plus size={24} color="#000000" />
              </Pressable>
            </View>
          ))
        ) : (
          recentItems.slice(1).map((item, index) => (
            <View key={`recent-${index}`} style={styles.foodItem}>
              <View style={styles.foodInfo}>
                <Text style={styles.foodName} numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={styles.foodDetails}>
                  {item.brand && (
                    <Text style={styles.brandText}>{item.brand}{item.calories ? ` • ${item.calories} kcal` : ''}</Text>
                  )}
                  {!item.brand && item.calories && (
                    <Text style={styles.brandText}>{item.calories} kcal</Text>
                  )}
                </View>
                {index === 0 && (
                  <Text style={styles.portionText}>• 1 Donut/s (57 g)</Text>
                )}
                {index === 1 && (
                  <Text style={styles.portionText}>• 70 g</Text>
                )}
                {index === 2 && (
                  <Text style={styles.portionText}>• 0,6 Matsked (9 ml)</Text>
                )}
              </View>
              <Pressable style={styles.addButton} onPress={() => handleAddFood(item)}>
                <Plus size={24} color="#000000" />
              </Pressable>
            </View>
          ))
        )}
        
        {/* Logo at bottom */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/heavygymlogga_optimized.webp')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 16,
    paddingBottom: 8,
  },
  statusTime: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#000000',
  },
  statusIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusIcon: {
    width: 16,
    height: 16,
    backgroundColor: '#CCCCCC',
    borderRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#000000',
  },
  menuButton: {
    padding: 8,
  },
  menuDots: {
    color: '#000000',
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    fontFamily: 'Inter-Regular',
  },
  scanButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  scanIcon: {
    width: 24,
    height: 24,
  },
  nutritionCard: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  nutritionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nutritionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#000000',
  },
  calorieBar: {
    height: 8,
    backgroundColor: '#EEEEEE',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  calorieProgress: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 4,
  },
  calorieText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#000000',
  },
  macroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroColumn: {
    alignItems: 'center',
    flex: 1,
  },
  macroTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#000000',
    marginBottom: 8,
  },
  macroValue: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#000000',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    marginHorizontal: 16,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  actionButtonActive: {
    backgroundColor: '#EEFBF4',
    borderColor: '#22C55E',
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#808080',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
  },
  foodInfo: {
    flex: 1,
    paddingRight: 16,
  },
  foodName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#000000',
    marginBottom: 4,
  },
  foodDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  brandText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#808080',
  },
  portionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#808080',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    padding: 24,
    marginTop: 16,
  },
  logo: {
    width: 100,
    height: 32,
    opacity: 0.5,
  },
});