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
  off_id?: string;
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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Search for products by name using Supabase Edge Function
 * @param query The search query
 * @returns Array of product information
 */
export async function searchProductsByName(query: string): Promise<FoodProduct[]> {
  const maxRetries = 3;
  const baseDelay = 1000; // Start with 1 second delay

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Searching for products with query: ${query} (attempt ${attempt})`);
      
      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('food-search', {
        body: { query }
      });
      
      if (error) {
        // If it's a 404, return empty array instead of throwing
        if (error.status === 404) {
          return [];
        }
        throw new Error(`Sökningen misslyckades: ${error.message}`);
      }
      
      if (!data || !Array.isArray(data)) {
        throw new Error('Ogiltig respons från servern');
      }
      
      // Cache the results in livsmedelskache
      await cacheSearchResults(data);
      
      return data.map(item => ({
        name: item.name,
        brand: item.brand || '',
        calories: item.calories || 0,
        protein: item.protein || 0,
        fat: item.fat || 0,
        carbs: item.carbs || 0,
        sugar: item.sugar,
        image_url: item.image_url || '',
        off_id: item.off_id || item.barcode || generateTempId(item.name, item.brand)
      }));
    } catch (err: any) {
      console.error(`Error searching products (attempt ${attempt}):`, err);
      
      // If this is our last attempt, throw the error
      if (attempt === maxRetries) {
        if (err.message && err.message.includes('404')) {
          return []; // Return empty array for no results
        } else if (err.message && (
          err.message.includes('Network') || 
          err.message.includes('Failed to fetch') ||
          err.message.includes('HTTP error')
        )) {
          throw new Error('Kunde inte ansluta till servern. Kontrollera din internetanslutning och försök igen.');
        }
        throw new Error(err.message || 'Ett fel uppstod vid sökning. Försök igen om en stund.');
      }
      
      // Calculate wait time with exponential backoff and jitter
      const jitter = Math.random() * 200; // Add up to 200ms of random jitter
      const waitTime = baseDelay * Math.pow(2, attempt - 1) + jitter;
      console.log(`Retry attempt ${attempt} failed, waiting ${Math.round(waitTime)}ms before next attempt`);
      await delay(waitTime);
    }
  }

  // This should never be reached due to the throw in the last iteration
  return [];
}

/**
 * Cache search results in the livsmedelskache table
 */
async function cacheSearchResults(products: any[]) {
  try {
    for (const product of products) {
      if (!product.off_id && !product.barcode) continue;
      
      const off_id = product.off_id || product.barcode;
      
      // Check if product already exists in cache
      const { data: existingProduct } = await supabase
        .from('livsmedelskache')
        .select('off_id')
        .eq('off_id', off_id)
        .maybeSingle();
        
      if (existingProduct) continue; // Skip if already cached
      
      // Insert into cache
      await supabase
        .from('livsmedelskache')
        .insert({
          off_id: off_id,
          produktnamn: product.name,
          varumarke: product.brand || null,
          energi_kcal_100g: product.calories || 0,
          protein_100g: product.protein || 0,
          kolhydrater_100g: product.carbs || 0,
          fett_100g: product.fat || 0,
          bild_url: product.image_url || null
        });
    }
  } catch (error) {
    console.error('Error caching search results:', error);
    // Continue execution even if caching fails
  }
}

/**
 * Generate a temporary ID for products without an OFF ID
 */
function generateTempId(name: string, brand: string): string {
  const combinedString = `${name}${brand || ''}${Date.now()}`;
  return `temp_${combinedString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)}`;
}

/**
 * Create a new meal entry in the database
 */
export async function createMeal(mealName: string, date?: Date): Promise<{ id: string }> {
  try {
    // Get the current user's ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const logDate = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const mealType = mealName.toLowerCase();
    
    // Check if a daily log already exists for this date
    const { data: existingLog, error: logError } = await supabase
      .from('daglig_matlogg')
      .select('id')
      .eq('user_id', user.id)
      .eq('loggdatum', logDate)
      .maybeSingle();
      
    if (logError) throw logError;
    
    let logId: string;
    
    if (existingLog) {
      logId = existingLog.id;
    } else {
      // Create a new daily log
      const { data: newLog, error: createLogError } = await supabase
        .from('daglig_matlogg')
        .insert({
          user_id: user.id,
          loggdatum: logDate
        })
        .select()
        .single();
        
      if (createLogError) throw createLogError;
      logId = newLog.id;
    }
    
    return { id: logId };
  } catch (error) {
    console.error('Error creating meal:', error);
    throw error;
  }
}

/**
 * Add a food item to a meal
 */
export async function addFoodToMeal(
  logId: string,
  product: FoodProduct,
  quantityGrams: number,
  mealType: string = 'frukost'
): Promise<void> {
  try {
    // Ensure quantity is valid
    const quantity = quantityGrams > 0 ? quantityGrams : 100;
    
    // Check if product is already in livsmedelskache
    let off_id = product.off_id;
    
    if (!off_id) {
      // Generate a temporary ID
      off_id = generateTempId(product.name, product.brand);
      
      // Add to cache
      await supabase
        .from('livsmedelskache')
        .insert({
          off_id: off_id,
          produktnamn: product.name,
          varumarke: product.brand || null,
          energi_kcal_100g: product.calories || 0,
          protein_100g: product.protein || 0,
          kolhydrater_100g: product.carbs || 0,
          fett_100g: product.fat || 0,
          bild_url: product.image_url || null
        });
    }
    
    // Add to maltidsinlagg
    const { error } = await supabase
      .from('maltidsinlagg')
      .insert({
        daglig_logg_id: logId,
        maltidstyp: mealType.toLowerCase(),
        off_id: off_id,
        custom_namn: product.name, // Fallback if OFF data is missing
        antal_gram: quantity
      });
      
    if (error) throw error;
  } catch (error) {
    console.error('Error adding food to meal:', error);
    throw error;
  }
}

/**
 * Delete a meal item
 */
export async function deleteMealItem(itemId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('maltidsinlagg')
      .delete()
      .eq('id', itemId);
      
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting meal item:', error);
    throw error;
  }
}

/**
 * Update a meal item's quantity
 */
export async function updateMealItemQuantity(
  itemId: string,
  quantityGrams: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('maltidsinlagg')
      .update({ antal_gram: quantityGrams })
      .eq('id', itemId);
      
    if (error) throw error;
  } catch (error) {
    console.error('Error updating meal item quantity:', error);
    throw error;
  }
}

/**
 * Get user's macro goals
 */
export async function getUserMacroGoals(): Promise<{
  kalorier_kcal: number;
  protein_g: number;
  kolhydrater_g: number;
  fett_g: number;
} | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data, error } = await supabase
      .from('makro_mal')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
      
    if (error) throw error;
    
    if (!data) return null;
    
    return {
      kalorier_kcal: data.kalorier_kcal,
      protein_g: data.protein_g,
      kolhydrater_g: data.kolhydrater_g,
      fett_g: data.fett_g
    };
  } catch (error) {
    console.error('Error getting user macro goals:', error);
    return null;
  }
}

/**
 * Set user's macro goals
 */
export async function setUserMacroGoals(
  kalorier_kcal: number,
  protein_g: number,
  kolhydrater_g: number,
  fett_g: number
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { error } = await supabase
      .from('makro_mal')
      .upsert({
        user_id: user.id,
        kalorier_kcal,
        protein_g,
        kolhydrater_g,
        fett_g,
        updated_at: new Date()
      });
      
    if (error) throw error;
  } catch (error) {
    console.error('Error setting user macro goals:', error);
    throw error;
  }
}