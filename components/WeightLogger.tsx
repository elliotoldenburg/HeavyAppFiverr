import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, TrendingUp, Scale } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  Easing
} from 'react-native-reanimated';
import { useLastWeight } from '@/lib/hooks/useLastWeight';
import { WeightEntry } from '@/types/weight';
import { queryClient } from '@/lib/queryClient';

type Props = {
  onClose: (nextView?: string) => void;
};

// Default width for web platform
const DEFAULT_WEB_WIDTH = 400;

// Get window width based on platform
const getWindowWidth = () => {
  return Platform.OS === 'web' ? DEFAULT_WEB_WIDTH : Dimensions.get('window').width;
};

export default function WeightLogger({ onClose }: Props) {
  // Use React Query hook to fetch last weight
  const { data: lastEntry, isLoading: isLoadingLastWeight } = useLastWeight();
  
  // Initialize with last weight if available, otherwise use default
  const initialWeight = lastEntry?.weight_kg.toString() || '75.0';
  const initialSliderWeight = lastEntry?.weight_kg || 75.0;
  
  const [weight, setWeight] = useState(initialWeight);
  const [sliderWeight, setSliderWeight] = useState(initialSliderWeight);
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [existingEntry, setExistingEntry] = useState<WeightEntry | null>(null);
  
  const sliderWidth = getWindowWidth() - 64;
  const sliderFillWidth = useSharedValue((initialSliderWeight - 30) / (200 - 30) * sliderWidth);
  
  // Check for existing entry on selected date
  useEffect(() => {
    checkExistingEntry();
  }, [date]);
  
  // Update slider fill when weight changes
  useEffect(() => {
    const numWeight = parseFloat(weight);
    if (!isNaN(numWeight)) {
      const percentage = (numWeight - 30) / (200 - 30);
      sliderFillWidth.value = withTiming(
        percentage * sliderWidth,
        { duration: 100, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }
      );
    }
  }, [weight, sliderWidth]);
  
  const checkExistingEntry = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
      
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const { data, error: fetchError } = await supabase
        .from('weight_tracking')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .maybeSingle();
        
      if (!fetchError && data) {
        setExistingEntry(data);
        const weightValue = data.weight_kg.toString();
        setWeight(weightValue);
        setSliderWeight(data.weight_kg);
        
        // Set slider fill width based on weight
        const percentage = (data.weight_kg - 30) / (200 - 30);
        sliderFillWidth.value = percentage * sliderWidth;
      } else {
        setExistingEntry(null);
        
        // If no existing entry for this date and we have a last entry from React Query, use that
        if (lastEntry && !existingEntry) {
          const weightValue = lastEntry.weight_kg.toString();
          setWeight(weightValue);
          setSliderWeight(lastEntry.weight_kg);
        }
      }
    } catch (err) {
      console.error('Error checking existing weight entry:', err);
    }
  };

  const handleSaveWeight = async () => {
    if (!weight || isNaN(parseFloat(weight))) {
      setError('Ange en giltig vikt');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
      
      const dateStr = format(date, 'yyyy-MM-dd');
      const weightValue = parseFloat(weight);

      if (existingEntry) {
        // Update existing entry
        const { error: updateError } = await supabase
          .from('weight_tracking')
          .update({
            weight_kg: weightValue
          })
          .eq('id', existingEntry.id);
          
        if (updateError) throw updateError;
        
        Alert.alert('Uppdaterad', 'Din vikt har uppdaterats');
      } else {
        // Insert new entry
        const { error: insertError } = await supabase
          .from('weight_tracking')
          .insert({
            user_id: user.id,
            weight_kg: weightValue,
            date: dateStr,
          });

        if (insertError) throw insertError;
        
        Alert.alert('Sparad', 'Din vikt har loggats');
      }

      // Invalidate the lastWeight query to refresh the data
      await queryClient.invalidateQueries(['lastWeight']);
      
      onClose();
    } catch (err) {
      console.error('Error saving weight:', err);
      setError('Kunde inte spara vikten');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSliderChange = (value: number) => {
    setSliderWeight(value);
    setWeight(value.toFixed(1));
  };
  
  const handleTextInputChange = (text: string) => {
    // Replace comma with dot for decimal
    const sanitizedText = text.replace(',', '.');
    
    // Only update if it's a valid number
    if (/^\d*\.?\d*$/.test(sanitizedText)) {
      setWeight(sanitizedText);
      
      // Update slider if it's a valid number
      const numValue = parseFloat(sanitizedText);
      if (!isNaN(numValue)) {
        setSliderWeight(numValue);
        
        // Update slider fill width
        const percentage = (numValue - 30) / (200 - 30);
        sliderFillWidth.value = withTiming(
          percentage * sliderWidth,
          { duration: 100, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }
        );
      }
    }
  };
  
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };
  
  const formatDateDisplay = (date: Date) => {
    return format(date, 'EEEE d MMMM yyyy', { locale: sv });
  };
  
  const sliderFillStyle = useAnimatedStyle(() => {
    return {
      width: sliderFillWidth.value,
      height: 8,
      backgroundColor: '#009dff',
      borderRadius: 4,
      position: 'absolute',
      left: 0,
      top: 0,
    };
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(0,157,255,0.1)', 'rgba(0,0,0,1)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.3 }}
      />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => onClose()}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>Logga vikt</Text>
      </View>

      <View style={styles.content}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        {/* Last entry section */}
        {lastEntry && !isLoadingLastWeight && (
          <Pressable 
            style={styles.lastEntryContainer}
            onPress={() => {
              console.log('Stänger WeightLogger och öppnar weight-view');
              onClose('weight');
            }}
          >
            <View style={styles.lastEntryHeader}>
              <Scale size={20} color="#009dff" />
              <Text style={styles.lastEntryTitle}>Senaste vikten</Text>
            </View>
            <View style={styles.lastEntryContent}>
              <Text style={styles.lastEntryWeight}>{lastEntry.weight_kg.toFixed(1)} kg</Text>
              <Text style={styles.lastEntryDate}>
                {format(new Date(lastEntry.date), 'd MMMM yyyy', { locale: sv })}
              </Text>
            </View>
            <Text style={styles.viewHistoryText}>Tryck för att visa viktutveckling</Text>
          </Pressable>
        )}

        {isLoadingLastWeight && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#009dff" />
            <Text style={styles.loadingText}>Laddar vikthistorik...</Text>
          </View>
        )}

        <View style={styles.weightInputContainer}>
          <Text style={styles.label}>Vikt (kg)</Text>
          
          <View style={styles.sliderContainer}>
            <View style={styles.sliderTrack} />
            <Animated.View style={sliderFillStyle} />
            <Slider
              style={styles.slider}
              minimumValue={30}
              maximumValue={200}
              step={0.1}
              value={sliderWeight}
              onValueChange={handleSliderChange}
              minimumTrackTintColor="transparent"
              maximumTrackTintColor="transparent"
              thumbTintColor="#FFFFFF"
            />
          </View>
          
          <View style={styles.weightValueContainer}>
            <TextInput
              style={styles.weightInput}
              value={weight}
              onChangeText={handleTextInputChange}
              keyboardType="decimal-pad"
              placeholder="75.0"
              placeholderTextColor="#808080"
            />
            <Text style={styles.weightUnit}>kg</Text>
          </View>
        </View>

        <View style={styles.dateContainer}>
          <Text style={styles.label}>Datum</Text>
          <Pressable 
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Calendar size={20} color="#808080" style={styles.dateIcon} />
            <Text style={styles.dateText}>
              {formatDateDisplay(date)}
            </Text>
          </Pressable>
          
          {existingEntry && (
            <Text style={styles.existingEntryText}>
              Du har redan loggat vikt för detta datum. Spara för att uppdatera.
            </Text>
          )}
        </View>

        <Pressable
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveWeight}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              {existingEntry ? 'UPPDATERA' : 'SPARA'}
            </Text>
          )}
        </Pressable>
      </View>

      {Platform.OS !== 'web' && showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}
    </View>
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
    ...(Platform.OS === 'web' ? {
      overflow: 'auto',
    } : {}),
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginBottom: 16,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 8,
  },
  lastEntryContainer: {
    backgroundColor: 'rgba(0,157,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,157,255,0.2)',
  },
  lastEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  lastEntryTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  lastEntryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lastEntryWeight: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
  },
  lastEntryDate: {
    color: '#B0B0B0',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  viewHistoryText: {
    color: '#009dff',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  weightInputContainer: {
    marginBottom: 24,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 12,
  },
  sliderContainer: {
    height: 40,
    justifyContent: 'center',
    marginBottom: 16,
  },
  sliderTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    right: 0,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  weightValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  weightInput: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 20,
    textAlign: 'center',
  },
  weightUnit: {
    color: '#808080',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  dateContainer: {
    marginBottom: 24,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  dateIcon: {
    marginRight: 12,
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  existingEntryText: {
    color: '#FFA500',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#009dff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
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