import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import FoodSearchScreen from './FoodSearchScreen';
import MealDetailScreen from './MealDetailScreen';
import MealItemDetailScreen from './MealItemDetailScreen';
import { MealEntry } from '@/lib/hooks/useNutritionData';

type Props = {
  visible: boolean;
  onClose: () => void;
  onMealAdded: () => void;
  mealName?: string;
};

type ModalView = 'search' | 'detail' | 'item-detail';

export default function NutritionModal({ visible, onClose, onMealAdded, mealName = 'Måltid' }: Props) {
  const [currentView, setCurrentView] = useState<ModalView>('search');
  const [selectedItem, setSelectedItem] = useState<MealEntry | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  
  // Reset view state when modal visibility changes
  useEffect(() => {
    if (!visible) {
      // Only reset after modal is fully closed
      const timer = setTimeout(() => {
        setCurrentView('search');
        setSelectedItem(null);
        setIsClosing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);
  
  const handleClose = () => {
    // Set closing state to prevent multiple actions
    if (isClosing) return;
    setIsClosing(true);
    
    // Close the modal first
    onClose();
    
    // State will be reset by the useEffect when visible becomes false
  };
  
  const handleViewItemDetail = (item: MealEntry) => {
    if (isClosing) return;
    setSelectedItem(item);
    setCurrentView('item-detail');
  };
  
  const handleMealAdded = () => {
    // Notify parent component
    if (onMealAdded) {
      onMealAdded();
    }
    
    // Don't immediately close on mobile to prevent freezing
    if (Platform.OS === 'web') {
      handleClose();
    }
  };
  
  const renderContent = () => {
    switch (currentView) {
      case 'detail':
        return (
          <MealDetailScreen 
            onClose={handleClose} 
            mealName={mealName}
            onMealUpdated={handleMealAdded}
            onBackToSearch={() => setCurrentView('search')}
            onViewItemDetail={handleViewItemDetail}
          />
        );
      case 'item-detail':
        return selectedItem ? (
          <MealItemDetailScreen 
            onClose={handleClose}
            onBackToSearch={() => setCurrentView('search')}
            item={selectedItem}
            mealName={mealName}
            onItemUpdated={handleMealAdded}
          />
        ) : (
          <FoodSearchScreen 
            onClose={handleClose} 
            mealName={mealName}
            onMealAdded={handleMealAdded}
            onViewMealDetails={() => setCurrentView('detail')}
            onViewItemDetail={handleViewItemDetail}
          />
        );
      case 'search':
      default:
        return (
          <FoodSearchScreen 
            onClose={handleClose} 
            mealName={mealName}
            onMealAdded={handleMealAdded}
            onViewMealDetails={() => setCurrentView('detail')}
            onViewItemDetail={handleViewItemDetail}
          />
        );
    }
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {renderContent()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  menuContainer: {
    flex: 1,
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  optionsContainer: {
    gap: 16,
  },
  optionButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  optionButtonText: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});