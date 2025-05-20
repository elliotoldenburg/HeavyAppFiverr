// Follow Deno's ES modules convention
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface FoodProduct {
  name: string;
  brand: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  sugar: number;
  image_url: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const barcode = url.searchParams.get("barcode");

    if (!barcode) {
      return new Response(
        JSON.stringify({ error: "Barcode parameter is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch product data from Open Food Facts API
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );

    const data = await response.json();

    // Check if product was found
    if (data.status !== 1 || !data.product) {
      return new Response(
        JSON.stringify({ error: "Produkten hittades inte." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const product = data.product;
    const nutrients = product.nutriments || {};

    // Extract and format the required data
    const result: FoodProduct = {
      name: product.product_name || "Unknown Product",
      brand: product.brands || "Unknown Brand",
      calories: nutrients["energy-kcal_100g"] || nutrients["energy-kcal"] || 0,
      protein: nutrients.proteins_100g || 0,
      fat: nutrients.fat_100g || 0,
      carbs: nutrients.carbohydrates_100g || 0,
      sugar: nutrients.sugars_100g || 0,
      image_url: product.image_url || "",
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Ett fel uppstod vid hämtning av produktinformation." 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});