import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, WifiOff } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const checkConnectivity = async () => {
    try {
      // Use a more reliable endpoint for connectivity check
      const response = await fetch('https://rwieuytvyefqyjpbaeza.supabase.co/auth/v1/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      setIsOffline(false);
      return true;
    } catch (err) {
      console.error('Connectivity check failed:', err);
      setIsOffline(true);
      return false;
    }
  };

  const handleLogin = async () => {
    try {
      setError(null);
      
      // Input validation
      if (!email || !password) {
        setError('Vänligen fyll i alla fält');
        return;
      }

      if (!validateEmail(email)) {
        setError('Vänligen ange en giltig e-postadress');
        return;
      }

      setLoading(true);

      // Check connectivity first
      const isConnected = await checkConnectivity();
      if (!isConnected) {
        throw new Error('Ingen internetanslutning. Kontrollera din uppkoppling och försök igen.');
      }

      // Attempt login with retry
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });

          if (signInError) {
            if (signInError.message.includes('Invalid login credentials')) {
              throw new Error('Fel e-post eller lösenord');
            }
            throw signInError;
          }

          if (data?.user) {
            console.log("✅ [Login] Inloggning lyckades!");
            return; // Success - let RootLayout handle navigation
          }

          break; // Exit loop if successful
        } catch (err: any) {
          if (err.message.includes('Network request failed') && retryCount < maxRetries) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
            continue;
          }
          throw err;
        }
      }
    } catch (err: any) {
      console.error("❌ [Login] Inloggningsfel:", err);
      if (err.message.includes('Network request failed') || err.message.includes('internetanslutning')) {
        setError('Kunde inte ansluta till servern. Kontrollera din internetanslutning och försök igen.');
      } else {
        setError(err.message || 'Ett fel uppstod vid inloggning');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.content}>
        <Link href="/(auth)/welcome" asChild style={styles.backButton}>
          <Pressable>
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
        </Link>

        <Image
          source={require('../../assets/images/heavygymlogga_optimized.webp')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.description}>
          Logga in och fortsätt din träningsresa.
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            {isOffline && <WifiOff size={20} color="#FF4444" style={styles.errorIcon} />}
            <Text style={styles.errorText}>{error}</Text>
            {isOffline && (
              <Pressable style={styles.retryButton} onPress={handleLogin}>
                <Text style={styles.retryButtonText}>Försök igen</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <Mail size={20} color="#FFFFFF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="E-postadress"
              placeholderTextColor="#808080"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete={Platform.OS === 'web' ? 'email' : 'email'}
              inputMode="email"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Lock size={20} color="#FFFFFF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Lösenord"
              placeholderTextColor="#808080"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete={Platform.OS === 'web' ? 'current-password' : 'password'}
              inputMode="text"
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              {showPassword ? (
                <EyeOff size={20} color="#FFFFFF" />
              ) : (
                <Eye size={20} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>

        <Pressable
          style={[styles.loginButton, loading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginButtonText}>LOGGA IN</Text>
          )}
        </Pressable>

        <Link href="/reset-password" asChild>
          <Pressable style={styles.resetPasswordLink}>
            <Text style={styles.resetPasswordText}>
              Glömt lösenord? <Text style={styles.resetPasswordHighlight}>Återställ här</Text>
            </Text>
          </Pressable>
        </Link>

        <Link href="/register" asChild>
          <Pressable style={styles.registerLink}>
            <Text style={styles.registerText}>
              Har du inget konto? <Text style={styles.registerHighlight}>Skapa ett här</Text>
            </Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 24,
    zIndex: 10,
  },
  logo: {
    width: 200,
    height: 64,
    marginBottom: 24,
  },
  description: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 300,
  },
  errorContainer: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.2)',
  },
  errorIcon: {
    marginBottom: 8,
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: 'rgba(255,68,68,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  inputContainer: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 8,
  },
  loginButton: {
    backgroundColor: '#0056A6',
    width: '100%',
    maxWidth: 320,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#0056A6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 1,
  },
  resetPasswordLink: {
    marginTop: 16,
    marginBottom: 8,
  },
  resetPasswordText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  resetPasswordHighlight: {
    color: '#0056A6',
    textDecorationLine: 'underline',
  },
  registerLink: {
    marginTop: 8,
  },
  registerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  registerHighlight: {
    color: '#0056A6',
    textDecorationLine: 'underline',
  },
});