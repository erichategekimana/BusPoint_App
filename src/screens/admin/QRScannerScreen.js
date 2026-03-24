import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import Card from '../../components/Card';
import { colors, spacing, borderRadius } from '../../config/theme';

export default function QRScannerScreen({ route, navigation }) {
  const { tripId } = route.params;
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [lastScannedTicket, setLastScannedTicket] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }) => {
    setScanned(true);
    setLastScannedTicket(data);

    try {
      const response = await api.post('/bookings/verify-ticket', {
        ticket_token: data,
        trip_id: tripId,
      });

      if (response.data.success) {
        Alert.alert(
          'Success',
          `${response.data.passenger_name} boarded successfully`,
          [{ text: 'OK', onPress: () => setScanned(false) }]
        );
      } else {
        Alert.alert('Error', response.data.message || 'Invalid ticket');
        setScanned(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify ticket');
      setScanned(false);
    }
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <Card style={styles.card}>
          <Ionicons name="camera-off" size={48} color={colors.error} />
          <Text style={styles.errorTitle}>Camera Permission Denied</Text>
          <Text style={styles.errorText}>
            Please enable camera access in settings to scan QR codes
          </Text>
        </Card>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.overlay}>
        <View style={styles.scannerFrame} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Ticket QR Code</Text>
        <View style={{ width: 28 }} />
      </View>

      {lastScannedTicket && (
        <View style={styles.lastScannedContainer}>
          <Card style={styles.lastScannedCard}>
            <Text style={styles.lastScannedLabel}>Last Scanned:</Text>
            <Text style={styles.lastScannedValue}>{lastScannedTicket}</Text>
          </Card>
        </View>
      )}

      {scanned && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.rescanButton}
            onPress={() => setScanned(false)}
          >
            <Ionicons name="refresh" size={24} color={colors.white} />
            <Text style={styles.rescanText}>Tap to Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  permissionText: {
    color: colors.white,
    fontSize: 16,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  card: {
    margin: spacing.lg,
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.error,
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: 14,
    color: colors.darkGray,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: colors.teal,
    borderRadius: borderRadius.lg,
    backgroundColor: 'transparent',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(13, 27, 42, 0.9)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
  },
  lastScannedContainer: {
    position: 'absolute',
    bottom: 100,
    left: spacing.md,
    right: spacing.md,
  },
  lastScannedCard: {
    padding: spacing.md,
  },
  lastScannedLabel: {
    fontSize: 12,
    color: colors.gray,
    marginBottom: spacing.xs,
  },
  lastScannedValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.navy,
    fontFamily: 'monospace',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: 'rgba(13, 27, 42, 0.9)',
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.teal,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  rescanText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
