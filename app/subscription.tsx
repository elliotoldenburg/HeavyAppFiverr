import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Check, Shield, Zap, Clock, X } from 'lucide-react-native';
import { createCheckoutSession, cancelSubscription } from '@/lib/stripe';
import { PRODUCTS } from '@/lib/stripe-config';
import { useSubscription, isActiveSubscription } from '@/lib/hooks/useSubscription';
import { queryClient } from '@/lib/queryClient';

export default function SubscriptionScreen() {
  const [loading, setLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { data: subscription, isLoading: isLoadingSubscription } = useSubscription();
  
  const isSubscribed = isActiveSubscription(subscription?.subscription_status);
  const isCancelAtPeriodEnd = subscription?.cancel_at_period_end;

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      
      // Get the subscription product
      const product = PRODUCTS.find(p => p.mode === 'subscription');
      if (!product) {
        throw new Error('Subscription product not found');
      }
      
      // Create a checkout session
      const { url } = await createCheckoutSession(product.priceId, 'subscription');
      
      // Redirect to the checkout page
      if (Platform.OS === 'web') {
        window.location.href = url;
      }
      // Note: For mobile, the URL opening is handled in the createCheckoutSession function
      
    } catch (error) {
      console.error('Error creating checkout session:', error);
      Alert.alert('Fel', 'Kunde inte starta betalningsprocessen. Försök igen senare.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelling(true);
      await cancelSubscription();
      
      // Invalidate the subscription query to force a refetch
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      
      setShowCancelModal(false);
      
      Alert.alert(
        'Prenumeration avslutad',
        'Din prenumeration har avslutats och kommer att upphöra vid slutet av nuvarande betalningsperiod.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error canceling subscription:', error);
      Alert.alert('Fel', 'Kunde inte avsluta prenumerationen. Försök igen senare.');
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Okänt datum';
    return new Date(timestamp * 1000).toLocaleDateString('sv-SE');
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
        <Text style={styles.title}>Premium</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.premiumCard}>
          <LinearGradient
            colors={['#0056A6', '#009dff']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text style={styles.premiumTitle}>Heavy Gym Premium</Text>
          <Text style={styles.premiumPrice}>200 kr / månad</Text>
          <Text style={styles.premiumDescription}>
            Få tillgång till alla funktioner och träningsprogram
          </Text>
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Vad ingår i Premium?</Text>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Zap size={24} color="#009dff" />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Obegränsad tillgång</Text>
              <Text style={styles.featureDescription}>
                Få tillgång till alla träningsprogram och funktioner utan begränsningar
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Shield size={24} color="#009dff" />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Personlig träningsplan</Text>
              <Text style={styles.featureDescription}>
                Skräddarsydda träningsprogram baserade på dina mål och förutsättningar
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Clock size={24} color="#009dff" />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Avancerad statistik</Text>
              <Text style={styles.featureDescription}>
                Detaljerad statistik och analys av din träning för att maximera dina resultat
              </Text>
            </View>
          </View>
        </View>

        {isLoadingSubscription ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#009dff" />
            <Text style={styles.loadingText}>Kontrollerar prenumeration...</Text>
          </View>
        ) : isSubscribed ? (
          <View style={styles.subscribedContainer}>
            <View style={styles.subscribedIconContainer}>
              <Check size={24} color="#22C55E" />
            </View>
            <Text style={styles.subscribedText}>
              {isCancelAtPeriodEnd 
                ? 'Din prenumeration avslutas vid periodens slut' 
                : 'Du har en aktiv prenumeration'}
            </Text>
            <Text style={styles.subscribedDetails}>
              {isCancelAtPeriodEnd 
                ? `Tillgänglig till: ${formatDate(subscription?.current_period_end)}`
                : `Nästa betalning: ${formatDate(subscription?.current_period_end)}`}
            </Text>
            
            {!isCancelAtPeriodEnd && (
              <Pressable 
                style={styles.cancelButton}
                onPress={() => setShowCancelModal(true)}
              >
                <Text style={styles.cancelButtonText}>Avsluta prenumeration</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Pressable
            style={[styles.subscribeButton, loading && styles.subscribeButtonDisabled]}
            onPress={handleSubscribe}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.subscribeButtonText}>PRENUMERERA NU</Text>
            )}
          </Pressable>
        )}

        <Text style={styles.termsText}>
          Genom att prenumerera godkänner du våra villkor och sekretesspolicy. 
          Prenumerationen förnyas automatiskt varje månad tills du säger upp den.
        </Text>
      </ScrollView>

      {/* Cancel Subscription Modal */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Avsluta prenumeration</Text>
              <Pressable 
                style={styles.modalCloseButton}
                onPress={() => setShowCancelModal(false)}
              >
                <X size={24} color="#FFFFFF" />
              </Pressable>
            </View>
            
            <Text style={styles.modalText}>
              Är du säker på att du vill avsluta din prenumeration? Du kommer att ha tillgång till Premium-funktioner fram till slutet av din nuvarande betalningsperiod ({formatDate(subscription?.current_period_end)}).
            </Text>
            
            <View style={styles.modalButtons}>
              <Pressable 
                style={styles.modalCancelButton}
                onPress={() => setShowCancelModal(false)}
                disabled={cancelling}
              >
                <Text style={styles.modalCancelButtonText}>Avbryt</Text>
              </Pressable>
              
              <Pressable 
                style={[styles.modalConfirmButton, cancelling && styles.modalButtonDisabled]}
                onPress={handleCancelSubscription}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>Avsluta</Text>
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
  },
  scrollContent: {
    padding: 24,
  },
  premiumCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    overflow: 'hidden',
  },
  premiumTitle: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  premiumPrice: {
    fontSize: 32,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 16,
  },
  premiumDescription: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    opacity: 0.9,
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,157,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: '#B0B0B0',
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  subscribeButton: {
    backgroundColor: '#009dff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  subscribeButtonDisabled: {
    opacity: 0.7,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  termsText: {
    fontSize: 12,
    color: '#808080',
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginTop: 8,
  },
  subscribedContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  subscribedIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  subscribedText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subscribedDetails: {
    fontSize: 14,
    color: '#B0B0B0',
    fontFamily: 'Inter-Regular',
    marginBottom: 16,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  cancelButtonText: {
    color: '#FF4444',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    marginBottom: 24,
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#333333',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#FF4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  modalButtonDisabled: {
    opacity: 0.7,
  },
});