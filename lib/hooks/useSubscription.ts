import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type SubscriptionStatus = 
  | 'not_started'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export interface Subscription {
  customer_id: string;
  subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  price_id: string | null;
  current_period_start: number | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
}

export async function fetchSubscription(): Promise<Subscription | null> {
  try {
    console.log('Fetching subscription from stripe_user_subscriptions view');
    
    // First check if the user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('User not authenticated, skipping subscription check');
      return null;
    }
    
    console.log('Fetching subscription for user:', user.id);
    
    // Use maybeSingle() instead of single() to handle no rows gracefully
    const { data, error } = await supabase
      .from('stripe_user_subscriptions')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching subscription from view:', error);
      throw error;
    }

    console.log('Subscription data:', data);
    return data;
  } catch (err) {
    console.error('Error in fetchSubscription:', err);
    throw err;
  }
}

export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: fetchSubscription,
    staleTime: 5000, // Consider data stale after 5 seconds
    cacheTime: 5000, // Cache for 5 seconds
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Refetch when component mounts
    retry: 2, // Retry twice on failure
    enabled: !!supabase.auth.getSession() // Only run query if user is authenticated
  });
}

export function isActiveSubscription(status: SubscriptionStatus | undefined): boolean {
  return status === 'active' || status === 'trialing';
}