import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X, TrendingUp, TrendingDown, Target, Dumbbell } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { TrainingCycle } from '@/types/database.types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirmEnd: () => void;
  cycle: TrainingCycle;
  loading: boolean;
  cycleProgress: {
    exercise: string;
    startWeight: number;
    endWeight: number;
    percentageChange: number;
  }[];
};

export default function CycleSummaryModal({
  visible,
  onClose,
  onConfirmEnd,
  cycle,
  loading,
  cycleProgress,
}: Props) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={['rgba(0,157,255,0.1)', 'rgba(0,0,0,0)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.3 }}
          />

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Avsluta träningscykel</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.cycleInfo}>
              <View style={styles.goalContainer}>
                <Target size={24} color="#009dff" />
                <Text style={styles.goalText}>{cycle.goal}</Text>
              </View>

              <View style={styles.dateContainer}>
                <Text style={styles.dateText}>
                  {formatDate(cycle.start_date)} - {formatDate(new Date().toISOString())}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Träningsutveckling</Text>

            {cycleProgress.map((progress, index) => (
              <View key={index} style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Dumbbell size={20} color="#FFFFFF" />
                  <Text style={styles.exerciseName}>{progress.exercise}</Text>
                </View>

                <View style={styles.progressDetails}>
                  <View style={styles.weightInfo}>
                    <Text style={styles.weightLabel}>Start</Text>
                    <Text style={styles.weightValue}>{progress.startWeight} kg</Text>
                  </View>

                  <View style={styles.arrow}>
                    {progress.percentageChange > 0 ? (
                      <TrendingUp size={24} color="#22C55E" />
                    ) : (
                      <TrendingDown size={24} color="#EF4444" />
                    )}
                  </View>

                  <View style={styles.weightInfo}>
                    <Text style={styles.weightLabel}>Slut</Text>
                    <Text style={styles.weightValue}>{progress.endWeight} kg</Text>
                  </View>

                  <View style={[
                    styles.percentageContainer,
                    progress.percentageChange > 0 ? styles.positiveChange : styles.negativeChange
                  ]}>
                    <Text style={[
                      styles.percentageText,
                      progress.percentageChange > 0 ? styles.positiveText : styles.negativeText
                    ]}>
                      {progress.percentageChange > 0 ? '+' : ''}{progress.percentageChange}%
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            <View style={styles.warningContainer}>
              <Text style={styles.warningTitle}>Viktigt att notera</Text>
              <Text style={styles.warningText}>
                När du avslutar en träningscykel markeras den som inaktiv och kan inte återaktiveras.
                All träningsdata sparas och du kan fortfarande se historiken, men för att fortsätta
                logga träning behöver du starta en ny cykel med nya mål.
              </Text>
            </View>

            <View style={styles.actionButtons}>
              <Pressable
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Avbryt</Text>
              </Pressable>

              <Pressable
                style={[styles.button, styles.endButton]}
                onPress={onConfirmEnd}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.endButtonText}>Avsluta cykel</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalBody: {
    padding: 24,
  },
  cycleInfo: {
    marginBottom: 32,
  },
  goalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    backgroundColor: '#262626',
    padding: 16,
    borderRadius: 12,
  },
  goalText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  dateContainer: {
    backgroundColor: '#262626',
    padding: 16,
    borderRadius: 12,
  },
  dateText: {
    color: '#808080',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  progressCard: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  progressDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weightInfo: {
    alignItems: 'center',
  },
  weightLabel: {
    color: '#808080',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginBottom: 4,
  },
  weightValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  arrow: {
    marginHorizontal: 8,
  },
  percentageContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  positiveChange: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  negativeChange: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  percentageText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  positiveText: {
    color: '#22C55E',
  },
  negativeText: {
    color: '#EF4444',
  },
  warningContainer: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  warningTitle: {
    color: '#EF4444',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  warningText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: Platform.OS === 'ios' ? 48 : 24,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#333333',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  endButton: {
    backgroundColor: '#EF4444',
  },
  endButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});