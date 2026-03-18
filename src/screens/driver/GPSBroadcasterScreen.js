import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { emitBusLocation } from '../../services/socket';
import api from '../../services/api';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { colors, spacing, borderRadius } from '../../config/theme';

export default function GPSBroadcasterScreen({ route }) {
  const { tripId } = route.params;
  const [isTracking, setIsTracking] = useState(false);
  const [location, setLocation] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [error, setError] = useState(null);
  const locationSubscription = useRef(null);

  useEffect(() => {
    requestLocationPermission();
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
      }
    } catch (err) {
      setError('Failed to request location permission');
    }
  };

  const startTracking = async () => {
    try {
      setIsTracking(true);
      setError(null);

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 30000,
          distanceInterval: 10,
        },
        (newLocation) => {
          const { latitude, longitude, speed: locSpeed, heading: locHeading } = newLocation.coords;
          
          setLocation({ latitude, longitude });
          setSpeed(locSpeed || 0);
          setHeading(locHeading || 0);

          emitBusLocation({
            trip_id: tripId,
            latitude,
            longitude,
            speed: locSpeed || 0,
            heading: locHeading || 0,
            timestamp: new Date().toISOString(),
          });

          api.post('/bus-locations', {
            trip_id: tripId,
            latitude,
            longitude,
            speed: locSpeed || 0,
            heading: locHeading || 0,
          }).catch(err => console.error('Failed to update location:', err));
        }
      );
    } catch (err) {
      setError('Failed to start tracking');
      setIsTracking(false);
    }
  };

  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setIsTracking(false);
  };

  const toggleTracking = () => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GPS Tracking</Text>
        <Text style={styles.headerSubtitle}>Real-time bus location broadcast</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Card style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Tracking Status:</Text>
          <View style={[styles.statusBadge, { backgroundColor: isTracking ? colors.success : colors.error }]}>
            <Text style={styles.statusValue}>{isTracking ? 'ACTIVE' : 'INACTIVE'}</Text>
          </View>
        </View>
      </Card>

      {location && (
        <Card style={styles.locationCard}>
          <Text style={styles.cardTitle}>Current Location</Text>
          
          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>Latitude:</Text>
            <Text style={styles.locationValue}>{location.latitude.toFixed(6)}</Text>
          </View>

          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>Longitude:</Text>
            <Text style={styles.locationValue}>{location.longitude.toFixed(6)}</Text>
          </View>

          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>Speed:</Text>
            <Text style={styles.locationValue}>{(speed * 3.6).toFixed(1)} km/h</Text>
          </View>

          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>Heading:</Text>
            <Text style={styles.locationValue}>{heading.toFixed(0)}°</Text>
          </View>

          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>Last Updated:</Text>
            <Text style={styles.locationValue}>{new Date().toLocaleTimeString()}</Text>
          </View>
        </Card>
      )}

      <Button
        title={isTracking ? 'Stop Tracking' : 'Start Tracking'}
        onPress={toggleTracking}
        variant={isTracking ? 'secondary' : 'primary'}
        style={styles.button}
      />

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color={colors.teal} />
        <Text style={styles.infoText}>
          Location updates are sent every 30 seconds to keep passengers informed of your real-time position.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightGray,
    padding: spacing.md,
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.navy,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.gray,
    marginTop: spacing.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    color: colors.white,
    fontSize: 14,
    flex: 1,
  },
  statusCard: {
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.navy,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  statusValue: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  locationCard: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.navy,
    marginBottom: spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  locationLabel: {
    fontSize: 14,
    color: colors.gray,
  },
  locationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.navy,
    fontFamily: 'monospace',
  },
  button: {
    marginBottom: spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.darkGray,
    lineHeight: 20,
  },
});
