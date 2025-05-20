import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { Calendar, ChevronDown, Plus, Trash2, X } from 'lucide-react-native';

type WeightRecord = {
  id: string;
  date: string;
  weight_kg: number;
  created_at: string;
};

type TimeRange = '4w' | '6m' | '1y';

type Props = {
  onClose: () => void;
};

export default function WeightTracker({ onClose }: Props) {
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('4w');
  const [showTimeRangeDropdown, setShowTimeRangeDropdown] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingRecord, setEditingRecord] = useState<WeightRecord | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    fetchWeights();
  }, [selectedTimeRange]);

  const getStartDate = () => {
    const now = new Date();
    switch (selectedTimeRange) {
      case '4w':
        return new Date(now.setDate(now.getDate() - 28));
      case '6m':
        return new Date(now.setMonth(now.getMonth() - 6));
      case '1y':
        return new Date(now.setFullYear(now.getFullYear() - 1));
    }
  };

  const fetchWeights = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const startDate = getStartDate();
      const { data, error: fetchError } = await supabase
        .from('weight_tracking')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate.toISOString())
        .order('date', { ascending: true });

      if (fetchError) throw fetchError;
      setWeights(data || []);
    } catch (err) {
      console.error('Error fetching weights:', err);
      setError('Kunde inte ladda viktdata');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWeight = async () => {
    if (!newWeight || isNaN(parseFloat(newWeight))) {
      setError('Ange en giltig vikt');
      return;
    }

    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const weightKg = parseFloat(newWeight);

      // Check if there's already a weight entry for this date
      const existingEntry = weights.find(w => w.date === selectedDate && w.id !== editingRecord?.id);

      if (existingEntry) {
        // Update existing entry for this date
        const { error: updateError } = await supabase
          .from('weight_tracking')
          .update({ weight_kg: weightKg })
          .eq('id', existingEntry.id);

        if (updateError) throw updateError;
      } else if (editingRecord) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('weight_tracking')
          .update({ 
            weight_kg: weightKg,
            date: selectedDate 
          })
          .eq('id', editingRecord.id);

        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('weight_tracking')
          .insert({
            user_id: user.id,
            date: selectedDate,
            weight_kg: weightKg,
          });

        if (insertError) throw insertError;
      }

      await fetchWeights();
      setShowAddModal(false);
      setNewWeight('');
      setEditingRecord(null);
    } catch (err) {
      console.error('Error saving weight:', err);
      setError('Kunde inte spara vikten');
    }
  };

  const handleDeleteWeight = async () => {
    if (!editingRecord) return;

    try {
      setDeleting(true);
      setError(null);
      
      const { error: deleteError } = await supabase
        .from('weight_tracking')
        .delete()
        .eq('id', editingRecord.id);

      if (deleteError) throw deleteError;

      // Update local state
      setWeights(weights.filter(w => w.id !== editingRecord.id));
      
      // Close modals
      setShowDeleteConfirm(false);
      setShowAddModal(false);
      
      // Reset state
      setEditingRecord(null);
      setNewWeight('');
      setSelectedDate(new Date().toISOString().split('T')[0]);
      
      // Refresh data
      await fetchWeights();
    } catch (err) {
      console.error('Error deleting weight:', err);
      setError('Kunde inte ta bort vikten');
    } finally {
      setDeleting(false);
    }
  };

  const getChartData = () => {
    if (weights.length === 0) return null;

    return {
      labels: weights.map(w => 
        new Date(w.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
      ),
      datasets: [
        {
          data: weights.map(w => w.weight_kg),
          color: (opacity = 1) => {
            // Get weight change direction
            const weightChange = weights.length > 1 
              ? weights[weights.length - 1].weight_kg - weights[0].weight_kg 
              : 0;

            if (weightChange < 0) return `rgba(34, 197, 94, ${opacity})`; // Green for weight loss
            if (weightChange > 0) return `rgba(239, 68, 68, ${opacity})`; // Red for weight gain
            return `rgba(0, 157, 255, ${opacity})`; // Blue for no change
          },
          strokeWidth: 2
        }
      ]
    };
  };

  const chartConfig = {
    backgroundColor: '#1A1A1A',
    backgroundGradientFrom: '#1A1A1A',
    backgroundGradientTo: '#1A1A1A',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#1A1A1A'
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#009dff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Viktutveckling</Text>
        <Pressable
          style={styles.closeButton}
          onPress={onClose}
        >
          <X size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.filters}>
          <Pressable
            style={styles.dropdown}
            onPress={() => setShowTimeRangeDropdown(!showTimeRangeDropdown)}
          >
            <Calendar size={20} color="#FFFFFF" />
            <Text style={styles.dropdownText}>
              {selectedTimeRange === '4w' ? 'Senaste 4 veckorna' :
               selectedTimeRange === '6m' ? 'Senaste 6 månaderna' :
               'Senaste året'}
            </Text>
            <ChevronDown 
              size={20} 
              color="#FFFFFF" 
              style={[
                styles.dropdownIcon,
                showTimeRangeDropdown && styles.dropdownIconActive
              ]} 
            />
          </Pressable>

          {showTimeRangeDropdown && (
            <View style={styles.dropdownMenu}>
              <Pressable
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedTimeRange('4w');
                  setShowTimeRangeDropdown(false);
                }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  selectedTimeRange === '4w' && styles.dropdownItemTextActive
                ]}>
                  Senaste 4 veckorna
                </Text>
              </Pressable>
              <Pressable
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedTimeRange('6m');
                  setShowTimeRangeDropdown(false);
                }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  selectedTimeRange === '6m' && styles.dropdownItemTextActive
                ]}>
                  Senaste 6 månaderna
                </Text>
              </Pressable>
              <Pressable
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedTimeRange('1y');
                  setShowTimeRangeDropdown(false);
                }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  selectedTimeRange === '1y' && styles.dropdownItemTextActive
                ]}>
                  Senaste året
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {getChartData() && (
          <View style={styles.chartContainer}>
            <LineChart
              data={getChartData()!}
              width={screenWidth - 48}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              yAxisLabel=""
              yAxisSuffix=" kg"
            />
          </View>
        )}

        <ScrollView style={styles.weightList}>
          {weights.map((weight) => (
            <Pressable
              key={weight.id}
              style={styles.weightItem}
              onPress={() => {
                setEditingRecord(weight);
                setNewWeight(weight.weight_kg.toString());
                setSelectedDate(weight.date);
                setShowAddModal(true);
              }}
            >
              <View style={styles.weightInfo}>
                <Text style={styles.weightValue}>{weight.weight_kg} kg</Text>
                <Text style={styles.weightDate}>{formatDate(weight.date)}</Text>
              </View>
              <ChevronDown size={20} color="#808080" />
            </Pressable>
          ))}
        </ScrollView>

        <Pressable
          style={styles.addButton}
          onPress={() => {
            setEditingRecord(null);
            setNewWeight('');
            setSelectedDate(new Date().toISOString().split('T')[0]);
            setShowAddModal(true);
          }}
        >
          <Plus size={24} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Lägg till ny vikt</Text>
        </Pressable>
      </View>

      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowAddModal(false);
          setError(null);
          setEditingRecord(null);
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingRecord ? 'Redigera vikt' : 'Lägg till ny vikt'}
              </Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => {
                  setShowAddModal(false);
                  setError(null);
                  setEditingRecord(null);
                }}
              >
                <X size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Vikt (kg)</Text>
              <TextInput
                style={styles.formInput}
                value={newWeight}
                onChangeText={setNewWeight}
                keyboardType="decimal-pad"
                placeholder="T.ex. 75.5"
                placeholderTextColor="#808080"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Datum</Text>
              <TextInput
                style={styles.formInput}
                value={selectedDate}
                onChangeText={setSelectedDate}
                placeholder="ÅÅÅÅ-MM-DD"
                placeholderTextColor="#808080"
              />
            </View>

            <View style={styles.modalActions}>
              {editingRecord && (
                <Pressable
                  style={[styles.deleteButton, deleting && styles.buttonDisabled]}
                  onPress={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                >
                  <Trash2 size={20} color="#FF4444" />
                  <Text style={styles.deleteButtonText}>Ta bort</Text>
                </Pressable>
              )}

              <Pressable
                style={[styles.saveButton, deleting && styles.buttonDisabled]}
                onPress={handleSaveWeight}
                disabled={deleting}
              >
                <Text style={styles.saveButtonText}>Spara</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.confirmModalContainer}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmTitle}>Ta bort vikt?</Text>
            <Text style={styles.confirmText}>
              Är du säker på att du vill ta bort denna viktregistrering?
            </Text>

            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                <Text style={styles.confirmButtonText}>Avbryt</Text>
              </Pressable>

              <Pressable
                style={[styles.confirmButton, styles.deleteConfirmButton]}
                onPress={handleDeleteWeight}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.confirmButtonText, styles.deleteConfirmButtonText]}>
                    Ta bort
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  errorContainer: {
    margin: 24,
    padding: 16,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.2)',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  filters: {
    marginBottom: 24,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
  },
  dropdownText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  dropdownIcon: {
    transform: [{ rotate: '0deg' }],
  },
  dropdownIconActive: {
    transform: [{ rotate: '180deg' }],
  },
  dropdownMenu: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  dropdownItemText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  dropdownItemTextActive: {
    color: '#009dff',
    fontFamily: 'Inter-SemiBold',
  },
  chartContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  weightList: {
    flex: 1,
    marginBottom: 24,
  },
  weightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  weightInfo: {
    flex: 1,
  },
  weightValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  weightDate: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#009dff',
    padding: 16,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  deleteButtonText: {
    color: '#FF4444',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#009dff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  confirmModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  confirmTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 16,
    color: '#B0B0B0',
    fontFamily: 'Inter-Regular',
    marginBottom: 24,
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 16,
  },
  confirmButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#333333',
  },
  deleteConfirmButton: {
    backgroundColor: '#FF4444',
  },
  confirmButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  deleteConfirmButtonText: {
    color: '#FFFFFF',
  },
});