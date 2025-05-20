import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useWorkoutProgress(exerciseId: string | null, timeRange: '4w' | '12w' | '24w' | '52w' | 'all' | 'cycle') {
  return useQuery({
    queryKey: ['workoutProgress', exerciseId, timeRange],
    queryFn: async () => {
      if (!exerciseId) return null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      let startDate: string | null = null;
      let cycleId: string | null = null;

      if (timeRange === 'cycle') {
        // Get active cycle info
        const { data: cycleData, error: cycleError } = await supabase
          .from('training_cycles')
          .select('id, start_date, goal')
          .eq('user_id', user.id)
          .eq('active', true)
          .single();

        if (cycleError) {
          return { data: [], cycleGoal: null, noDataMessage: 'Ingen aktiv träningscykel hittad' };
        }

        startDate = cycleData.start_date;
        cycleId = cycleData.id;
        
        let query = supabase
          .from('progress_tracking_logs')
          .select(`
            workout_date,
            weight,
            reps,
            workout_logs!inner (
              cycle_id
            )
          `)
          .eq('user_id', user.id)
          .eq('exercise_id', exerciseId)
          .gte('workout_date', startDate)
          .eq('workout_logs.cycle_id', cycleId)
          .order('workout_date', { ascending: true });

        const { data: progressData, error: progressError } = await query;

        if (progressError) throw progressError;

        if (!progressData?.length) {
          return { 
            data: [], 
            cycleGoal: cycleData.goal, 
            noDataMessage: `Ingen träningsdata hittad för denna övning under nuvarande cykel` 
          };
        }

        return { data: progressData, cycleGoal: cycleData.goal, noDataMessage: null };
      } else {
        // Handle non-cycle time ranges
        if (timeRange !== 'all') {
          const weeks = parseInt(timeRange);
          const date = new Date();
          date.setDate(date.getDate() - (weeks * 7));
          startDate = date.toISOString().split('T')[0];
        }

        let query = supabase
          .from('progress_tracking_logs')
          .select(`
            workout_date,
            weight,
            reps
          `)
          .eq('user_id', user.id)
          .eq('exercise_id', exerciseId)
          .order('workout_date', { ascending: true });

        if (startDate) {
          query = query.gte('workout_date', startDate);
        }

        const { data: progressData, error: progressError } = await query;

        if (progressError) throw progressError;

        if (!progressData?.length) {
          const timeRangeText = timeRange === 'all' ? 
            'all tid' : 
            `de senaste ${parseInt(timeRange)} veckorna`;
          
          return { 
            data: [], 
            cycleGoal: null, 
            noDataMessage: `Ingen träningsdata hittad för denna övning under ${timeRangeText}` 
          };
        }

        return { data: progressData, cycleGoal: null, noDataMessage: null };
      }
    },
    enabled: !!exerciseId,
  });
}