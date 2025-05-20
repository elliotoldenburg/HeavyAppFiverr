import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Calendar } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function NewCycleScreen() {
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const handleSave = async () => {
    if (!goal.trim()) {
      setError('Ange ett mål för träningscykeln');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // First deactivate any existing active cycles
      const { error: deactivateError } = await supabase
        .from('training_cycles')
        .update({
          active: false,
          end_date: new Date().toISOString().split('T')[0]
        })
        .eq('user_id', user.id)
        .eq('active', true);

      if (deactivateError) {
        console.error('Error deactivating existing cycles:', deactivateError);
        // Continue anyway, as the trigger should handle this
      }

      // Create the new cycle
      const { data: newCycle, error: cycleError } = await supabase
        .from('training_cycles')
        .insert({
          user_id: user.id,
          goal: goal.trim(),
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate ? endDate.toISOString().split('T')[0] : null,
          active: true
        })
        .select()
        .single();

      if (cycleError) throw cycleError;

      // Update the training profile with the new goal
      const { error: profileError } = await supabase
        .from('training_profiles')
        .update({ 
          training_goal: goal.trim() 
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      // Navigate back to profile screen
      router.replace('/(tabs)/profile');
    } catch (err) {
      console.error('Error saving training cycle:', err);
      setError('Kunde inte spara träningscykeln');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(0,157,255,0.1)', 'rgba(0,0,0,1)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.3 }}
      />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>Starta ny träningscykel</Text>
      </View>

      <ScrollView style={styles.content}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Mål med träningen</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={goal}
              onChangeText={setGoal}
              placeholder="T.ex. bygga styrka, gå ner i vikt..."
              placeholderTextColor="#808080"
              multiline
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Startdatum</Text>
          <Pressable 
            style={styles.dateButton}
            onPress={() => setShowStartPicker(true)}
          >
            <Calendar size={20} color="#808080" />
            <Text style={styles.dateText}>
              {formatDate(startDate)}
            </Text>
          </Pressable>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Slutdatum (valfritt)</Text>
          <Pressable 
            style={styles.dateButton}
            onPress={() => setShowEndPicker(true)}
          >
            <Calendar size={20} color="#808080" />
            <Text style={styles.dateText}>
              {endDate ? formatDate(endDate) : 'Välj datum'}
            </Text>
          </Pressable>
          {endDate && (
            <Pressable
              style={styles.clearDateButton}
              onPress={() => setEndDate(null)}
            >
              <Text style={styles.clearDateText}>Ta bort slutdatum</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>SPARA CYKEL</Text>
          )}
        </Pressable>
      </ScrollView>

      {(Platform.OS !== 'web' && showStartPicker) && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartPicker(false);
            if (selectedDate) {
              setStartDate(selectedDate);
            }
          }}
        />
      )}

      {(Platform.OS !== 'web' && showEndPicker) && (
        <DateTimePicker
          value={endDate || new Date()}
          mode="date"
          display="default"
          minimumDate={startDate}
          onChange={(event, selectedDate) => {
            setShowEndPicker(false);
            if (selectedDate) {
              setEndDate(selectedDate);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  errorContainer: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.2)',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  clearDateButton: {
    marginTop: 8,
    padding: 8,
  },
  clearDateText: {
    color: '#009dff',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#009dff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});