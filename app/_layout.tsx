import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { supabase, recoverSession } from '../lib/supabase';
import { useRouter } from 'expo-router';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import LoadingScreen from '@/components/LoadingScreen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Platform } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { fetchLastWeight } from '@/lib/hooks/useLastWeight';
import { SubscriptionProvider } from '@/lib/context/SubscriptionContext';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useFrameworkReady();
  const [mounted, setMounted] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const [showLoading, setShowLoading] = useState(true);
  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
  });

  const router = useRouter();
  
  // First mount effect
  useEffect(() => {
    setMounted(true);
    
    // Set minimum loading time
    const minLoadingTimer = setTimeout(() => {
      setShowLoading(false);
    }, 1000); // Show loading screen for at least 1 second

    // Add web-specific styles for scrolling
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = `
        html, body, #root {
          height: 100%;
          overflow: auto;
        }
        * {
          -webkit-overflow-scrolling: touch;
        }
      `;
      document.head.append(style);
    }

    return () => clearTimeout(minLoadingTimer);
  }, []);

  // Check auth status and determine initial route
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Set initial route to welcome screen by default
        // This ensures we have a valid route even if session recovery fails
        setInitialRoute('/(auth)/welcome');
        
        // Try to recover the session
        const session = await recoverSession();
        
        // If no session, we already set the route to welcome screen
        if (!session) {
          console.log("🔵 [RootLayout] No valid session found, showing welcome screen");
          return;
        }

        console.log("✅ [RootLayout] Found existing session");
        
        // Prefetch last weight data
        queryClient.prefetchQuery(['lastWeight'], fetchLastWeight);
        
        const { count, error: profileError } = await supabase
          .from('training_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id);

        if (profileError) {
          console.error("❌ [RootLayout] Profile error:", profileError);
          return;
        }

        if (count && count > 0) {
          console.log("🟢 [RootLayout] Profile exists, going to main menu");
          setInitialRoute('/(tabs)');
        } else {
          console.log("🟠 [RootLayout] No profile found, going to onboarding");
          setInitialRoute('/(auth)/onboarding/info');
        }
      } catch (err) {
        console.error("❌ [RootLayout] Initialization error:", err);
        // Keep the default welcome screen route on error
      }
    };

    if (mounted && (fontsLoaded || fontError)) {
      checkAuth();
      SplashScreen.hideAsync();
    }
  }, [mounted, fontsLoaded, fontError]);

  // Handle navigation after route is determined and minimum loading time has passed
  useEffect(() => {
    if (mounted && initialRoute && !showLoading) {
      router.replace(initialRoute);
    }
  }, [mounted, initialRoute, showLoading, router]);

  // Listen for auth state changes - with debounce to prevent excessive calls
  useEffect(() => {
    // Only set up the auth listener after initial mount
    if (!mounted) return;
    
    let authChangeTimeout: NodeJS.Timeout | null = null;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted || !initialRoute || showLoading) return; // Don't handle auth changes until initial setup is done
      
      console.log("🔵 [RootLayout] Auth event:", event);
      
      // Clear any existing timeout to debounce multiple rapid auth events
      if (authChangeTimeout) {
        clearTimeout(authChangeTimeout);
      }
      
      // Set a timeout to handle the auth change after a short delay
      authChangeTimeout = setTimeout(async () => {
        if (event === 'SIGNED_IN' && session?.user?.id) {
          console.log("✅ [RootLayout] User signed in, checking profile...");

          // Prefetch last weight data
          queryClient.prefetchQuery(['lastWeight'], fetchLastWeight);

          const { count, error } = await supabase
            .from('training_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id);

          if (error) {
            console.error("❌ [RootLayout] Profile check error:", error);
            router.replace('/(auth)/welcome');
            return;
          }

          if (count && count > 0) {
            console.log("🟢 [RootLayout] Profile exists, going to main menu");
            router.replace('/(tabs)');
          } else {
            console.log("🟠 [RootLayout] No profile found, going to onboarding");
            router.replace('/(auth)/onboarding/info');
          }
        } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
          console.log("🔴 [RootLayout] User signed out or deleted");
          router.replace('/(auth)/welcome');
        }
      }, 300); // 300ms debounce
    });

    return () => {
      if (authChangeTimeout) {
        clearTimeout(authChangeTimeout);
      }
      subscription.unsubscribe();
    };
  }, [mounted, initialRoute, showLoading, router]);

  // Show loading screen until everything is ready and minimum time has passed
  if (!mounted || !initialRoute || (!fontsLoaded && !fontError) || showLoading) {
    return <LoadingScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider>
        <GestureHandlerRootView style={styles.container}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </GestureHandlerRootView>
      </SubscriptionProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});