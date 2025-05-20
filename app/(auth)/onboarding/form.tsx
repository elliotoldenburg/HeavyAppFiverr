import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, CircleAlert as AlertCircle, ArrowLeft } from 'lucide-react-native';

type FormData = {
  fullName: string;
  username: string;
  age: string;
  gender: string;
  height_cm: string;
  weight_kg: string;
  trainingGoal: string;
  experienceLevel: string;
  equipmentAccess: string;
  injuries: string;
};

const EXPERIENCE_LEVELS = [
  'Nybörjare',
  'Medel',
  'Avancerad',
];

const EQUIPMENT_ACCESS = ['Gym', 'Hemmaträning'];
const GENDERS = ['Man', 'Kvinna', 'Annat'];

export default function OnboardingForm() {
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    username: '',
    age: '',
    gender: '',
    height_cm: '',
    weight_kg: '',
    trainingGoal: '',
    experienceLevel: '',
    equipmentAccess: '',
    injuries: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0, width: 0 });
  
  // Refs for dropdown buttons to measure their position
  const genderButtonRef = useRef<View>(null);
  const experienceLevelButtonRef = useRef<View>(null);
  const equipmentAccessButtonRef = useRef<View>(null);

  const validateForm = () => {
    const requiredFields = [
      'fullName',
      'username',
      'age',
      'gender',
      'height_cm',
      'weight_kg',
      'trainingGoal',
      'experienceLevel',
      'equipmentAccess',
    ];

    for (const field of requiredFields) {
      if (!formData[field as keyof FormData]) {
        setError(`Vänligen fyll i alla obligatoriska fält`);
        return false;
      }
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_\.]{3,30}$/;
    if (!usernameRegex.test(formData.username)) {
      setUsernameError('Användarnamn måste vara 3-30 tecken och får endast innehålla bokstäver, siffror, understreck och punkter');
      return false;
    }

    return true;
  };

  const checkUsernameAvailability = async (username: string) => {
    try {
      const { count, error } = await supabase
        .from('training_profiles')
        .select('*', { count: 'exact', head: true })
        .ilike('username', username);
      
      if (error) throw error;
      
      if (count && count > 0) {
        setUsernameError('Användarnamnet är redan taget');
        return false;
      }
      
      setUsernameError(null);
      return true;
    } catch (err) {
      console.error('Error checking username:', err);
      return false;
    }
  };

  const handleUsernameChange = async (text: string) => {
    // Remove spaces and special characters
    const formattedUsername = text.replace(/[^a-zA-Z0-9_\.]/g, '');
    setFormData({ ...formData, username: formattedUsername });
    
    if (formattedUsername.length >= 3) {
      await checkUsernameAvailability(formattedUsername);
    } else if (formattedUsername.length > 0) {
      setUsernameError('Användarnamn måste vara minst 3 tecken');
    } else {
      setUsernameError(null);
    }
  };

  const createTrainingCycle = async (userId: string, goal: string) => {
    try {
      const { data: cycle, error } = await supabase
        .from('training_cycles')
        .insert([{
          user_id: userId,
          goal: goal,
          start_date: new Date().toISOString().split('T')[0],
          active: true
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating training cycle:', error);
        // Continue anyway, as this is not critical for onboarding
      } else {
        console.log('Training cycle created:', cycle);
      }
    } catch (err) {
      console.error('Error in createTrainingCycle:', err);
      // Continue anyway, as this is not critical for onboarding
    }
  };

  const logInitialWeight = async (userId: string, weight: number) => {
    try {
      const { error } = await supabase
        .from('weight_tracking')
        .insert([{
          user_id: userId,
          date: new Date().toISOString().split('T')[0],
          weight_kg: weight
        }]);

      if (error) {
        console.error('Error logging initial weight:', error);
        // Continue anyway, as this is not critical for onboarding
      } else {
        console.log('Initial weight logged successfully');
      }
    } catch (err) {
      console.error('Error in logInitialWeight:', err);
      // Continue anyway, as this is not critical for onboarding
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    // Final username check
    const isUsernameAvailable = await checkUsernameAvailability(formData.username);
    if (!isUsernameAvailable) return;

    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      console.log('Saving profile with data:', {
        user_id: user.id,
        full_name: formData.fullName,
        username: formData.username,
        age: parseInt(formData.age),
        gender: formData.gender,
        height_cm: parseInt(formData.height_cm),
        weight_kg: parseFloat(formData.weight_kg),
        training_goal: formData.trainingGoal,
        equipment_access: formData.equipmentAccess,
        injuries: formData.injuries || null,
      });

      const { error: profileError } = await supabase
        .from('training_profiles')
        .insert([{
          user_id: user.id,
          full_name: formData.fullName,
          username: formData.username,
          age: parseInt(formData.age),
          gender: formData.gender,
          height_cm: parseInt(formData.height_cm),
          weight_kg: parseFloat(formData.weight_kg),
          training_goal: formData.trainingGoal,
          experience_level: formData.experienceLevel,
          equipment_access: formData.equipmentAccess,
          injuries: formData.injuries || null,
        }]);

      if (profileError) {
        console.error('Profile Error:', profileError);
        if (profileError.message.includes('username_format')) {
          setUsernameError('Ogiltigt användarnamn format');
          return;
        }
        if (profileError.message.includes('idx_training_profiles_username_lower')) {
          setUsernameError('Användarnamnet är redan taget');
          return;
        }
        throw new Error('Kunde inte spara träningsprofilen');
      }

      // Log initial weight to weight_tracking table
      await logInitialWeight(user.id, parseFloat(formData.weight_kg));

      // Create a training cycle with the user's goal
      await createTrainingCycle(user.id, formData.trainingGoal);

      // Send to Make webhook
      const webhookUrl = process.env.EXPO_PUBLIC_MAKE_WEBHOOK_URL;
      if (webhookUrl) {
        console.log("📤 [OnboardingForm] Sending data to Make webhook...");
        const webhookData = {
          userId: user.id,
          email: user.email,
          ...formData,
          age: parseInt(formData.age),
          height_cm: parseInt(formData.height_cm),
          weight_kg: parseFloat(formData.weight_kg),
          timestamp: new Date().toISOString(),
        };

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookData),
        });

        if (!response.ok) {
          console.error("❌ [OnboardingForm] Webhook error:", await response.text());
          // Don't throw error here - we want to continue even if webhook fails
        } else {
          console.log("✅ [OnboardingForm] Webhook data sent successfully");
        }
      }

      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Error in handleSubmit:', err);
      setError(err?.message || 'Ett fel uppstod. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/(auth)/onboarding/info');
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const measureDropdownPosition = (ref: React.RefObject<View>, field: string) => {
    if (ref.current && Platform.OS === 'web') {
      // For web, we can use getBoundingClientRect
      const element = ref.current as unknown as HTMLElement;
      const rect = element.getBoundingClientRect();
      setDropdownPosition({
        x: rect.left,
        y: rect.bottom,
        width: rect.width
      });
      setShowDropdown(field);
    } else if (ref.current) {
      // For native, use measure
      ref.current.measure((x, y, width, height, pageX, pageY) => {
        setDropdownPosition({
          x: pageX,
          y: pageY + height,
          width: width
        });
        setShowDropdown(field);
      });
    }
  };

  const renderDropdownButton = (
    field: keyof FormData,
    placeholder: string,
    ref: React.RefObject<View>
  ) => (
    <Pressable
      ref={ref}
      style={styles.dropdownButton}
      onPress={() => {
        if (showDropdown === field) {
          setShowDropdown(null);
        } else {
          measureDropdownPosition(ref, field);
        }
      }}
    >
      <Text style={[styles.input, !formData[field] && styles.placeholder]}>
        {formData[field] || placeholder}
      </Text>
      <ChevronDown
        size={20}
        color="#FFFFFF"
        style={[
          styles.dropdownIcon,
          showDropdown === field && styles.dropdownIconActive,
        ]}
      />
    </Pressable>
  );

  const renderRequiredLabel = (text: string) => (
    <Text style={styles.label}>
      {text} <Text style={styles.requiredAsterisk}>*</Text>
    </Text>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <LinearGradient
        colors={['rgba(0,157,255,0.1)', 'rgba(0,0,0,1)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.8 }}
      />

      <Pressable style={styles.backButton} onPress={handleBack}>
        <ArrowLeft size={24} color="#FFFFFF" />
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title}>Dina träningsuppgifter</Text>
        <Text style={styles.subtitle}>
          För att ge dig ett anpassat program behöver vi veta lite mer om dig
        </Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            {renderRequiredLabel('Fullständigt namn')}
            <TextInput
              style={styles.textInput}
              value={formData.fullName}
              onChangeText={(text) => setFormData({ ...formData, fullName: text })}
              placeholder="Ditt namn"
              placeholderTextColor="#808080"
            />
          </View>

          <View style={styles.inputGroup}>
            {renderRequiredLabel('Användarnamn')}
            <TextInput
              style={[styles.textInput, usernameError && styles.inputError]}
              value={formData.username}
              onChangeText={handleUsernameChange}
              placeholder="Välj ett unikt användarnamn"
              placeholderTextColor="#808080"
              autoCapitalize="none"
            />
            {usernameError && (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color="#FF4444" />
                <Text style={styles.fieldErrorText}>{usernameError}</Text>
              </View>
            )}
            <Text style={styles.helperText}>
              Användarnamnet måste vara unikt och kommer användas för att andra ska kunna hitta dig
            </Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              {renderRequiredLabel('Ålder')}
              <TextInput
                style={styles.textInput}
                value={formData.age}
                onChangeText={(text) => setFormData({ ...formData, age: text.replace(/[^0-9]/g, '') })}
                keyboardType="numeric"
                placeholder="År"
                placeholderTextColor="#808080"
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              {renderRequiredLabel('Kön')}
              <View style={styles.genderDropdownContainer}>
                {renderDropdownButton('gender', 'Välj kön', genderButtonRef)}
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              {renderRequiredLabel('Längd')}
              <TextInput
                style={styles.textInput}
                value={formData.height_cm}
                onChangeText={(text) => setFormData({ ...formData, height_cm: text.replace(/[^0-9]/g, '') })}
                keyboardType="numeric"
                placeholder="cm"
                placeholderTextColor="#808080"
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              {renderRequiredLabel('Vikt')}
              <TextInput
                style={styles.textInput}
                value={formData.weight_kg}
                onChangeText={(text) => setFormData({ ...formData, weight_kg: text.replace(/[^0-9.]/g, '') })}
                keyboardType="numeric"
                placeholder="kg"
                placeholderTextColor="#808080"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            {renderRequiredLabel('Träningsmål')}
            <TextInput
              style={styles.textInput}
              value={formData.trainingGoal}
              onChangeText={(text) => setFormData({ ...formData, trainingGoal: text })}
              placeholder="Beskriv ditt träningsmål"
              placeholderTextColor="#808080"
              multiline
            />
            <Text style={styles.helperText}>
              T.ex. "Bygga muskelmassa", "Gå ner i vikt", "Förbättra styrka" eller annat personligt mål
            </Text>
          </View>

          <View style={styles.inputGroup}>
            {renderRequiredLabel('Träningsvana')}
            <View style={styles.dropdownContainer}>
              {renderDropdownButton('experienceLevel', 'Välj träningsvana', experienceLevelButtonRef)}
            </View>
          </View>

          <View style={styles.inputGroup}>
            {renderRequiredLabel('Tillgång till utrustning')}
            <View style={styles.dropdownContainer}>
              {renderDropdownButton('equipmentAccess', 'Välj utrustning', equipmentAccessButtonRef)}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Eventuella skador (valfritt)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={formData.injuries}
              onChangeText={(text) => setFormData({ ...formData, injuries: text })}
              placeholder="T.ex. knäproblem, kan inte göra djupa böj"
              placeholderTextColor="#808080"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitButtonPressed,
            loading && styles.submitButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>SPARA & FORTSÄTT</Text>
          )}
          <LinearGradient
            colors={['rgba(0,157,255,0.2)', 'transparent']}
            style={styles.buttonGlow}
            pointerEvents="none"
          />
        </Pressable>
      </View>

      {/* Modal for dropdown options */}
      <Modal
        visible={showDropdown !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDropdown(null)}
      >
        <TouchableWithoutFeedback onPress={() => setShowDropdown(null)}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        
        {showDropdown === 'gender' && (
          <View 
            style={[
              styles.dropdownOverlay, 
              { 
                top: dropdownPosition.y, 
                left: dropdownPosition.x,
                width: dropdownPosition.width 
              }
            ]}
          >
            {GENDERS.map((option) => (
              <Pressable
                key={option}
                style={styles.dropdownItem}
                onPress={() => {
                  setFormData({ ...formData, gender: option });
                  setShowDropdown(null);
                }}
              >
                <Text style={styles.dropdownItemText}>{option}</Text>
              </Pressable>
            ))}
          </View>
        )}
        
        {showDropdown === 'experienceLevel' && (
          <View 
            style={[
              styles.dropdownOverlay, 
              { 
                top: dropdownPosition.y, 
                left: dropdownPosition.x,
                width: dropdownPosition.width 
              }
            ]}
          >
            {EXPERIENCE_LEVELS.map((option) => (
              <Pressable
                key={option}
                style={styles.dropdownItem}
                onPress={() => {
                  setFormData({ ...formData, experienceLevel: option });
                  setShowDropdown(null);
                }}
              >
                <Text style={styles.dropdownItemText}>{option}</Text>
              </Pressable>
            ))}
          </View>
        )}
        
        {showDropdown === 'equipmentAccess' && (
          <View 
            style={[
              styles.dropdownOverlay, 
              { 
                top: dropdownPosition.y, 
                left: dropdownPosition.x,
                width: dropdownPosition.width 
              }
            ]}
          >
            {EQUIPMENT_ACCESS.map((option) => (
              <Pressable
                key={option}
                style={styles.dropdownItem}
                onPress={() => {
                  setFormData({ ...formData, equipmentAccess: option });
                  setShowDropdown(null);
                }}
              >
                <Text style={styles.dropdownItemText}>{option}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    ...(Platform.OS === 'web' ? {
      height: '100%',
      overflow: 'auto',
    } : {}),
  },
  scrollContent: {
    flexGrow: 1,
    ...(Platform.OS === 'web' ? {
      minHeight: '100%',
    } : {}),
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 32,
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 32,
    textAlign: 'center',
  },
  form: {
    gap: 24,
    marginBottom: 32,
  },
  inputGroup: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  requiredAsterisk: {
    color: '#FF4444',
    fontWeight: 'bold',
  },
  textInput: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  fieldErrorText: {
    color: '#FF4444',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  helperText: {
    color: '#808080',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 8,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 16,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 10,
  },
  dropdownButton: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
  },
  dropdownIcon: {
    transform: [{ rotate: '0deg' }],
  },
  dropdownIconActive: {
    transform: [{ rotate: '180deg' }],
  },
  dropdownOverlay: {
    position: 'absolute',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#333333',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.8)',
        maxHeight: 200,
        overflow: 'auto',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    backgroundColor: '#1A1A1A',
  },
  dropdownItemText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    padding: 16,
  },
  placeholder: {
    color: '#808080',
  },
  errorText: {
    color: '#FF4444',
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: '#009dff',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'transform 0.2s ease-in-out',
        ':hover': {
          transform: 'scale(1.02)',
        },
      },
    }),
  },
  submitButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 1,
  },
  buttonGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '200%',
    opacity: 0.5,
  },
  // Special styles for gender dropdown to ensure it displays correctly
  genderDropdownContainer: {
    position: 'relative',
    zIndex: 20, // Higher z-index than other dropdowns
  },
});