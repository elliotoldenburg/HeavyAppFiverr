import { View, Text, ImageBackground, StyleSheet, Pressable, Linking, Image } from 'react-native';
import { Link } from 'expo-router';

export default function Welcome() {
  const handleTermsPress = () => {
    Linking.openURL('https://heavygym.com/terms');
  };

  const handlePrivacyPress = () => {
    Linking.openURL('https://heavygym.com/privacy');
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1605296867424-35fc25c9212a?q=80&w=2940&auto=format&fit=crop' }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <View style={styles.content}>
            <Image 
              source={require('../../assets/images/heavygymlogga_optimized.webp')}
              style={styles.logo}
              resizeMode="contain"
            />
            
            <Text style={styles.description}>
              Din digitala träningspartner – skräddarsydd träning för dina mål.
            </Text>

            <View style={styles.buttonContainer}>
              <Link href="/register" asChild>
                <Pressable style={styles.createAccountButton}>
                  <Text style={styles.createAccountText}>SKAPA KONTO</Text>
                </Pressable>
              </Link>

              <Link href="/login" asChild>
                <Pressable style={styles.loginButton}>
                  <Text style={styles.loginText}>LOGGA IN</Text>
                </Pressable>
              </Link>
            </View>

            <View style={styles.termsContainer}>
              <Pressable onPress={handleTermsPress}>
                <Text style={styles.termsText}>Terms of service</Text>
              </Pressable>
              <Text style={styles.termsDivider}> | </Text>
              <Pressable onPress={handlePrivacyPress}>
                <Text style={styles.termsText}>Privacy policy</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 120,
    paddingBottom: 40,
  },
  logo: {
    width: 250,
    height: 80,
  },
  description: {
    fontFamily: 'Inter-Regular',
    fontSize: 18,
    color: '#B0B0B0',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 24,
    marginBottom: 40,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
    marginTop: 'auto',
    marginBottom: 32,
  },
  createAccountButton: {
    backgroundColor: '#0056A6',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  createAccountText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 1,
  },
  loginButton: {
    backgroundColor: 'transparent',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  loginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 1,
  },
  termsContainer: {
    flexDirection: 'row',
    marginTop: 32,
  },
  termsText: {
    color: '#B0B0B0',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  termsDivider: {
    color: '#B0B0B0',
    marginHorizontal: 8,
  },
});