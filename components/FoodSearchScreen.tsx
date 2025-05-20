import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Search, X, Check, Plus, Minus, ArrowLeft, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { debounce } from 'lodash';
import { MealEntry } from '@/lib/hooks/useNutritionData';

type FoodProduct = {
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  image_url?: string;
  off_id?: string;
};

type Props = {
  onClose: () => void;
  mealName?: string;
  onMealAdded?: () => void;
  onViewMealDetails?: () => void;
  onViewItemDetail?: (item: MealEntry) => void;
};

export default function FoodSearchScreen({ onClose, mealName = 'frukost', onMealAdded, onViewMealDetails, onViewItemDetail }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<FoodProduct | null>(null);
  const [quantity, setQuantity] = useState('100');
  const [showProductModal, setShowProductModal] = useState(false);
  const [addingToMeal, setAddingToMeal] = useState(false);
  const [mealEntries, setMealEntries] = useState<MealEntry[]>([]);
  const [loadingMeal, setLoadingMeal] = useState(true);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Create debounced search function
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      performSearch(query);
    }, 300),
    []
  );

  // Handle search query changes
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.length === 0) {
      setSearchResults([]);
    } else {
      debouncedSearch(text);
    }
  };

  useEffect(() => {
    fetchMealData();
  }, [mealName]);

  const fetchMealData = async () => {
    try {
      setLoadingMeal(true);
      
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
          p_user: user.id,
          p_date: formattedDate,
          p_meal: mealType
        });
        
      if (error) throw error;
      
      setMealEntries(data || []);
    } catch (err) {
      console.error('Error fetching meal data:', err);
      setError('Kunde inte ladda måltidsdata');
    } finally {
      setLoadingMeal(false);
    }
  };

  const convertMealTypeToEnglish = (mealType: string): string => {
    switch (mealType.toLowerCase()) {
      case 'frukost': return 'breakfast';
      case 'lunch': return 'lunch';
      case 'middag': return 'dinner';
      case 'mellanmål': return 'snack';
      default: return mealType.toLowerCase();
    }
  };

  const performSearch = async (query: string) => {
    if (query.length < 2) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('food-search', {
        body: { query }
      });
      
      if (error) throw error;
      
      setSearchResults(data || []);
    } catch (err: any) {
      console.error('Error searching products:', err);
      setError(err.message || 'Kunde inte söka efter produkter');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = (product: FoodProduct) => {
    setSelectedProduct(product);
    setQuantity('100');
    setShowProductModal(true);
  };

  const handleAddFood = async () => {
    if (addingToMeal) return; // Prevent multiple submissions
    
    try {
      setAddingToMeal(true);
      
      if (!selectedProduct) {
        throw new Error('No product selected');
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const quantityGrams = parseInt(quantity) || 100;
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0];
      const mealType = convertMealTypeToEnglish(mealName);
      
      // Calculate nutrition values based on quantity
      const caloriesTotal = Math.round((selectedProduct.calories * quantityGrams) / 100);
      const proteinTotal = Math.round((selectedProduct.protein * quantityGrams) / 100);
      const carbsTotal = Math.round((selectedProduct.carbs * quantityGrams) / 100);
      const fatTotal = Math.round((selectedProduct.fat * quantityGrams) / 100);
      
      // Add the food to the meal
      const { data, error } = await supabase.rpc('upsert_meal_entry', {
        p_user_id: user.id,
        p_date: formattedDate,
        p_meal_type: mealType,
        p_product_id: selectedProduct.off_id || selectedProduct.name,
        p_product_name: selectedProduct.name,
        p_quantity_grams: quantityGrams,
        p_calories_total: caloriesTotal,
        p_protein_total: proteinTotal,
        p_carbs_total: carbsTotal,
        p_fat_total: fatTotal
      });
      
      if (error) throw error;
      
      // Reset state before closing modal to prevent UI freeze
      setSelectedProduct(null);
      setShowProductModal(false);
      
      // Refresh data
      await fetchMealData();
      
      // Notify parent after everything is done
      if (onMealAdded) {
        onMealAdded();
      }
    } catch (err) {
      console.error('Error adding food to meal:', err);
      Alert.alert("Fel", "Kunde inte lägga till livsmedel i måltiden");
    } finally {
      setAddingToMeal(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      setDeletingItemId(itemId);
      
      const { error } = await supabase
        .from('meal_entries')
        .delete()
        .eq('id', itemId);
        
      if (error) throw error;
      
      // Update local state
      setMealEntries(prev => prev.filter(item => item.id !== itemId));
      
      // Refresh meal data
      await fetchMealData();
      
      // Notify parent
      if (onMealAdded) {
        onMealAdded();
      }
    } catch (err) {
      console.error('Error deleting item:', err);
      Alert.alert('Fel', 'Kunde inte ta bort livsmedlet');
    } finally {
      setDeletingItemId(null);
    }
  };

  const calculateNutrition = (product: FoodProduct, quantityGrams: number) => {
    return {
      calories: Math.round((product.calories * quantityGrams) / 100),
      protein: Math.round((product.protein * quantityGrams) / 100),
      carbs: Math.round((product.carbs * quantityGrams) / 100),
      fat: Math.round((product.fat * quantityGrams) / 100),
    };
  };

  const incrementQuantity = () => {
    const current = parseInt(quantity) || 0;
    setQuantity((current + 10).toString());
  };

  const decrementQuantity = () => {
    const current = parseInt(quantity) || 0;
    if (current > 10) {
      setQuantity((current - 10).toString());
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>{mealName}</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#808080" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Sök efter livsmedel..."
            placeholderTextColor="#808080"
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <Pressable
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <X size={16} color="#808080" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Logged meal items section */}
      {loadingMeal ? (
        <View style={styles.loadingMealContainer}>
          <ActivityIndicator size="small" color="#009dff" />
          <Text style={styles.loadingMealText}>Laddar måltid...</Text>
        </View>
      ) : mealEntries.length > 0 ? (
        <View style={styles.mealItemsContainer}>
          <Text style={styles.mealItemsTitle}>Loggade livsmedel</Text>
          <ScrollView style={styles.mealItemsList}>
            {mealEntries.map((item) => (
              <Pressable 
                key={item.id} 
                style={styles.mealItemCard}
                onPress={() => onViewItemDetail && onViewItemDetail(item)}
              >
                <View style={styles.foodItemInfo}>
                  <Text style={styles.foodItemName}>{item.product_name}</Text>
                  <Text style={styles.foodItemDetails}>
                    {item.quantity_grams}g • {item.calories_total} kcal
                  </Text>
                </View>
                <View style={styles.mealItemActions}>
                  <Pressable 
                    style={styles.mealItemAction}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(item.id);
                    }}
                    disabled={deletingItemId === item.id}
                  >
                    {deletingItemId === item.id ? (
                      <ActivityIndicator size="small" color="#FF4444" />
                    ) : (
                      <Trash2 size={18} color="#FF4444" />
                    )}
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          
          {onViewMealDetails && (
            <Pressable 
              style={styles.viewDetailsButton}
              onPress={onViewMealDetails}
            >
              <Text style={styles.viewDetailsText}>Visa måltidsdetaljer</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      <ScrollView style={styles.scrollContainer}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#009dff" />
            <Text style={styles.loadingText}>Söker produkter...</Text>
          </View>
        ) : searchResults.length > 0 ? (
          <>
            <Text style={styles.resultsTitle}>Sökresultat</Text>
            {searchResults.map((product, index) => (
              <Pressable 
                key={index} 
                style={styles.productItem}
                onPress={() => handleSelectProduct(product)}
              >
                {product.image_url ? (
                  <Image 
                    source={{ uri: product.image_url }} 
                    style={styles.productImage}
                    defaultSource={require('../assets/images/icon.png')}
                  />
                ) : (
                  <View style={styles.productImagePlaceholder} />
                )}
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  {product.brand && (
                    <Text style={styles.productBrand}>{product.brand}</Text>
                  )}
                  <View style={styles.nutritionRow}>
                    <Text style={styles.nutritionText}>
                      {product.calories} kcal • {product.protein}g protein • {product.carbs}g kolh • {product.fat}g fett
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </>
        ) : searchQuery.length >= 2 ? (
          <View style={styles.emptyResultsContainer}>
            <Text style={styles.emptyResultsText}>Inga produkter hittades</Text>
            <Text style={styles.emptyResultsSubtext}>Försök med en annan sökterm</Text>
          </View>
        ) : (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>Sök efter livsmedel</Text>
            <Text style={styles.instructionsText}>
              Skriv in namnet på en produkt, varumärke eller ingrediens för att hitta näringsinformation.
            </Text>
          </View>
        )}
      </ScrollView>
      
      {/* Product Detail Modal */}
      <Modal
        visible={showProductModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!addingToMeal) {
            setShowProductModal(false);
            setSelectedProduct(null);
          }
        }}
      >
        {selectedProduct && (
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Lägg till måltid</Text>
                <Pressable 
                  style={styles.closeButton}
                  onPress={() => {
                    if (!addingToMeal) {
                      setShowProductModal(false);
                      setSelectedProduct(null);
                    }
                  }}
                  disabled={addingToMeal}
                >
                  <X size={24} color="#FFFFFF" />
                </Pressable>
              </View>
              
              <ScrollView style={styles.modalBody}>
                <View style={styles.productHeader}>
                  {selectedProduct.image_url ? (
                    <Image 
                      source={{ uri: selectedProduct.image_url }} 
                      style={styles.modalProductImage}
                    />
                  ) : (
                    <View style={styles.modalProductImagePlaceholder} />
                  )}
                  <View style={styles.productHeaderInfo}>
                    <Text style={styles.modalProductName}>{selectedProduct.name}</Text>
                    {selectedProduct.brand && (
                      <Text style={styles.modalProductBrand}>{selectedProduct.brand}</Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.quantityContainer}>
                  <Text style={styles.quantityLabel}>Mängd (gram)</Text>
                  <View style={styles.quantityControls}>
                    <Pressable 
                      style={styles.quantityButton}
                      onPress={decrementQuantity}
                      disabled={addingToMeal}
                    >
                      <Minus size={20} color="#FFFFFF" />
                    </Pressable>
                    <TextInput
                      style={styles.quantityInput}
                      value={quantity}
                      onChangeText={(text) => setQuantity(text.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                      editable={!addingToMeal}
                    />
                    <Pressable 
                      style={styles.quantityButton}
                      onPress={incrementQuantity}
                      disabled={addingToMeal}
                    >
                      <Plus size={20} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>
                
                <View style={styles.nutritionContainer}>
                  <Text style={styles.nutritionTitle}>Näringsvärde</Text>
                  
                  <View style={styles.nutritionTable}>
                    <View style={styles.nutritionHeader}>
                      <Text style={styles.nutritionHeaderText}>Näringsämne</Text>
                      <Text style={styles.nutritionHeaderText}>Per 100g</Text>
                      <Text style={styles.nutritionHeaderText}>
                        {parseInt(quantity) || 100}g
                      </Text>
                    </View>
                    
                    <View style={styles.nutritionRow}>
                      <Text style={styles.nutritionName}>Energi</Text>
                      <Text style={styles.nutritionValue}>{selectedProduct.calories} kcal</Text>
                      <Text style={styles.nutritionValue}>
                        {calculateNutrition(selectedProduct, parseInt(quantity) || 100).calories} kcal
                      </Text>
                    </View>
                    
                    <View style={styles.nutritionRow}>
                      <Text style={styles.nutritionName}>Protein</Text>
                      <Text style={styles.nutritionValue}>{selectedProduct.protein}g</Text>
                      <Text style={styles.nutritionValue}>
                        {calculateNutrition(selectedProduct, parseInt(quantity) || 100).protein}g
                      </Text>
                    </View>
                    
                    <View style={styles.nutritionRow}>
                      <Text style={styles.nutritionName}>Kolhydrater</Text>
                      <Text style={styles.nutritionValue}>{selectedProduct.carbs}g</Text>
                      <Text style={styles.nutritionValue}>
                        {calculateNutrition(selectedProduct, parseInt(quantity) || 100).carbs}g
                      </Text>
                    </View>
                    
                    <View style={styles.nutritionRow}>
                      <Text style={styles.nutritionName}>Fett</Text>
                      <Text style={styles.nutritionValue}>{selectedProduct.fat}g</Text>
                      <Text style={styles.nutritionValue}>
                        {calculateNutrition(selectedProduct, parseInt(quantity) || 100).fat}g
                      </Text>
                    </View>
                  </View>
                </View>
                
                <Pressable
                  style={[styles.addButton, addingToMeal && styles.addButtonDisabled]}
                  onPress={handleAddFood}
                  disabled={addingToMeal}
                >
                  {addingToMeal ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Check size={20} color="#FFFFFF" />
                      <Text style={styles.addButtonText}>Lägg till i {mealName}</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
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
  clearButton: {
    padding: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    marginTop: 16,
  },
  errorContainer: {
    padding: 24,
    margin: 16,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#FF4444',
    textAlign: 'center',
  },
  resultsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  productItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
    backgroundColor: '#262626',
  },
  productImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#262626',
    marginRight: 16,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  productBrand: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#808080',
    marginBottom: 4,
  },
  nutritionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  nutritionText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#B0B0B0',
  },
  emptyResultsContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyResultsText: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyResultsSubtext: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#808080',
    textAlign: 'center',
  },
  instructionsContainer: {
    padding: 48,
    alignItems: 'center',
  },
  instructionsTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  instructionsText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#808080',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalBody: {
    padding: 24,
  },
  productHeader: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  modalProductImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
    backgroundColor: '#262626',
  },
  modalProductImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#262626',
    marginRight: 16,
  },
  productHeaderInfo: {
    flex: 1,
  },
  modalProductName: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modalProductBrand: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#808080',
  },
  quantityContainer: {
    marginBottom: 24,
  },
  quantityLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#009dff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    width: 100,
    height: 48,
    backgroundColor: '#262626',
    borderRadius: 8,
    marginHorizontal: 16,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  nutritionContainer: {
    marginBottom: 24,
  },
  nutritionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  nutritionTable: {
    backgroundColor: '#262626',
    borderRadius: 12,
    overflow: 'hidden',
  },
  nutritionHeader: {
    flexDirection: 'row',
    backgroundColor: '#333333',
    padding: 12,
  },
  nutritionHeaderText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  nutritionRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    padding: 12,
  },
  nutritionName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  nutritionValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#009dff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 32, // Add extra bottom margin for mobile
    gap: 8,
  },
  addButtonDisabled: {
    opacity: 0.7,
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  // Meal items styles
  mealItemsContainer: {
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    paddingVertical: 16,
  },
  mealItemsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  mealItemsList: {
    maxHeight: 200,
  },
  mealItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  foodItemInfo: {
    flex: 1,
  },
  foodItemName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  foodItemDetails: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#808080',
  },
  mealItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  mealItemAction: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#333333',
  },
  loadingMealContainer: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  loadingMealText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    marginTop: 8,
  },
  viewDetailsButton: {
    backgroundColor: '#333333',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
  },
  viewDetailsText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#009dff',
  },
});