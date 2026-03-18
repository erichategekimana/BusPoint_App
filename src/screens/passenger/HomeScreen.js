import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { subscribeToBusLocations, unsubscribeFromBusLocations } from '../../services/socket';
import OfflineBanner from '../../components/OfflineBanner';
import { colors, spacing, borderRadius } from '../../config/theme';
import Constants from 'expo-constants';

const MAP_STYLE_URL = Constants.expoConfig?.extra?.MAP_STYLE_URL
  || process.env.MAP_STYLE_URL
  || 'https://tiles.stadiamaps.com/styles/alidade_smooth.json';
const STADIA_API_KEY = Constants.expoConfig?.extra?.STADIA_API_KEY
  || process.env.STADIA_API_KEY
  || '';

const buildStadiaStyleUrl = () => {
  if (!STADIA_API_KEY || MAP_STYLE_URL.includes('api_key=')) {
    return MAP_STYLE_URL;
  }
  const separator = MAP_STYLE_URL.includes('?') ? '&' : '?';
  return `${MAP_STYLE_URL}${separator}api_key=${encodeURIComponent(STADIA_API_KEY)}`;
};

export default function HomeScreen({ navigation }) {
  const [busLocations, setBusLocations] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);

  useEffect(() => {
    subscribeToBusLocations((data) => {
      setBusLocations((prev) => {
        const index = prev.findIndex(b => b.bus_id === data.bus_id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = data;
          return updated;
        }
        return [...prev, data];
      });
    });

    return () => {
      unsubscribeFromBusLocations();
    };
  }, []);

  const renderBusMarkers = () => {
    return busLocations.map((bus) => (
      <MapLibreGL.PointAnnotation
        key={bus.bus_id}
        id={`bus-${bus.bus_id}`}
        coordinate={[bus.longitude, bus.latitude]}
        onSelected={() => setSelectedBus(bus)}
      >
        <View style={styles.busMarker}>
          <Ionicons name="bus" size={24} color={colors.white} />
        </View>
      </MapLibreGL.PointAnnotation>
    ));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <OfflineBanner />
      
      <View style={styles.header}>
        <Text style={styles.title}>Bus Point</Text>
        <Text style={styles.subtitle}>Live Bus Tracking</Text>
      </View>

      <View style={styles.mapContainer}>
        <MapLibreGL.MapView
          style={styles.map}
          styleURL={buildStadiaStyleUrl()}
          zoomEnabled={true}
          scrollEnabled={true}
        >
          <MapLibreGL.Camera
            zoomLevel={12}
            centerCoordinate={[30.0619, -1.9403]}
            animationMode="flyTo"
            animationDuration={2000}
          />
          {renderBusMarkers()}
        </MapLibreGL.MapView>
      </View>

      {selectedBus && (
        <View style={styles.busInfo}>
          <Text style={styles.busInfoTitle}>Bus #{selectedBus.bus_id}</Text>
          <Text style={styles.busInfoText}>Speed: {selectedBus.speed?.toFixed(1) || 0} km/h</Text>
          <Text style={styles.busInfoText}>Last updated: {new Date(selectedBus.last_updated).toLocaleTimeString()}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.searchButton}
        onPress={() => navigation.navigate('RouteSearch')}
      >
        <Ionicons name="search" size={24} color={colors.white} />
        <Text style={styles.searchButtonText}>Search Routes & Book Tickets</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.navy,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
  },
  subtitle: {
    fontSize: 16,
    color: colors.lightGray,
    marginTop: spacing.xs,
  },
  mapContainer: {
    flex: 1,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  busMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.teal,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  busInfo: {
    position: 'absolute',
    top: 120,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  busInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.navy,
    marginBottom: spacing.xs,
  },
  busInfoText: {
    fontSize: 14,
    color: colors.darkGray,
    marginTop: spacing.xs,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.teal,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  searchButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
