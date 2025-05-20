import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface SearchResult {
  name: string;
  brand: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  sugar?: number;
  image_url: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const searchQuery = url.searchParams.get("query");

    if (!searchQuery) {
      return new Response(
        JSON.stringify({ error: "Search query parameter is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch products from Open Food Facts API
    const response = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchQuery)}&search_simple=1&action=process&json=1&page_size=10`
    );

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to search for products" }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();

    // Check if products were found
    if (!data.products || data.products.length === 0) {
      return new Response(
        JSON.stringify({ error: "Inga produkter hittades." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Process and format the results
    const results: SearchResult[] = data.products.map((product: any) => {
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

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Ett fel uppstod vid sökning av produktinformation." 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});