import { PRODUCTS } from './stripe-config';
import { supabase } from './supabase';
import { Platform, Linking } from 'react-native';

export async function createCheckoutSession(priceId: string, mode: 'subscription' | 'payment') {
  try {
    // Find the product with the given priceId
    const product = PRODUCTS.find((p) => p.priceId === priceId);
    if (!product) {
      throw new Error(`Product with price ID ${priceId} not found`);
    }

    // Get the Supabase URL and anon key from environment variables
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not found in environment variables');
    }

    // Get the auth token for the current user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated');
    }

    // Construct the success and cancel URLs using the Supabase URL as the base
    const successUrl = `${supabaseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${supabaseUrl}/checkout/cancel`;

    // Call the Supabase Edge Function to create a checkout session
    const response = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        price_id: priceId,
        success_url: successUrl,
        cancel_url: cancelUrl,
        mode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create checkout session');
    }

    const data = await response.json();
    
    // Handle platform-specific checkout flow
    if (Platform.OS !== 'web') {
      // For mobile, open the URL in the device's browser
      if (data.url) {
        const canOpen = await Linking.canOpenURL(data.url);
        if (canOpen) {
          await Linking.openURL(data.url);
        } else {
          throw new Error('Cannot open checkout URL on this device');
        }
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

export async function cancelSubscription() {
  try {
    // Get the Supabase URL from environment variables
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not found in environment variables');
    }

    // Get the auth token for the current user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated');
    }

    // Call the Supabase Edge Function to cancel the subscription
    const response = await fetch(`${supabaseUrl}/functions/v1/cancel-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to cancel subscription');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
}