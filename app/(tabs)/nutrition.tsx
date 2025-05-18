import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Plus, Coffee, Utensils, Apple, Pizza, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { format, addDays, subDays, isToday } from 'date-fns';
import { sv } from 'date-fns/locale/sv';
import NutritionModal from '@/components/NutritionModal';
import Protected from '@/components/Protected';
import { useNutritionData } from '@/lib/hooks/useNutritionData';

export default function NutritionScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentMealType, setCurrentMealType] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Use React Query hook for nutrition data
  const { dailyTotals, mealLog, isLoading, refetch } = useNutritionData(selectedDate);

  // Reset to today's date when navigating away and back
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleFocus = () => {
        setSelectedDate(new Date());
      };
      
      window.addEventListener('focus', handleFocus);
      return () => {
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, []);

  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  }, [refetch]);

  const formatDate = React.useCallback((date: Date) => {
    return format(date, 'EEEE d MMMM', { locale: sv });
  }, []);

  const handleMealCardPress = (mealType: string) => {
    setCurrentMealType(mealType);
    setShowAddModal(true);
  };

  // Get meal calories by type
  const getMealCalories = (mealType: string): number => {
    const meal = mealLog.find(m => m.meal_type.toLowerCase() === mealType.toLowerCase());
    return meal?.total_calories || 0;
  };

  const getMealIcon = (mealType: string) => {
    switch (mealType.toLowerCase()) {
      case 'frukost':
        return <Coffee size={24} color="#009dff" />;
      case 'lunch':
        return <Utensils size={24} color="#009dff" />;
      case 'middag':
        return <Pizza size={24} color="#009dff" />;
      case 'mellanmål':
        return <Apple size={24} color="#009dff" />;
      default:
        return <Coffee size={24} color="#009dff" />;
    }
  };

  // Calculate progress percentages for macros
  const userGoals = {
    calories: 3876,
    protein: 194,
    carbs: 485,
    fat: 129
  };
  
  const caloriePercentage = Math.min((dailyTotals.total_calories / userGoals.calories) * 100, 100);
  const proteinPercentage = Math.min((dailyTotals.total_protein / userGoals.protein) * 100, 100);
  const carbsPercentage = Math.min((dailyTotals.total_carbs / userGoals.carbs) * 100, 100);
  const fatPercentage = Math.min((dailyTotals.total_fat / userGoals.fat) * 100, 100);

  const handlePrevDay = () => {
    setSelectedDate(prevDate => subDays(prevDate, 1));
  };

  const handleNextDay = () => {
    setSelectedDate(prevDate => addDays(prevDate, 1));
  };

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
          <Text style={styles.title}>Nutrition</Text>
          
          <View style={styles.dateSelector}>
            <Pressable onPress={handlePrevDay} style={styles.dateNavButton}>
              <ChevronLeft size={20} color="#FFFFFF" />
            </Pressable>
            <View style={styles.dateTextContainer}>
              <Calendar size={20} color="#FFFFFF" style={styles.dateIcon} />
              <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
              {isToday(selectedDate) && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayText}>IDAG</Text>
                </View>
              )}
            </View>
            <Pressable onPress={handleNextDay} style={styles.dateNavButton}>
              <ChevronRight size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#009dff"
            />
          }
        >
          {isLoading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#009dff" />
            </View>
          ) : (
            <>
              <View style={styles.calorieCircleContainer}>
                <View style={styles.calorieInfoLeft}>
                  <Text style={styles.calorieInfoTitle}>ÄTIT</Text>
                  <Text style={styles.calorieInfoValue}>{dailyTotals.total_calories}</Text>
                </View>
                
                <View style={styles.calorieCircle}>
                  <Text style={styles.calorieValue}>{userGoals.calories - dailyTotals.total_calories}</Text>
                  <Text style={styles.calorieLabel}>KCAL KVAR</Text>
                </View>
                
                <View style={styles.calorieInfoRight}>
                  <Text style={styles.calorieInfoTitle}>BRÄNT</Text>
                  <Text style={styles.calorieInfoValue}>0</Text>
                </View>
              </View>

              <View style={styles.macrosContainer}>
                <View style={styles.macroItem}>
                  <View style={styles.macroLabelContainer}>
                    <Text style={styles.macroLabel}>Kolhydrater</Text>
                    <Text style={styles.macroValue}>
                      {dailyTotals.total_carbs} / {userGoals.carbs}g
                    </Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View 
                      style={[
                        styles.progressBar, 
                        { width: `${carbsPercentage}%`, backgroundColor: '#F59E0B' }
                      ]} 
                    />
                  </View>
                </View>

                <View style={styles.macroItem}>
                  <View style={styles.macroLabelContainer}>
                    <Text style={styles.macroLabel}>Protein</Text>
                    <Text style={styles.macroValue}>
                      {dailyTotals.total_protein} / {userGoals.protein}g
                    </Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View 
                      style={[
                        styles.progressBar, 
                        { width: `${proteinPercentage}%`, backgroundColor: '#22C55E' }
                      ]} 
                    />
                  </View>
                </View>

                <View style={styles.macroItem}>
                  <View style={styles.macroLabelContainer}>
                    <Text style={styles.macroLabel}>Fett</Text>
                    <Text style={styles.macroValue}>
                      {dailyTotals.total_fat} / {userGoals.fat}g
                    </Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View 
                      style={[
                        styles.progressBar, 
                        { width: `${fatPercentage}%`, backgroundColor: '#EF4444' }
                      ]} 
                    />
                  </View>
                </View>
              </View>

              {/* Meal Cards */}
              <View style={styles.mealCardsContainer}>
                {/* Breakfast */}
                <Pressable 
                  style={styles.mealCard}
                  onPress={() => handleMealCardPress('frukost')}
                >
                  <View style={styles.mealCardContent}>
                    <View style={styles.mealCardIcon}>
                      {getMealIcon('frukost')}
                    </View>
                    <View style={styles.mealCardInfo}>
                      <Text style={styles.mealCardTitle}>Frukost</Text>
                      <Text style={styles.mealCardCalories}>{getMealCalories('frukost')} kcal</Text>
                    </View>
                    <View style={styles.mealCardAction}>
                      <Plus size={24} color="#009dff" />
                    </View>
                  </View>
                </Pressable>

                {/* Lunch */}
                <Pressable 
                  style={styles.mealCard}
                  onPress={() => handleMealCardPress('lunch')}
                >
                  <View style={styles.mealCardContent}>
                    <View style={styles.mealCardIcon}>
                      {getMealIcon('lunch')}
                    </View>
                    <View style={styles.mealCardInfo}>
                      <Text style={styles.mealCardTitle}>Lunch</Text>
                      <Text style={styles.mealCardCalories}>{getMealCalories('lunch')} kcal</Text>
                    </View>
                    <View style={styles.mealCardAction}>
                      <Plus size={24} color="#009dff" />
                    </View>
                  </View>
                </Pressable>

                {/* Dinner */}
                <Pressable 
                  style={styles.mealCard}
                  onPress={() => handleMealCardPress('middag')}
                >
                  <View style={styles.mealCardContent}>
                    <View style={styles.mealCardIcon}>
                      {getMealIcon('middag')}
                    </View>
                    <View style={styles.mealCardInfo}>
                      <Text style={styles.mealCardTitle}>Middag</Text>
                      <Text style={styles.mealCardCalories}>{getMealCalories('middag')} kcal</Text>
                    </View>
                    <View style={styles.mealCardAction}>
                      <Plus size={24} color="#009dff" />
                    </View>
                  </View>
                </Pressable>

                {/* Snack */}
                <Pressable 
                  style={styles.mealCard}
                  onPress={() => handleMealCardPress('mellanmål')}
                >
                  <View style={styles.mealCardContent}>
                    <View style={styles.mealCardIcon}>
                      {getMealIcon('mellanmål')}
                    </View>
                    <View style={styles.mealCardInfo}>
                      <Text style={styles.mealCardTitle}>Mellanmål</Text>
                      <Text style={styles.mealCardCalories}>{getMealCalories('mellanmål')} kcal</Text>
                    </View>
                    <View style={styles.mealCardAction}>
                      <Plus size={24} color="#009dff" />
                    </View>
                  </View>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>

        <NutritionModal
          visible={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setCurrentMealType(null);
          }}
          onMealAdded={() => {
            setShowAddModal(false);
            setCurrentMealType(null);
            refetch();
          }}
          mealName={currentMealType || 'Måltid'}
        />
      </View>
    </Protected>
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
    justifyContent: 'center',
  },
  dateNavButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dateTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  dateIcon: {
    marginRight: 8,
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  todayBadge: {
    backgroundColor: '#009dff',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  todayText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  calorieCircleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 24,
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
    borderColor: 'rgba(0,157,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,157,255,0.05)',
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
  macrosContainer: {
    marginBottom: 24,
    gap: 16,
    paddingHorizontal: 24,
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
  mealCardsContainer: {
    gap: 16,
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  mealCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,157,255,0.2)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  mealCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  mealCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,157,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  mealCardInfo: {
    flex: 1,
  },
  mealCardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  mealCardCalories: {
    color: '#B0B0B0',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  mealCardAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,157,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});