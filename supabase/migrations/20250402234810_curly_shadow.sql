/*
  # Add sample data to food_database
  
  1. Changes
    - Insert common food items with nutrition data
    - Add variety of food categories
    - Include some branded products
*/

-- Insert basic food items
INSERT INTO food_database (
  name,
  category,
  kcal_per_100g,
  protein_per_100g,
  fat_per_100g,
  carbs_per_100g,
  source,
  image_url
) VALUES
-- Meat & Poultry
('Kycklingfilé', 'Kött', 110, 23, 1.5, 0, 'egen', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?q=80&w=2487&auto=format&fit=crop'),
('Nötfärs 10%', 'Kött', 170, 20, 10, 0, 'egen', 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?q=80&w=2670&auto=format&fit=crop'),
('Fläskfilé', 'Kött', 120, 21, 4, 0, 'egen', null),
('Laxfilé', 'Fisk', 206, 20, 13, 0, 'egen', 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=2670&auto=format&fit=crop'),

-- Dairy
('Kvarg 0.2%', 'Mejeri', 58, 12, 0.2, 3.5, 'egen', null),
('Ägg', 'Mejeri', 155, 13, 11, 1.1, 'egen', 'https://images.unsplash.com/photo-1607690424560-35d967d6ad7a?q=80&w=2574&auto=format&fit=crop'),
('Mjölk 3%', 'Mejeri', 60, 3.4, 3, 4.9, 'egen', null),
('Cheddarost', 'Mejeri', 402, 25, 33, 1.3, 'egen', null),

-- Grains
('Havregryn', 'Spannmål', 370, 13, 7, 59, 'egen', 'https://images.unsplash.com/photo-1614961233913-a5113a4a34ed?q=80&w=2670&auto=format&fit=crop'),
('Jasminris (kokt)', 'Spannmål', 130, 2.7, 0.3, 28, 'egen', null),
('Fullkornspasta (kokt)', 'Spannmål', 124, 5.3, 1.1, 26, 'egen', null),
('Quinoa (kokt)', 'Spannmål', 120, 4.4, 1.9, 21.3, 'egen', null),

-- Fruits & Vegetables
('Banan', 'Frukt', 89, 1.1, 0.3, 22.8, 'egen', 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?q=80&w=2680&auto=format&fit=crop'),
('Äpple', 'Frukt', 52, 0.3, 0.2, 13.8, 'egen', 'https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?q=80&w=2670&auto=format&fit=crop'),
('Broccoli', 'Grönsaker', 34, 2.8, 0.4, 6.6, 'egen', null),
('Sötpotatis', 'Grönsaker', 86, 1.6, 0.1, 20.1, 'egen', null),

-- Legumes & Nuts
('Kikärtor (kokta)', 'Baljväxter', 164, 8.9, 2.6, 27.4, 'egen', null),
('Mandlar', 'Nötter', 579, 21.2, 49.9, 21.7, 'egen', 'https://images.unsplash.com/photo-1574164052277-b9ea797de8e4?q=80&w=2670&auto=format&fit=crop'),
('Jordnötssmör', 'Nötter', 588, 25, 50, 20, 'egen', null),
('Svarta bönor (kokta)', 'Baljväxter', 132, 8.9, 0.5, 23.7, 'egen', null),

-- Branded Products
('Arla Protein Kvarg Vanilj', 'Mejeri', 65, 11, 0.2, 4.5, 'egen', null),
('Oatly Havredryck', 'Växtbaserat', 46, 1, 1.5, 6.7, 'egen', null),
('Felix Klassisk Köttbullar', 'Färdigmat', 220, 14, 16, 6, 'egen', null),
('ICA Basic Frysta Grönsaker', 'Grönsaker', 35, 2, 0.5, 5, 'egen', null),

-- Snacks & Sweets
('Mörk Choklad 70%', 'Godis', 598, 7.8, 42.6, 45.9, 'egen', 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?q=80&w=2487&auto=format&fit=crop'),
('Popcorn', 'Snacks', 387, 12, 4, 78, 'egen', null),
('Proteinbar Choklad', 'Kosttillskott', 330, 20, 10, 35, 'egen', null),
('Jordgubbar', 'Frukt', 32, 0.7, 0.3, 7.7, 'egen', 'https://images.unsplash.com/photo-1518635017498-87f514b751ba?q=80&w=2531&auto=format&fit=crop');

-- Insert branded products with barcodes
INSERT INTO food_database (
  name,
  category,
  kcal_per_100g,
  protein_per_100g,
  fat_per_100g,
  carbs_per_100g,
  brand,
  barcode,
  source,
  image_url
) VALUES
('Nocco BCAA Äpple', 'Dryck', 5, 0, 0, 0.8, 'Nocco', '7350042717158', 'egen', 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?q=80&w=2487&auto=format&fit=crop'),
('Barebells Proteinbar Caramel Cashew', 'Kosttillskott', 361, 20, 18, 20, 'Barebells', '7350054369565', 'egen', null),
('Oatly Havredryck', 'Växtbaserat', 46, 1, 1.5, 6.7, 'Oatly', '7394376615771', 'egen', 'https://images.unsplash.com/photo-1600788907416-456578634209?q=80&w=2574&auto=format&fit=crop'),
('Skyr Vanilj', 'Mejeri', 63, 11, 0.2, 4.3, 'Arla', '7310865004703', 'egen', null),
('Proteinpudding Choklad', 'Kosttillskott', 80, 15, 0.5, 4.5, 'Gainomax', '7310130007740', 'egen', null);

-- Insert AI-generated food data
INSERT INTO food_database (
  name,
  category,
  kcal_per_100g,
  protein_per_100g,
  fat_per_100g,
  carbs_per_100g,
  brand,
  source,
  image_url
) VALUES
('Proteinpannkakor', 'Frukost', 245, 18, 9, 25, null, 'ai', null),
('Grekisk Sallad', 'Lunch', 180, 7, 15, 6, null, 'ai', 'https://images.unsplash.com/photo-1551248429-40975aa4de74?q=80&w=2690&auto=format&fit=crop'),
('Pulled Chicken Bowl', 'Middag', 320, 28, 10, 30, null, 'ai', null),
('Proteinrik Smoothie', 'Dryck', 150, 15, 3, 20, null, 'ai', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?q=80&w=2670&auto=format&fit=crop'),
('Fitness Wrap', 'Lunch', 380, 25, 12, 40, null, 'ai', null);

-- Insert common restaurant meals
INSERT INTO food_database (
  name,
  category,
  kcal_per_100g,
  protein_per_100g,
  fat_per_100g,
  carbs_per_100g,
  brand,
  source,
  image_url
) VALUES
('Big Mac', 'Snabbmat', 257, 12.3, 13, 20, 'McDonald''s', 'scraped', 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?q=80&w=2670&auto=format&fit=crop'),
('Whopper', 'Snabbmat', 231, 11.7, 14, 18, 'Burger King', 'scraped', null),
('Kebabpizza', 'Snabbmat', 234, 11, 10, 25, null, 'scraped', null),
('Chicken Caesar Salad', 'Lunch', 127, 15, 7, 3, null, 'scraped', 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?q=80&w=2670&auto=format&fit=crop'),
('Sushi 8 bitar', 'Middag', 145, 6, 2, 25, null, 'scraped', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=2670&auto=format&fit=crop');

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';