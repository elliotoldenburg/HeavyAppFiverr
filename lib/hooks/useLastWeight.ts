import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { WeightEntry } from '@/types/weight';

export async function fetchLastWeight(): Promise<WeightEntry | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('weight_tracking')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching last weight entry:', error);
    return null;
  }

  return data;
}

export function useLastWeight() {
  return useQuery({
    queryKey: ['lastWeight'],
    queryFn: fetchLastWeight,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
}