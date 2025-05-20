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
  Linking,
  Platform,
} from 'react-native';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    // RFC 5322 compliant email regex
    const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return emailRegex.test(email.toLowerCase());
  };

  const handleRegister = async () => {
    setError(null);

    // Form validation
    if (!name || !email || !password || !confirmPassword) {
      setError('Vänligen fyll i alla fält');
      return;
    }

    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken långt');
      return;
    }

    if (password !== confirmPassword) {
      setError('Lösenorden matchar inte');
      return;
    }

    if (!validateEmail(email)) {
      setError('Vänligen ange en giltig e-postadress');
      return;
    }

    setLoading(true);

    try {
      // Simple registration call
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim()
          }
        }
      });

      if (signUpError) {
        console.error("❌ [Register] SignUp error:", signUpError);
        if (signUpError.message.includes('invalid format')) {
          setError('Ogiltig e-postadress. Kontrollera formatet och försök igen.');
        } else {
          throw signUpError;
        }
        return;
      }

      if (data?.user) {
        console.log("✅ [Register] Registration successful:", data.user);
        router.replace('/(auth)/onboarding/info');
      } else {
        setError('Ett oväntat fel uppstod. Försök igen senare.');
      }
    } catch (err: any) {
      console.error('❌ [Register] Error:', err);
      setError('Ett fel uppstod vid registrering. Försök igen.');
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
        <Image
          source={require('../../assets/images/heavygymlogga_optimized.webp')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.description}>
          Börja din resa med ett konto – få tillgång till träningsplaner och statistik.
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            {error.includes('finns redan') && (
              <Link href="/login" asChild>
                <Pressable style={styles.errorActionButton}>
                  <Text style={styles.errorActionButtonText}>Gå till inloggning</Text>
                </Pressable>
              </Link>
            )}
          </View>
        )}

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <User size={20} color="#FFFFFF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Namn"
              placeholderTextColor="#808080"
              value={name}
              onChangeText={setName}
            />
          </View>

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
              autoComplete="email"
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
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              {showPassword ? (
                <EyeOff size={20} color="#FFFFFF" />
              ) : (
                <Eye size={20} color="#FFFFFF" />
              )}
            </Pressable>
          </View>

          <View style={styles.inputWrapper}>
            <Lock size={20} color="#FFFFFF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Bekräfta lösenord"
              placeholderTextColor="#808080"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
            />
            <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
              {showConfirmPassword ? (
                <EyeOff size={20} color="#FFFFFF" />
              ) : (
                <Eye size={20} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>

        <Pressable
          style={[styles.registerButton, loading && styles.registerButtonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.registerButtonText}>SKAPA KONTO</Text>
          )}
        </Pressable>

        <Link href="/login" asChild>
          <Pressable style={styles.loginLink}>
            <Text style={styles.loginLinkText}>
              Har du redan ett konto? <Text style={styles.loginLinkHighlight}>Logga in här</Text>
            </Text>
          </Pressable>
        </Link>

        <Text style={styles.termsText}>
          Genom att skapa ett konto godkänner du våra{' '}
          <Text style={styles.termsLink} onPress={() => Linking.openURL('https://heavygym.com/terms')}>
            Terms
          </Text>{' '}
          &{' '}
          <Text style={styles.termsLink} onPress={() => Linking.openURL('https://heavygym.com/privacy')}>
            Privacy Policy
          </Text>
        </Text>
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
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 320,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.2)',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  errorActionButton: {
    marginTop: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  errorActionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
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
  registerButton: {
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
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 1,
  },
  loginLink: {
    marginTop: 16,
    marginBottom: 24,
  },
  loginLinkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  loginLinkHighlight: {
    color: '#0056A6',
    textDecorationLine: 'underline',
  },
  termsText: {
    color: '#808080',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  termsLink: {
    color: '#0056A6',
    textDecorationLine: 'underline',
  },
});