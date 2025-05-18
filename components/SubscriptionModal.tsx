import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { router, usePathname, useSegments } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, LogOut } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export default function SubscriptionModal() {
  const pathname = usePathname();
  const segments = useSegments();
  
  // Check if we're on an auth screen using segments
  const isAuthScreen = segments[0] === '(auth)';
  
  // Don't show modal on auth screens, welcome screen, subscription screen, or checkout pages
  if (
    isAuthScreen || 
    pathname.includes('login') ||
    pathname.includes('register') ||
    pathname.includes('welcome') ||
    pathname === '/' ||
    pathname === '/subscription' ||
    pathname.startsWith('/checkout/')
  ) {
    return null;
  }

  const handleSubscribe = () => {
    router.push('/subscription');
  };
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.modalContainer}>
        <LinearGradient
          colors={['#1A1A1A', '#000000']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        
        <View style={styles.iconContainer}>
          <Sparkles size={28} color="#FFD700" />
        </View>
        
        <Text style={styles.title}>Prenumeration krävs</Text>
        
        <Text style={styles.description}>
          För att kunna fortsätta använda appen behöver du en aktiv prenumeration. Teckna eller förnya ditt abonnemang för att få full åtkomst.
        </Text>
        
        <Pressable
          style={styles.subscribeButton}
          onPress={handleSubscribe}
        >
          <Text style={styles.subscribeButtonText}>Teckna abonnemang</Text>
        </Pressable>
        
        <Pressable
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <LogOut size={16} color="#FF4444" style={styles.logoutIcon} />
          <Text style={styles.logoutButtonText}>Logga ut</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    width: '80%',
    maxWidth: 320,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    // Add shadow for better visibility
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.25)',
      },
    }),
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  title: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  subscribeButton: {
    backgroundColor: '#009dff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.5,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  logoutButtonText: {
    color: '#FF4444',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  logoutIcon: {
    marginRight: 6,
  },
});