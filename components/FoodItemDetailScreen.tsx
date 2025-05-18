import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { 
  updateMealItemQuantity,
  deleteMealItem,
  MealItem
} from '@/lib/macrotracker';
import { ArrowLeft, Trash2, ChevronDown, Heart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  onClose: () => void;
  onBackToSearch: () => void;
  item: MealItem;
  mealName: string;
  onItemUpdated: () => void;
};

export default function FoodItemDetailScreen({ onClose, onBackToSearch, item, mealName, onItemUpdated }: Props) {
  const [quantity, setQuantity] = useState(item.quantity_grams.toString());
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const calculateNutrition = (quantityGrams: number) => {
    const multiplier = quantityGrams / 100;
    return {
      calories: Math.round(item.energy_kcal_100g * multiplier),
      protein: Math.round(item.protein_100g * multiplier),
      carbs: Math.round(item.carbs_100g * multiplier),
      fat: Math.round(item.fat_100g * multiplier),
    };
  };

  const calculateMacroPercentages = (protein: number, carbs: number, fat: number) => {
    const total = protein + carbs + fat;
    if (total === 0) return { protein: 0, carbs: 0, fat: 0 };
    
    return {
      protein: Math.round((protein / total) * 100),
      carbs: Math.round((carbs / total) * 100),
      fat: Math.round((fat / total) * 100),
    };
  };

  const handleUpdateQuantity = async () => {
    try {
      setLoading(true);
      const newQuantity = parseInt(quantity);
      
      if (isNaN(newQuantity) || newQuantity <= 0) {
        Alert.alert('Fel', 'Ange en giltig mängd större än 0');
        return;
      }
      
      await updateMealItemQuantity(item.id!, newQuantity);
      onItemUpdated();
      onBackToSearch();
    } catch (err) {
      console.error('Error updating item quantity:', err);
      Alert.alert('Fel', 'Kunde inte uppdatera mängden');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteMealItem(item.id!);
      onItemUpdated();
      onBackToSearch();
    } catch (err) {
      console.error('Error deleting item:', err);
      Alert.alert('Fel', 'Kunde inte ta bort livsmedlet');
    } finally {
      setDeleting(false);
    }
  };

  const nutrition = calculateNutrition(parseInt(quantity) || item.quantity_grams);
  const macroPercentages = calculateMacroPercentages(
    nutrition.protein,
    nutrition.carbs,
    nutrition.fat
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBackToSearch}>
          <ArrowLeft size={24} color="#000000" />
        </Pressable>
        
        <View style={styles.headerActions}>
          <Pressable style={styles.favoriteButton}>
            <Heart size={24} color="#000000" />
          </Pressable>
          <Pressable 
            style={styles.deleteButton}
            onPress={() => {
              Alert.alert(
                'Ta bort livsmedel',
                `Är du säker på att du vill ta bort ${item.product_name}?`,
                [
                  { text: 'Avbryt', style: 'cancel' },
                  { 
                    text: 'Ta bort', 
                    style: 'destructive',
                    onPress: handleDelete
                  }
                ]
              );
            }}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Trash2 size={24} color="#000000" />
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{item.product_name} {item.brand ? `(${item.brand})` : ''}</Text>
        </View>

        <View style={styles.quantityContainer}>
          <TextInput
            style={styles.quantityInput}
            value={quantity}
            onChangeText={(text) => setQuantity(text.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
          />
          
          <View style={styles.unitSelector}>
            <Text style={styles.unitText}>Gram</Text>
            <ChevronDown size={20} color="#000000" />
          </View>
        </View>

        <View style={styles.mealTypeSelector}>
          <Text style={styles.mealTypeText}>{mealName}</Text>
          <ChevronDown size={20} color="#000000" />
        </View>

        <View style={styles.calorieContainer}>
          <Text style={styles.calorieText}>{nutrition.calories} kcal</Text>
        </View>

        <View style={styles.macroContainer}>
          {/* Carbs */}
          <View style={styles.macroItem}>
            <View style={styles.macroBarContainer}>
              <View 
                style={[
                  styles.macroBar, 
                  styles.carbsBar, 
                  { width: `${macroPercentages.carbs}%` }
                ]} 
              />
            </View>
            <Text style={styles.macroLabel}>Kolhydrater</Text>
            <Text style={styles.macroValue}>{nutrition.carbs} g</Text>
          </View>

          {/* Protein */}
          <View style={styles.macroItem}>
            <View style={styles.macroBarContainer}>
              <View 
                style={[
                  styles.macroBar, 
                  styles.proteinBar, 
                  { width: `${macroPercentages.protein}%` }
                ]} 
              />
            </View>
            <Text style={styles.macroLabel}>Protein</Text>
            <Text style={styles.macroValue}>{nutrition.protein} g</Text>
          </View>

          {/* Fat */}
          <View style={styles.macroItem}>
            <View style={styles.macroBarContainer}>
              <View 
                style={[
                  styles.macroBar, 
                  styles.fatBar, 
                  { width: `${macroPercentages.fat}%` }
                ]} 
              />
            </View>
            <Text style={styles.macroLabel}>Fett</Text>
            <Text style={styles.macroValue}>{nutrition.fat} g</Text>
          </View>
        </View>

        <View style={styles.nutritionInfoContainer}>
          <Text style={styles.nutritionInfoTitle}>MATBETYG</Text>
          
          <View style={styles.nutritionInfoContent}>
            <View style={styles.ratingContainer}>
              <View style={styles.ratingIcon}>
                <Text style={styles.ratingEmoji}>😊</Text>
              </View>
              <Text style={styles.ratingValue}>{nutrition.calories} kcal</Text>
            </View>
            
            <View style={styles.ratingDescription}>
              <Text style={styles.ratingDescriptionText}>
                Vill du veta anledningen till livsmedelspoängen?
              </Text>
              <Text style={styles.ratingDescriptionSubtext}>
                Se hur den här maten ger din kropp näring.
              </Text>
            </View>
            
            <Pressable style={styles.ratingInfoButton}>
              <Text style={styles.ratingInfoButtonText}>FÅ BETYGSINFORMATION</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.nutritionDetailsContainer}>
          <Text style={styles.nutritionDetailsTitle}>NÄRINGSVÄRDEN</Text>
          
          <View style={styles.nutritionDetailsTable}>
            <View style={styles.nutritionDetailsRow}>
              <Text style={styles.nutritionDetailsLabel}>Energi</Text>
              <Text style={styles.nutritionDetailsValue}>{nutrition.calories} kcal</Text>
            </View>
            
            <View style={styles.nutritionDetailsRow}>
              <Text style={styles.nutritionDetailsLabel}>Protein</Text>
              <Text style={styles.nutritionDetailsValue}>{nutrition.protein} g</Text>
            </View>
            
            <View style={styles.nutritionDetailsRow}>
              <Text style={styles.nutritionDetailsLabel}>Kolhydrater</Text>
              <Text style={styles.nutritionDetailsValue}>{nutrition.carbs} g</Text>
            </View>
            
            <View style={styles.nutritionDetailsRow}>
              <Text style={styles.nutritionDetailsLabel}>Fett</Text>
              <Text style={styles.nutritionDetailsValue}>{nutrition.fat} g</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Pressable 
        style={[styles.updateButton, loading && styles.updateButtonDisabled]}
        onPress={handleUpdateQuantity}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.updateButtonText}>UPPDATERA</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  favoriteButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  titleContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#000000',
  },
  quantityContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  quantityInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#000000',
    marginRight: 8,
    textAlign: 'center',
  },
  unitSelector: {
    flex: 3,
    height: 48,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitText: {
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    color: '#000000',
  },
  mealTypeSelector: {
    height: 48,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 16,
  },
  mealTypeText: {
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    color: '#000000',
  },
  calorieContainer: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },
  calorieText: {
    fontSize: 32,
    fontFamily: 'Inter-SemiBold',
    color: '#000000',
  },
  macroContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  macroItem: {
    alignItems: 'center',
    width: '30%',
  },
  macroBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  macroBar: {
    height: '100%',
    borderRadius: 4,
  },
  carbsBar: {
    backgroundColor: '#F59E0B',
  },
  proteinBar: {
    backgroundColor: '#22C55E',
  },
  fatBar: {
    backgroundColor: '#EF4444',
  },
  macroLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#808080',
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#000000',
  },
  nutritionInfoContainer: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },
  nutritionInfoTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#808080',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  nutritionInfoContent: {
    padding: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#009dff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  ratingEmoji: {
    fontSize: 24,
  },
  ratingValue: {
    fontSize: 24,
    fontFamily: 'Inter-SemiBold',
    color: '#000000',
  },
  ratingDescription: {
    marginBottom: 16,
  },
  ratingDescriptionText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#000000',
    marginBottom: 8,
  },
  ratingDescriptionSubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#808080',
  },
  ratingInfoButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0E0E0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  ratingInfoButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#009dff',
  },
  nutritionDetailsContainer: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 80, // Space for the update button
  },
  nutritionDetailsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#808080',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  nutritionDetailsTable: {
    padding: 16,
  },
  nutritionDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  nutritionDetailsLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#000000',
  },
  nutritionDetailsValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#000000',
  },
  updateButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#009dff',
    paddingVertical: 16,
    alignItems: 'center',
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  updateButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});