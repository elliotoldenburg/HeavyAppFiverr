import { supabase } from './supabase';

// Types
export interface FoodProduct {
  name: string;
  brand: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  sugar?: number;
  image_url: string;
}

export interface MealItem {
  id?: string;
  meal_id: string;
  product_name: string;
  brand?: string;
  quantity_grams: number;
  energy_kcal_100g: number;
  protein_100g: number;
  fat_100g: number;
  carbs_100g: number;
  image_url?: string;
  created_at?: string;
}

export interface Meal {
  id?: string;
  name: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  created_at?: string;
  items?: MealItem[];
}

export interface NutritionSummary {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  meals: Meal[];
}

/**
 * Lookup a product by barcode using Open Food Facts API
 * @param barcode The EAN barcode to lookup
 * @returns Product information or error
 */
export async function lookupProductByBarcode(barcode: string): Promise<FoodProduct> {
  try {
    // Direct API call to Open Food Facts instead of using the edge function
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );
    
    if (!response.ok) {
      throw new Error('Failed to lookup product');
    }
    
    const data = await response.json();
    
    // Check if product was found
    if (data.status !== 1 || !data.product) {
      throw new Error('Produkten hittades inte.');
    }

    const product = data.product;
    const nutrients = product.nutriments || {};

    // Extract and format the required data
    return {
      name: product.product_name || "Unknown Product",
      brand: product.brands || "Unknown Brand",
      calories: nutrients["energy-kcal_100g"] || nutrients["energy-kcal"] || 0,
      protein: nutrients.proteins_100g || 0,
      fat: nutrients.fat_100g || 0,
      carbs: nutrients.carbohydrates_100g || 0,
      sugar: nutrients.sugars_100g || 0,
      image_url: product.image_url || "",
    };
  } catch (error) {
    console.error('Error looking up product:', error);
    throw error;
  }
}

/**
 * Search for products by name using Open Food Facts API
 * @param query The search query
 * @returns Array of product information
 */
export async function searchProductsByName(query: string): Promise<FoodProduct[]> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`
    );
    
    if (!response.ok) {
      throw new Error('Failed to search for products');
    }
    
    const data = await response.json();
    
    // Check if products were found
    if (!data.products || data.products.length === 0) {
      throw new Error('Inga produkter hittades.');
    }

    // Process and format the results
    return data.products.map((product: any) => {
      const nutrients = product.nutriments || {};
      
      return {
        name: product.product_name || "Okänd produkt",
        brand: product.brands || "Okänt varumärke",
        calories: nutrients["energy-kcal_100g"] || nutrients["energy-kcal"] || 0,
        protein: nutrients.proteins_100g || 0,
        fat: nutrients.fat_100g || 0,
        carbs: nutrients.carbohydrates_100g || 0,
        sugar: nutrients.sugars_100g || 0,
        image_url: product.image_url || "",
      };
    });
  } catch (error) {
    console.error('Error searching for products:', error);
    throw error;
  }
}

/**
 * Calculate nutrition values based on product and quantity
 * @param product The food product
 * @param quantityGrams The quantity in grams
 * @returns Calculated nutrition values
 */
export function calculateNutrition(product: FoodProduct, quantityGrams: number) {
  return {
    calories: Math.round((product.calories * quantityGrams) / 100),
    protein: Math.round((product.protein * quantityGrams) / 100),
    carbs: Math.round((product.carbs * quantityGrams) / 100),
    fat: Math.round((product.fat * quantityGrams) / 100),
  };
}

/**
 * Create a new meal
 * @param mealName The name of the meal
 * @returns The created meal
 */
export async function createMeal(mealName: string): Promise<Meal> {
  try {
    const { data, error } = await supabase
      .from('meals')
      .insert({
        name: mealName,
        total_calories: 0,
        total_protein: 0,
        total_carbs: 0,
        total_fat: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating meal:', error);
    throw error;
  }
}

/**
 * Add a food item to a meal
 * @param mealId The ID of the meal
 * @param product The food product
 * @param quantityGrams The quantity in grams
 * @returns The created meal item
 */
export async function addFoodToMeal(
  mealId: string,
  product: FoodProduct,
  quantityGrams: number
): Promise<MealItem> {
  try {
    const { data, error } = await supabase
      .from('meal_items')
      .insert({
        meal_id: mealId,
        product_name: product.name,
        brand: product.brand,
        quantity_grams: quantityGrams,
        energy_kcal_100g: product.calories,
        protein_100g: product.protein,
        fat_100g: product.fat,
        carbs_100g: product.carbs,
        image_url: product.image_url,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding food to meal:', error);
    throw error;
  }
}

/**
 * Get meal details with all items
 * @param mealId The ID of the meal
 * @returns The meal with all items
 */
export async function getMealWithItems(mealId: string): Promise<Meal> {
  try {
    const { data, error } = await supabase
      .rpc('get_meal_with_items', { p_meal_id: mealId });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting meal with items:', error);
    throw error;
  }
}

/**
 * Get daily nutrition summary
 * @param date Optional date (defaults to today)
 * @returns Nutrition summary for the day
 */
export async function getDailyNutritionSummary(date?: Date): Promise<NutritionSummary> {
  try {
    const formattedDate = date ? date.toISOString().split('T')[0] : undefined;
    
    const { data, error } = await supabase
      .rpc('get_daily_nutrition_summary_for_meals', {
        p_date: formattedDate
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting daily nutrition summary:', error);
    throw error;
  }
}

/**
 * Delete a meal item
 * @param itemId The ID of the meal item
 */
export async function deleteMealItem(itemId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('meal_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting meal item:', error);
    throw error;
  }
}

/**
 * Delete a meal and all its items
 * @param mealId The ID of the meal
 */
export async function deleteMeal(mealId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('meals')
      .delete()
      .eq('id', mealId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting meal:', error);
    throw error;
  }
}

/**
 * Update a meal item's quantity
 * @param itemId The ID of the meal item
 * @param quantityGrams The new quantity in grams
 */
export async function updateMealItemQuantity(
  itemId: string,
  quantityGrams: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('meal_items')
      .update({ quantity_grams: quantityGrams })
      .eq('id', itemId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating meal item quantity:', error);
    throw error;
  }
}

/**
 * Update a meal's name
 * @param mealId The ID of the meal
 * @param name The new name
 */
export async function updateMealName(
  mealId: string,
  name: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('meals')
      .update({ name })
      .eq('id', mealId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating meal name:', error);
    throw error;
  }
}

/**
 * Get all meals for a specific date
 * @param date The date to get meals for
 * @returns List of meals for the date
 */
export async function getMealsByDate(date: Date): Promise<Meal[]> {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting meals by date:', error);
    throw error;
  }
}