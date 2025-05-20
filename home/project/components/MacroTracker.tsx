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
  Alert,
  Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { 
  lookupProductByBarcode, 
  calculateNutrition, 
  createMeal, 
  addFoodToMeal,
  getDailyNutritionSummary,
  deleteMeal,
  deleteMealItem,
  searchProductsByName,
  FoodProduct,
  NutritionSummary,
  Meal
} from '@/lib/macrotracker';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Plus, CreditCard as Edit2, Trash2, X, ChartBar as BarChart3, Scan, Search } from 'lucide-react-native';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

type Props = {
  onClose?: () => void;
};

export default function MacroTracker({ onClose }: Props) {
  const [nutritionSummary, setNutritionSummary] = useState<NutritionSummary>({
    total_calories: 0,
    total_protein: 0,
    total_carbs: 0,
    total_fat: 0,
    meals: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [scanningBarcode, setScanningBarcode] = useState(false);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<FoodProduct | null>(null);
  const [searchResults, setSearchResults] = useState<FoodProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<FoodProduct | null>(null);
  
  // Form state
  const [mealName, setMealName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [servingSize, setServingSize] = useState('100');
  const [searchQuery, setSearchQuery] = useState('');
  
  // User goals (hardcoded for now, could be fetched from user profile later)
  const userGoals = {
    calories: 3000,
    protein: 180,
    carbs: 320,
    fat: 70
  };

  useEffect(() => {
    fetchNutritionData();
  }, [selectedDate]);

  const fetchNutritionData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await getDailyNutritionSummary(selectedDate);
      setNutritionSummary(data || {
        total_calories: 0,
        total_protein: 0,
        total_carbs: 0,
        total_fat: 0,
        meals: []
      });
    } catch (err) {
      console.error('Error fetching nutrition data:', err);
      setError('Kunde inte ladda nutritionsdata');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMeal = async () => {
    try {
      if (!mealName.trim()) {
        Alert.alert('Fel', 'Ange ett namn för måltiden');
        return;
      }

      if (!calories || !protein || !carbs || !fat) {
        Alert.alert('Fel', 'Alla näringsvärden måste anges');
        return;
      }

      setLoading(true);
      
      // Create a new meal
      const meal = await createMeal(mealName.trim());
      
      // Create a product from manual input or selected product
      let product: FoodProduct;
      
      if (selectedProduct) {
        product = selectedProduct;
      } else {
        product = {
          name: mealName.trim(),
          brand: '',
          calories: parseInt(calories),
          protein: parseInt(protein),
          carbs: parseInt(carbs),
          fat: parseInt(fat),
          image_url: ''
        };
      }
      
      // Add the food to the meal
      await addFoodToMeal(meal.id!, product, parseInt(servingSize));

      // Reset form and close modal
      resetForm();
      setShowAddModal(false);
      setShowSearchModal(false);
      
      // Refresh data
      fetchNutritionData();
    } catch (err) {
      console.error('Error saving meal:', err);
      Alert.alert('Fel', 'Kunde inte spara måltiden');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeal = async (mealId: string) => {
    try {
      setLoading(true);
      
      await deleteMeal(mealId);
      
      // Refresh data
      fetchNutritionData();
    } catch (err) {
      console.error('Error deleting meal:', err);
      Alert.alert('Fel', 'Kunde inte radera måltiden');
    } finally {
      setLoading(false);
    }
  };

  const handleEditMeal = (meal: Meal) => {
    setEditingMeal(meal);
    setMealName(meal.name);
    setCalories(meal.total_calories.toString());
    setProtein(meal.total_protein.toString());
    setCarbs(meal.total_carbs.toString());
    setFat(meal.total_fat.toString());
    setShowAddModal(true);
  };

  const resetForm = () => {
    setEditingMeal(null);
    setMealName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setServingSize('100');
    setScannedProduct(null);
    setSelectedProduct(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleScanBarcode = async (barcode: string) => {
    try {
      setScanningBarcode(true);
      
      const product = await lookupProductByBarcode(barcode);
      setScannedProduct(product);
      setSelectedProduct(product);
      
      // Pre-fill form with scanned product data
      setMealName(product.name);
      
      // Calculate based on serving size
      const servingSizeMultiplier = parseInt(servingSize) / 100;
      setCalories(Math.round(product.calories * servingSizeMultiplier).toString());
      setProtein(Math.round(product.protein * servingSizeMultiplier).toString());
      setCarbs(Math.round(product.carbs * servingSizeMultiplier).toString());
      setFat(Math.round(product.fat * servingSizeMultiplier).toString());
      
      setShowScanModal(false);
      setShowAddModal(true);
    } catch (err: any) {
      console.error('Error scanning barcode:', err);
      Alert.alert('Fel', err.message || 'Kunde inte skanna streckkoden');
    } finally {
      setScanningBarcode(false);
    }
  };

  const handleSearchProducts = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Fel', 'Ange en sökterm');
      return;
    }

    try {
      setSearchingProducts(true);
      setError(null);
      
      const results = await searchProductsByName(searchQuery.trim());
      setSearchResults(results);
    } catch (err: any) {
      console.error('Error searching products:', err);
      setError(err.message || 'Kunde inte söka efter produkter');
      setSearchResults([]);
    } finally {
      setSearchingProducts(false);
    }
  };

  const handleSelectProduct = (product: FoodProduct) => {
    setSelectedProduct(product);
    setMealName(product.name);
    
    // Calculate based on serving size
    const servingSizeMultiplier = parseInt(servingSize) / 100;
    setCalories(Math.round(product.calories * servingSizeMultiplier).toString());
    setProtein(Math.round(product.protein * servingSizeMultiplier).toString());
    setCarbs(Math.round(product.carbs * servingSizeMultiplier).toString());
    setFat(Math.round(product.fat * servingSizeMultiplier).toString());
    
    setShowSearchModal(false);
    setShowAddModal(true);
  };

  const updateNutritionFromServingSize = () => {
    if (!selectedProduct) return;
    
    const servingSizeMultiplier = parseInt(servingSize) / 100;
    setCalories(Math.round(selectedProduct.calories * servingSizeMultiplier).toString());
    setProtein(Math.round(selectedProduct.protein * servingSizeMultiplier).toString());
    setCarbs(Math.round(selectedProduct.carbs * servingSizeMultiplier).toString());
    setFat(Math.round(selectedProduct.fat * servingSizeMultiplier).toString());
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'HH:mm', { locale: sv });
  };

  const formatDate = (date: Date) => {
    return format(date, 'EEEE d MMMM', { locale: sv });
  };

  const caloriesRemaining = userGoals.calories - nutritionSummary.total_calories;
  const caloriesConsumed = nutritionSummary.total_calories;
  const caloriesBurned = 0; // This would be fetched from activity tracking in a real app

  // Calculate progress percentages for macros
  const proteinPercentage = Math.min((nutritionSummary.total_protein / userGoals.protein) * 100, 100);
  const carbsPercentage = Math.min((nutritionSummary.total_carbs / userGoals.carbs) * 100, 100);
  const fatPercentage = Math.min((nutritionSummary.total_fat / userGoals.fat) * 100, 100);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(0,157,255,0.1)', 'rgba(0,0,0,1)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.3 }}
      />

      <View style={styles.header}>
        <Text style={styles.title}>Nutrition</Text>
        
        <Pressable style={styles.dateSelector}>
          <Calendar size={20} color="#FFFFFF" />
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content}>
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={fetchNutritionData}>
              <Text style={styles.retryButtonText}>Försök igen</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.calorieCircleContainer}>
              <View style={styles.calorieInfoLeft}>
                <Text style={styles.calorieInfoTitle}>ÄTIT</Text>
                <Text style={styles.calorieInfoValue}>{caloriesConsumed}</Text>
              </View>
              
              <View style={styles.calorieCircle}>
                <Text style={styles.calorieValue}>{caloriesRemaining}</Text>
                <Text style={styles.calorieLabel}>KCAL KVAR</Text>
              </View>
              
              <View style={styles.calorieInfoRight}>
                <Text style={styles.calorieInfoTitle}>BRÄNT</Text>
                <Text style={styles.calorieInfoValue}>{caloriesBurned}</Text>
              </View>
            </View>

            <Pressable 
              style={styles.viewNutritionButton}
              onPress={() => {/* Navigate to detailed nutrition view */}}
            >
              <BarChart3 size={16} color="#009dff" />
              <Text style={styles.viewNutritionText}>VIEW NUTRITION</Text>
            </Pressable>

            <View style={styles.macrosContainer}>
              <View style={styles.macroItem}>
                <View style={styles.macroLabelContainer}>
                  <Text style={styles.macroLabel}>Kolhydrater</Text>
                  <Text style={styles.macroValue}>
                    {nutritionSummary.total_carbs} / {userGoals.carbs}g
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBar, 
                      { width: `${carbsPercentage}%`, backgroundColor: '#009dff' }
                    ]} 
                  />
                </View>
              </View>

              <View style={styles.macroItem}>
                <View style={styles.macroLabelContainer}>
                  <Text style={styles.macroLabel}>Protein</Text>
                  <Text style={styles.macroValue}>
                    {nutritionSummary.total_protein} / {userGoals.protein}g
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBar, 
                      { width: `${proteinPercentage}%`, backgroundColor: '#009dff' }
                    ]} 
                  />
                </View>
              </View>

              <View style={styles.macroItem}>
                <View style={styles.macroLabelContainer}>
                  <Text style={styles.macroLabel}>Fett</Text>
                  <Text style={styles.macroValue}>
                    {nutritionSummary.total_fat} / {userGoals.fat}g
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBar, 
                      { width: `${fatPercentage}%`, backgroundColor: '#009dff' }
                    ]} 
                  />
                </View>
              </View>
            </View>

            <Pressable 
              style={styles.logFoodButton}
              onPress={() => {
                resetForm();
                setShowAddModal(true);
              }}
            >
              <Text style={styles.logFoodButtonText}>Log Food</Text>
            </Pressable>

            <View style={styles.mealsContainer}>
              <Text style={styles.sectionTitle}>
                TODAY, {format(new Date(), 'MMM d').toUpperCase()}
              </Text>

              {nutritionSummary.meals && nutritionSummary.meals.length > 0 ? (
                nutritionSummary.meals.map((meal) => (
                  <View key={meal.id} style={styles.mealCard}>
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealName}>{meal.name}</Text>
                      <Text style={styles.mealTime}>{formatDateTime(meal.created_at!)}</Text>
                    </View>
                    <View style={styles.mealCalories}>
                      <Text style={styles.caloriesText}>{meal.total_calories} kcal</Text>
                    </View>
                    <View style={styles.mealActions}>
                      <Pressable 
                        style={styles.actionButton}
                        onPress={() => handleEditMeal(meal)}
                      >
                        <Edit2 size={18} color="#009dff" />
                      </Pressable>
                      <Pressable 
                        style={styles.actionButton}
                        onPress={() => {
                          Alert.alert(
                            'Radera måltid',
                            'Är du säker på att du vill radera denna måltid?',
                            [
                              { text: 'Avbryt', style: 'cancel' },
                              { 
                                text: 'Radera', 
                                style: 'destructive',
                                onPress: () => handleDeleteMeal(meal.id!)
                              }
                            ]
                          );
                        }}
                      >
                        <Trash2 size={18} color="#FF4444" />
                      </Pressable>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyMealsContainer}>
                  <Text style={styles.emptyMealsText}>
                    Inga måltider loggade idag
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Add/Edit Meal Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingMeal ? 'Redigera måltid' : 'Lägg till måltid'}
              </Text>
              <Pressable 
                style={styles.closeButton}
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                <X size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Måltidsnamn</Text>
                <TextInput
                  style={styles.input}
                  value={mealName}
                  onChangeText={setMealName}
                  placeholder="T.ex. Frukost, Lunch, Proteinshake..."
                  placeholderTextColor="#808080"
                />
              </View>

              {selectedProduct && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Portionsstorlek (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={servingSize}
                    onChangeText={(text) => {
                      setServingSize(text.replace(/[^0-9]/g, ''));
                      // Update nutrition values based on new serving size
                      if (text && !isNaN(parseInt(text))) {
                        const newServingSize = parseInt(text);
                        if (newServingSize > 0) {
                          setServingSize(text);
                          setTimeout(updateNutritionFromServingSize, 100);
                        }
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="100"
                    placeholderTextColor="#808080"
                  />
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.label}>Kalorier (kcal)</Text>
                <TextInput
                  style={styles.input}
                  value={calories}
                  onChangeText={(text) => setCalories(text.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#808080"
                />
              </View>

              <View style={styles.macroInputsRow}>
                <View style={[styles.formGroup, styles.macroInput]}>
                  <Text style={styles.label}>Protein (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={protein}
                    onChangeText={(text) => setProtein(text.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#808080"
                  />
                </View>

                <View style={[styles.formGroup, styles.macroInput]}>
                  <Text style={styles.label}>Kolhydrater (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={carbs}
                    onChangeText={(text) => setCarbs(text.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#808080"
                  />
                </View>

                <View style={[styles.formGroup, styles.macroInput]}>
                  <Text style={styles.label}>Fett (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={fat}
                    onChangeText={(text) => setFat(text.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#808080"
                  />
                </View>
              </View>

              <View style={styles.buttonContainer}>
                <Pressable
                  style={styles.scanButton}
                  onPress={() => {
                    setShowAddModal(false);
                    setShowScanModal(true);
                  }}
                >
                  <Scan size={20} color="#FFFFFF" />
                  <Text style={styles.scanButtonText}>Skanna streckkod</Text>
                </Pressable>

                <Pressable
                  style={styles.searchButton}
                  onPress={() => {
                    setShowAddModal(false);
                    setShowSearchModal(true);
                  }}
                >
                  <Search size={20} color="#FFFFFF" />
                  <Text style={styles.searchButtonText}>Sök produkt</Text>
                </Pressable>
              </View>

              <Pressable
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                onPress={handleAddMeal}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingMeal ? 'Uppdatera' : 'Spara'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal
        visible={showScanModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowScanModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Skanna streckkod</Text>
              <Pressable 
                style={styles.closeButton}
                onPress={() => setShowScanModal(false)}
              >
                <X size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.scannerContainer}>
              <Text style={styles.scannerText}>
                Kameravy för streckkodsskanning skulle vara här
              </Text>
              
              {/* For demo purposes, let's add a text input for manual barcode entry */}
              <View style={styles.manualBarcodeContainer}>
                <Text style={styles.manualBarcodeLabel}>
                  Ange streckkod manuellt:
                </Text>
                <TextInput
                  style={styles.manualBarcodeInput}
                  placeholder="t.ex. 7310865004703"
                  placeholderTextColor="#808080"
                  keyboardType="numeric"
                  onSubmitEditing={(e) => handleScanBarcode(e.nativeEvent.text)}
                />
                <Pressable
                  style={styles.manualScanButton}
                  onPress={() => {
                    // For demo, use a sample barcode (Oatly oat milk)
                    handleScanBarcode('7310865004703');
                  }}
                >
                  <Text style={styles.manualScanButtonText}>
                    {scanningBarcode ? 'Söker...' : 'Sök produkt'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Product Search Modal */}
      <Modal
        visible={showSearchModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sök produkt</Text>
              <Pressable 
                style={styles.closeButton}
                onPress={() => setShowSearchModal(false)}
              >
                <X size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Sök efter livsmedel..."
                placeholderTextColor="#808080"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                onSubmitEditing={handleSearchProducts}
              />
              <Pressable
                style={styles.searchButton}
                onPress={handleSearchProducts}
              >
                <Search size={20} color="#FFFFFF" />
                <Text style={styles.searchButtonText}>Sök</Text>
              </Pressable>
            </View>

            {searchingProducts ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#009dff" />
                <Text style={styles.loadingText}>Söker produkter...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <ScrollView style={styles.searchResultsContainer}>
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
                      />
                    ) : (
                      <View style={styles.productImagePlaceholder} />
                    )}
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productBrand}>{product.brand}</Text>
                      <Text style={styles.productNutrition}>
                        {product.calories} kcal | {product.protein}g protein | {product.carbs}g kolh | {product.fat}g fett
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            ) : searchQuery ? (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>Inga produkter hittades</Text>
              </View>
            ) : (
              <View style={styles.searchInstructionsContainer}>
                <Text style={styles.searchInstructionsText}>
                  Sök efter livsmedel genom att ange namn, varumärke eller beskrivning
                </Text>
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
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
  },
  title: {
    fontSize: 32,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 0,
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
  calorieCircleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  calorieInfoLeft: {
    alignItems: 'center',
  },
  calorieInfoRight: {
    alignItems: 'center',
  },
  calorieInfoTitle: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  calorieInfoValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: 'Inter-SemiBold',
  },
  calorieCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  calorieValue: {
    color: '#FFFFFF',
    fontSize: 48,
    fontFamily: 'Inter-SemiBold',
  },
  calorieLabel: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 8,
  },
  viewNutritionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  viewNutritionText: {
    color: '#009dff',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  macrosContainer: {
    marginBottom: 24,
    gap: 16,
  },
  macroItem: {
    gap: 8,
  },
  macroLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  macroValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#333333',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  logFoodButton: {
    backgroundColor: '#009dff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  logFoodButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  mealsContainer: {
    gap: 16,
  },
  sectionTitle: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  mealCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  mealTime: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  mealCalories: {
    marginRight: 16,
  },
  caloriesText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  mealActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
    backgroundColor: '#262626',
    borderRadius: 8,
  },
  emptyMealsContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
  },
  emptyMealsText: {
    color: '#808080',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
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
    maxHeight: '80%',
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
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalBody: {
    padding: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
  },
  macroInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  macroInput: {
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 24,
    marginBottom: 24,
  },
  scanButton: {
    flex: 1,
    backgroundColor: '#333333',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  searchButton: {
    flex: 1,
    backgroundColor: '#333333',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  saveButton: {
    backgroundColor: '#009dff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  scannerContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    height: 300,
  },
  scannerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginBottom: 24,
  },
  manualBarcodeContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  manualBarcodeLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  manualBarcodeInput: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    width: '100%',
  },
  manualScanButton: {
    backgroundColor: '#009dff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  manualScanButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 0,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
  },
  searchResultsContainer: {
    padding: 24,
    paddingTop: 0,
    maxHeight: 400,
  },
  productItem: {
    flexDirection: 'row',
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  productImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#333333',
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  productBrand: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 4,
  },
  productNutrition: {
    color: '#B0B0B0',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginTop: 16,
  },
  noResultsContainer: {
    padding: 48,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#808080',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  searchInstructionsContainer: {
    padding: 48,
    alignItems: 'center',
  },
  searchInstructionsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
});