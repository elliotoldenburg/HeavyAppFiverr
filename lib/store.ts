import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Exercise } from '@/types/database.types';

export type DraftSet = {
  id: string;
  weight: string;
  reps: string;
  completed: boolean;
};

export type DraftExercise = {
  id: string;
  exercise_id: string;
  exercise: Exercise;
  sets: DraftSet[];
  rest_time: number;
};

interface WorkoutDraftState {
  exercises: DraftExercise[];
  addExercise: (exercise: Exercise, sets?: number, restTime?: number) => void;
  removeExercise: (id: string) => void;
  updateSet: (exerciseId: string, setId: string, field: 'weight' | 'reps', value: string) => void;
  toggleSetCompletion: (exerciseId: string, setId: string) => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  clearDraft: () => void;
  getExerciseCount: () => number;
}

export const useWorkoutDraftStore = create<WorkoutDraftState>()(
  persist(
    (set, get) => ({
      exercises: [],
      
      addExercise: (exercise, sets = 1, restTime = 90) => {
        set((state) => {
          // Check if exercise already exists in the draft
          const existingExerciseIndex = state.exercises.findIndex(
            ex => ex.exercise_id === exercise.id
          );
          
          if (existingExerciseIndex !== -1) {
            // If exercise exists, just return the current state
            return state;
          }
          
          // Generate a unique ID for the exercise
          const exerciseId = `draft-exercise-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          
          // Create sets
          const draftSets: DraftSet[] = [];
          for (let i = 0; i < sets; i++) {
            draftSets.push({
              id: `draft-set-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}`,
              weight: '',
              reps: '',
              completed: false
            });
          }
          
          // Create the draft exercise
          const draftExercise: DraftExercise = {
            id: exerciseId,
            exercise_id: exercise.id,
            exercise: exercise,
            sets: draftSets,
            rest_time: restTime
          };
          
          return {
            exercises: [...state.exercises, draftExercise]
          };
        });
      },
      
      removeExercise: (id) => {
        set((state) => ({
          exercises: state.exercises.filter(exercise => exercise.id !== id)
        }));
      },
      
      updateSet: (exerciseId, setId, field, value) => {
        set((state) => {
          const newExercises = [...state.exercises];
          const exerciseIndex = newExercises.findIndex(e => e.id === exerciseId);
          
          if (exerciseIndex !== -1) {
            const setIndex = newExercises[exerciseIndex].sets.findIndex(s => s.id === setId);
            
            if (setIndex !== -1) {
              newExercises[exerciseIndex].sets[setIndex][field] = value;
            }
          }
          
          return { exercises: newExercises };
        });
      },
      
      toggleSetCompletion: (exerciseId, setId) => {
        set((state) => {
          const newExercises = [...state.exercises];
          const exerciseIndex = newExercises.findIndex(e => e.id === exerciseId);
          
          if (exerciseIndex !== -1) {
            const setIndex = newExercises[exerciseIndex].sets.findIndex(s => s.id === setId);
            
            if (setIndex !== -1) {
              newExercises[exerciseIndex].sets[setIndex].completed = 
                !newExercises[exerciseIndex].sets[setIndex].completed;
            }
          }
          
          return { exercises: newExercises };
        });
      },
      
      addSet: (exerciseId) => {
        set((state) => {
          const newExercises = [...state.exercises];
          const exerciseIndex = newExercises.findIndex(e => e.id === exerciseId);
          
          if (exerciseIndex !== -1) {
            const newSetId = `draft-set-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            
            newExercises[exerciseIndex].sets.push({
              id: newSetId,
              weight: '',
              reps: '',
              completed: false
            });
          }
          
          return { exercises: newExercises };
        });
      },
      
      removeSet: (exerciseId, setId) => {
        set((state) => {
          const newExercises = [...state.exercises];
          const exerciseIndex = newExercises.findIndex(e => e.id === exerciseId);
          
          if (exerciseIndex !== -1) {
            newExercises[exerciseIndex].sets = 
              newExercises[exerciseIndex].sets.filter(s => s.id !== setId);
          }
          
          return { exercises: newExercises };
        });
      },
      
      clearDraft: () => {
        set({ exercises: [] });
      },
      
      getExerciseCount: () => {
        return get().exercises.length;
      }
    }),
    {
      name: 'workout-draft-storage',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);