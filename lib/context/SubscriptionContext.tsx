import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Subscription, SubscriptionStatus } from '@/lib/hooks/useSubscription';

type SubscriptionContextType = {
  subscription: Subscription | null;
  isLoading: boolean;
  isActive: boolean;
  error: Error | null;
  refetch: () => void;
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  isLoading: true,
  isActive: false,
  error: null,
  refetch: () => {},
});

export function useSubscriptionContext() {
  return useContext(SubscriptionContext);
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const {
    data: subscription,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      console.log('Fetching subscription from context');
      
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('User not authenticated, skipping subscription check');
        return null;
      }
      
      console.log('Fetching subscription for user:', user.id);
      
      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        // Don't throw error for no rows, just return null
        if (error.code === 'PGRST116') {
          console.log('No subscription found for user:', user.id);
          return null;
        }
        console.error('Error fetching subscription from view:', error);
        throw error;
      }

      console.log('Subscription data:', data);
      return data;
    },
    staleTime: 5000, // Consider data stale after 5 seconds
    cacheTime: 5000, // Cache for 5 seconds
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
    enabled: !!supabase.auth.getSession() // Only run query if user is authenticated
  });

  // Listen for auth state changes and refetch subscription data
  useEffect(() => {
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event);
        if (event === 'SIGNED_IN') {
          console.log('User signed in, refetching subscription');
          refetch();
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out, clearing subscription data');
          // No need to explicitly clear data as the query will return null on next fetch
        }
      }
    );

    return () => {
      authSubscription.unsubscribe();
    };
  }, [refetch]);

  const isActive = 
    subscription?.subscription_status === 'active' || 
    subscription?.subscription_status === 'trialing';

  return (
    <SubscriptionContext.Provider 
      value={{ 
        subscription, 
        isLoading, 
        isActive, 
        error: error as Error | null, 
        refetch 
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}