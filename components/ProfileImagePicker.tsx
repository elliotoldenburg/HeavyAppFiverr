import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CircleUser } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

type Props = {
  currentImageUrl: string | null;
  onImageUpdate: (url: string | null) => void;
};

const CACHE_TIME = 31536000; // 1 år i sekunder

export default function ProfileImagePicker({ currentImageUrl, onImageUpdate }: Props) {
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(currentImageUrl);

  // Använd useCallback för att memoizera fetchProfileImage
  const fetchProfileImage = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('training_profiles')
        .select('profile_image_url')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      if (data?.profile_image_url) {
        // Lägg till cache-control parameter i URL:en
        const url = new URL(data.profile_image_url);
        url.searchParams.set('cache-control', `public, max-age=${CACHE_TIME}`);
        const cachedUrl = url.toString();
        
        setImageUrl(cachedUrl);
        onImageUpdate(cachedUrl);
      }
    } catch (error) {
      console.error('Error fetching profile image:', error);
    }
  }, [onImageUpdate]);

  // Kör fetchProfileImage direkt när komponenten mountas
  useEffect(() => {
    fetchProfileImage();
  }, [fetchProfileImage]);

  const requestPermissions = async (useCamera: boolean) => {
    if (Platform.OS === 'web') return true;

    try {
      let permissionResult;
      
      if (useCamera) {
        permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }

      if (!permissionResult.granted) {
        Alert.alert(
          'Behörigheter krävs',
          'För att kunna välja eller ta en profilbild behöver du ge tillgång till ' + 
          (useCamera ? 'kamera' : 'bildbibliotek') + ' i inställningarna.',
          [
            { text: 'Avbryt', style: 'cancel' },
            { 
              text: 'Öppna Inställningar', 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  };

  const pickImage = async (useCamera: boolean = false) => {
    try {
      const hasPermission = await requestPermissions(useCamera);
      if (!hasPermission) return;

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.2,
      };

      let result;
      if (useCamera) {
        result = await ImagePicker.launchCameraAsync(pickerOptions);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      }

      if (!result.canceled && result.assets?.[0]?.uri) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Fel', 'Ett fel uppstod när bilden skulle väljas. Försök igen.');
    }
  };

  const deleteOldImage = async (userId: string) => {
    try {
      const { data: files, error: listError } = await supabase.storage
        .from('profile-images')
        .list(userId);

      if (listError) throw listError;

      if (files && files.length > 0) {
        console.log('Found existing files:', files.map(f => f.name));
        
        const filesToRemove = files.map(file => `${userId}/${file.name}`);
        const { error: deleteError } = await supabase.storage
          .from('profile-images')
          .remove(filesToRemove);

        if (deleteError) throw deleteError;
        console.log('Successfully removed old files:', filesToRemove);
      }
    } catch (error) {
      console.error('Error deleting old images:', error);
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Fel', 'Du måste vara inloggad för att ladda upp en bild');
        return;
      }

      setUploading(true);

      await deleteOldImage(user.id);

      const fileExt = '.jpg';
      const fileName = `${Date.now()}${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      console.log('Uploading new image:', filePath);

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, {
          uri: uri,
          type: 'image/jpeg',
          name: fileName
        }, {
          cacheControl: `${CACHE_TIME}`,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Kunde inte hämta bildlänken');
      }

      // Lägg till cache-control i URL:en
      const url = new URL(urlData.publicUrl);
      url.searchParams.set('cache-control', `public, max-age=${CACHE_TIME}`);
      const newImageUrl = url.toString();
      
      console.log('Image uploaded successfully. URL:', newImageUrl);

      const { error: updateError } = await supabase
        .from('training_profiles')
        .update({ profile_image_url: newImageUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      console.log('Profile updated with new image URL');
      setImageUrl(newImageUrl);
      onImageUpdate(newImageUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Fel', 'Kunde inte ladda upp bilden. Försök igen.');
    } finally {
      setUploading(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Välj profilbild',
      'Hur vill du välja din profilbild?',
      [
        {
          text: 'Ta en ny bild',
          onPress: () => pickImage(true),
        },
        {
          text: 'Välj från galleri',
          onPress: () => pickImage(false),
        },
        {
          text: 'Avbryt',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Pressable 
        style={styles.imageContainer}
        onPress={showImageOptions}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator size="large" color="#009dff" />
        ) : imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory"
            priority="high"
          />
        ) : (
          <>
            <CircleUser size={48} color="#808080" />
            <View style={styles.cameraButton}>
              <Camera size={20} color="#FFFFFF" />
            </View>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#009dff',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#009dff',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000000',
  },
});