import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { colors, spacing } from '../config/theme';
import useNetworkStore from '../store/networkStore';

export default function OfflineBanner() {
  const { isConnected, initialize } = useNetworkStore();

  useEffect(() => {
    initialize();
  }, []);

  if (isConnected) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.error,
    padding: spacing.sm,
    alignItems: 'center',
  },
  text: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
