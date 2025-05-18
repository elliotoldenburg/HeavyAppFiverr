import React, { useState } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, ArrowLeft } from 'lucide-react-native';

type FormData = {
  weight_kg: string;
  height_cm: string;
  gender: string;
  age: string;
  goal: string;
  activity_level: string;
};

const ACTIVITY_LEVELS = [
  'Stillasittande',
  'Låg (1-2 pass/vecka)',
  'Medel (3-4 pass/vecka)',
  'Hög (5-6 pass/vecka)',
  'Väldigt hög (2 pass per dag / idrottare)'
];

const GOALS = [
  'Gå ner i vikt',
  'Bygga muskler',
  'Behålla formen'
];

const GENDERS = ['Man', 'Kvinna', 'Annat'];

export default function NutritionGoalsScreen() {
  const [formData, setFormData] = useState<FormData>({
    weight_kg: '',
    height_cm: '',
    gender: '',
    age: '',
    goal: '',
    activity_level: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);

  const validateForm = () => {
    const requiredFields = [
      'weight_kg',
      'height_cm',
      'gender',
      'age',
      'goal',
      'activity_level'
    ];

    for (const field of requiredFields) {
      if (!formData[field as keyof FormData]) {
        setError(`Vänligen fyll i alla obligatoriska fält`);
        return false;
      }
    }

    return true;
  };

  const calculateMacros = (
    weight: number,
    height: number,
    age: number,
    gender: string,
    activityLevel: string,
    goal: string
  ) => {
    // Calculate BMR using Mifflin-St Jeor Equation
    let bmr = 0;
    if (gender === 'Man') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    // Apply activity multiplier
    let activityMultiplier = 1.2; // Sedentary
    if (activityLevel === 'Låg (1-2 pass/vecka)') {
      activityMultiplier = 1.375;
    } else if (activityLevel === 'Medel (3-4 pass/vecka)') {
      activityMultiplier = 1.55;
    } else if (activityLevel === 'Hög (5-6 pass/vecka)') {
      activityMultiplier = 1.725;
    } else if (activityLevel === 'Väldigt hög (2 pass per dag / idrottare)') {
      activityMultiplier = 1.9;
    }

    let tdee = bmr * activityMultiplier;

    // Adjust based on goal
    if (goal === 'Gå ner i vikt') {
      tdee = tdee * 0.8; // 20% deficit
    } else if (goal === 'Bygga muskler') {
      tdee = tdee * 1.1; // 10% surplus
    }

    // Calculate macros
    const protein = weight * 2; // 2g per kg bodyweight
    const fat = (tdee * 0.25) / 9; // 25% of calories from fat
    const carbs = (tdee - (protein * 4) - (fat * 9)) / 4; // Remaining calories from carbs

    return {
      calories: Math.round(tdee),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat)
    };
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Calculate macros
      const macros = calculateMacros(
        parseFloat(formData.weight_kg),
        parseFloat(formData.height_cm),
        parseInt(formData.age),
        formData.gender,
        formData.activity_level,
        formData.goal
      );

      // Send data to webhook
      const webhookUrl = process.env.EXPO_PUBLIC_MAKE_WEBHOOK_URL;
      if (webhookUrl) {
        console.log("Sending data to Make webhook...");
        const webhookData = {
          userId: user.id,
          email: user.email,
          ...formData,
          weight_kg: parseFloat(formData.weight_kg),
          height_cm: parseFloat(formData.height_cm),
          age: parseInt(formData.age),
          calculated_calories: macros.calories,
          calculated_protein: macros.protein,
          calculated_carbs: macros.carbs,
          calculated_fat: macros.fat,
          timestamp: new Date().toISOString(),
        };

        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookData),
          });

          if (!response.ok) {
            console.error("Webhook error:", await response.text());
          } else {
            console.log("Webhook data sent successfully");
          }
        } catch (webhookError) {
          console.error("Error sending webhook:", webhookError);
        }
      }

      // Save to Supabase
      const { error: insertError } = await supabase
        .from('macro_goals')
        .insert([{
          user_id: user.id,
          weight_kg: parseFloat(formData.weight_kg),
          height_cm: parseFloat(formData.height_cm),
          gender: formData.gender,
          age: parseInt(formData.age),
          activity_level: formData.activity_level,
          goal: formData.goal,
          calculated_calories: macros.calories,
          calculated_protein: macros.protein,
          calculated_carbs: macros.carbs,
          calculated_fat: macros.fat
        }]);

      if (insertError) throw insertError;

      router.replace('/(tabs)/nutrition');
    } catch (err: any) {
      console.error('Error in handleSave:', err);
      setError(err?.message || 'Ett fel uppstod. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  const renderDropdown = (
    field: keyof FormData,
    options: string[],
    placeholder: string
  ) => (
    <View style={styles.dropdownContainer}>
      <Pressable
        style={styles.dropdownButton}
        onPress={() => setShowDropdown(showDropdown === field ? null : field)}
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
      {showDropdown === field && (
        <View style={styles.dropdownList}>
          {options.map((option) => (
            <Pressable
              key={option}
              style={styles.dropdownItem}
              onPress={() => {
                setFormData({ ...formData, [field]: option });
                setShowDropdown(null);
              }}
            >
              <Text style={styles.dropdownItemText}>{option}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <LinearGradient
        colors={['rgba(0,157,255,0.1)', 'rgba(0,0,0,1)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.8 }}
      />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Beräkna dina näringsbehov</Text>
        <Text style={styles.subtitle}>
          Fyll i dina uppgifter för att få en anpassad näringsplan baserad på dina mål
        </Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Vikt (kg)</Text>
              <TextInput
                style={styles.textInput}
                value={formData.weight_kg}
                onChangeText={(text) => setFormData({ ...formData, weight_kg: text.replace(/[^0-9.]/g, '') })}
                keyboardType="numeric"
                placeholder="kg"
                placeholderTextColor="#808080"
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Längd (cm)</Text>
              <TextInput
                style={styles.textInput}
                value={formData.height_cm}
                onChangeText={(text) => setFormData({ ...formData, height_cm: text.replace(/[^0-9]/g, '') })}
                keyboardType="numeric"
                placeholder="cm"
                placeholderTextColor="#808080"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Kön</Text>
              {renderDropdown('gender', GENDERS, 'Välj kön')}
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Ålder</Text>
              <TextInput
                style={styles.textInput}
                value={formData.age}
                onChangeText={(text) => setFormData({ ...formData, age: text.replace(/[^0-9]/g, '') })}
                keyboardType="numeric"
                placeholder="År"
                placeholderTextColor="#808080"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mål</Text>
            {renderDropdown('goal', GOALS, 'Välj mål')}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Aktivitetsnivå</Text>
            {renderDropdown('activity_level', ACTIVITY_LEVELS, 'Välj aktivitetsnivå')}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.calculateButton,
            pressed && styles.calculateButtonPressed,
            loading && styles.calculateButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.calculateButtonText}>BERÄKNA MITT DAGSMÅL</Text>
          )}
          <LinearGradient
            colors={['rgba(0,157,255,0.2)', 'transparent']}
            style={styles.buttonGlow}
            pointerEvents="none"
          />
        </Pressable>
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
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 32,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 32,
    lineHeight: 24,
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
  textInput: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
  },
  dropdownContainer: {
    position: 'relative',
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
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    marginTop: 8,
    zIndex: 1000,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      },
      default: {
        elevation: 5,
      },
    }),
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
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
  calculateButton: {
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
  calculateButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  calculateButtonDisabled: {
    opacity: 0.7,
  },
  calculateButtonText: {
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
});