import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { debounce } from 'lodash';

export type MealEntry = {
  id: string;
  product_name: string;
  quantity_grams: number;
  calories_total: number;
  protein_total: number;
  carbs_total: number;
  fat_total: number;
};

export type MealLog = {
  meal_type: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  entries: MealEntry[];
};

export type DailyTotals = {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
};

// Convert meal_type from Swedish to English
const convertMealTypeToEnglish = (mealType: string): string => {
  switch (mealType.toLowerCase()) {
    case 'frukost': return 'breakfast';
    case 'lunch': return 'lunch';
    case 'middag': return 'dinner';
    case 'mellanmål': return 'snack';
    default: return mealType.toLowerCase();
  }
};

// Convert meal_type from English to Swedish
const convertMealTypeToSwedish = (mealType: string): string => {
  switch (mealType) {
    case 'breakfast': return 'frukost';
    case 'lunch': return 'lunch';
    case 'dinner': return 'middag';
    case 'snack': return 'mellanmål';
    default: return mealType;
  }
};

export const fetchDailyTotals = async (date: Date): Promise<DailyTotals> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const formattedDate = format(date, 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .rpc('get_daily_totals', {
        p_user: user.id,
        p_date: formattedDate
      });

    if (error) throw error;
    
    return {
      total_calories: data?.[0]?.total_calories || 0,
      total_protein: data?.[0]?.total_protein || 0,
      total_carbs: data?.[0]?.total_carbs || 0,
      total_fat: data?.[0]?.total_fat || 0
    };
  } catch (error) {
    console.error('Error fetching daily totals:', error);
    return {
      total_calories: 0,
      total_protein: 0,
      total_carbs: 0,
      total_fat: 0
    };
  }
};

export const fetchMealLogs = async (date: Date): Promise<MealLog[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const formattedDate = format(date, 'yyyy-MM-dd');
    
    const { data: mealTotals, error: totalsError } = await supabase
      .rpc('get_meal_totals', {
        p_user: user.id,
        p_date: formattedDate
      });

    if (totalsError) throw totalsError;
    
    // Create a map to store entries for each meal type
    const mealEntries: Record<string, MealEntry[]> = {};
    
    // For each meal type, fetch entries
    for (const meal of mealTotals || []) {
      const { data: entries, error: entriesError } = await supabase
        .rpc('get_meal_entries', {
          p_user: user.id,
          p_date: formattedDate,
          p_meal: meal.meal_type
        });
        
      if (entriesError) throw entriesError;
      
      mealEntries[meal.meal_type] = entries || [];
    }
    
    // Combine totals with entries
    return (mealTotals || []).map(meal => ({
      meal_type: convertMealTypeToSwedish(meal.meal_type),
      total_calories: meal.total_calories || 0,
      total_protein: meal.total_protein || 0,
      total_carbs: meal.total_carbs || 0,
      total_fat: meal.total_fat || 0,
      entries: mealEntries[meal.meal_type] || []
    }));
  } catch (error) {
    console.error('Error fetching meal logs:', error);
    return [];
  }
};

export const useNutritionData = (date: Date) => {
  const [dailyTotals, setDailyTotals] = useState<DailyTotals>({
    total_calories: 0,
    total_protein: 0,
    total_carbs: 0,
    total_fat: 0
  });
  const [mealLog, setMealLog] = useState<MealLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [totals, logs] = await Promise.all([
        fetchDailyTotals(date),
        fetchMealLogs(date)
      ]);
      
      setDailyTotals(totals);
      setMealLog(logs);
    } catch (err) {
      console.error('Error in useNutritionData:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, [date]);
  
  // Use React.useCallback instead of useCallback directly
  const refetch = React.useCallback(() => {
    fetchData();
  }, []);
  
  return {
    dailyTotals,
    mealLog,
    isLoading,
    error,
    refetch
  };
};