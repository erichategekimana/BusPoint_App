import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import { colors, spacing, typography } from '../../config/theme';

export default function OnboardingScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Bus Point</Text>
          <Text style={styles.subtitle}>Rwanda's Smart Bus Booking System</Text>
        </View>

        <View style={styles.features}>
          <Text style={styles.feature}>🚌 Real-time bus tracking</Text>
          <Text style={styles.feature}>🎫 Easy seat booking</Text>
          <Text style={styles.feature}>💳 Secure MTN MoMo payments</Text>
          <Text style={styles.feature}>📱 Digital tickets with QR codes</Text>
        </View>

        <View style={styles.actions}>
          <Button
            title="Get Started"
            onPress={() => navigation.navigate('Register')}
            style={styles.button}
          />
          <Button
            title="I Have an Account"
            onPress={() => navigation.navigate('Login')}
            variant="outline"
            style={styles.button}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xl * 2,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 18,
    color: colors.lightGray,
    textAlign: 'center',
  },
  features: {
    gap: spacing.md,
  },
  feature: {
    fontSize: 18,
    color: colors.white,
    paddingVertical: spacing.sm,
  },
  actions: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  button: {
    width: '100%',
  },
});
