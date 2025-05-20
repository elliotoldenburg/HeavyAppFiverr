export interface Program {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  sessions_per_week: number;
  image_url: string;
  created_at: string;
}

export interface Pass {
  id: string;
  program_id: string;
  day: number;
  name: string;
  description: string;
  created_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  equipment: string;
  video_url: string | null;
  created_at: string;
}

export interface CustomExercise {
  id: string;
  user_id: string;
  name: string;
  category: string;
  equipment: string;
  created_at: string;
}

export interface PassExercise {
  id: string;
  pass_id: string;
  exercise_id: string;
  sets: number;
  reps: string;
  rest_time: number;
  order: number;
  created_at: string;
  exercise?: Exercise;
}

export interface UserProgram {
  id: string;
  user_id: string;
  program_id: string;
  start_date: string;
  progress: number;
  created_at: string;
  program?: Program;
}

export interface WorkoutLog {
  id: string;
  user_id: string;
  pass_id?: string;
  exercise_id?: string;
  sets: number;
  reps: string;
  weight: number;
  created_at: string;
  date: string;
  total_weight_lifted: number;
  total_sets: number;
  total_reps: number;
  exercise_logs?: ExerciseLog[];
}

export interface ExerciseLog {
  id: string;
  workout_id: string;
  exercise_id?: string;
  custom_exercise_name?: string;
  sets: number;
  reps: string;
  weight: number;
  rest_time: number;
  created_at: string;
  exercise?: Exercise;
  set_logs?: SetLog[];
}

export interface SetLog {
  id: string;
  exercise_log_id: string;
  set_number: number;
  weight: number;
  reps: number;
  completed: boolean;
  created_at: string;
}

export interface WeightTracking {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  created_at: string;
}

export interface TrainingCycle {
  id: string;
  user_id: string;
  goal: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  active: boolean;
}

export interface FoodLog {
  id: string;
  user_id: string;
  meal_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  logged_at: string;
}

export interface TrainingProfile {
  id: string;
  user_id: string;
  full_name: string;
  age: number;
  gender: string;
  height_cm: number;
  weight_kg: number;
  training_goal: string | null;
  experience_level: string;
  equipment_access: string;
  injuries: string | null;
  fitness_goal: string | null;
  profile_image_url: string | null;
  banner_image_url: string | null;
  tiktok_url: string | null;
  instagram_url: string | null;
  username: string | null;
}

export interface MachineExercise {
  id: string;
  name: string;
  image_url: string | null;
  video_url: string | null;
  description: string | null;
  exercise_id: string | null;
  created_at: string;
  exercise?: Exercise;
}

export interface DailyMealLog {
  id: string;
  user_id: string;
  log_date: string;
  meal_type: string;
  total_calories: number;
  total_carbs: number;
  total_protein: number;
  total_fat: number;
  created_at: string;
  updated_at: string;
}

export interface MealEntry {
  id: string;
  daily_log_id: string;
  food_id?: string;
  food_name: string;
  quantity: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  created_at: string;
  updated_at: string;
}