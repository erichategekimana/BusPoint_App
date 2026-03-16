import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import Card from '../../components/Card';
import { colors, spacing, borderRadius } from '../../config/theme';

export default function TripListScreen({ route, navigation }) {
  const { routeId, routeName } = route.params;
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTrips();
  }, [routeId]);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/trips?route_id=${routeId}&status=scheduled`);
      setTrips(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load trips');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderTrip = ({ item }) => {
    const availableSeats = item.capacity - item.current_capacity;
    const departureTime = new Date(item.departure_time).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('SeatSelection', { tripId: item.id, trip: item })}
      >
        <Card style={styles.tripCard}>
          <View style={styles.tripHeader}>
            <View>
              <Text style={styles.tripTime}>{departureTime}</Text>
              <Text style={styles.tripRoute}>{routeName}</Text>
            </View>
            <View style={styles.seatsInfo}>
              <Text style={styles.seatsAvailable}>{availableSeats}</Text>
              <Text style={styles.seatsLabel}>seats left</Text>
            </View>
          </View>

          <View style={styles.tripDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="bus" size={16} color={colors.teal} />
              <Text style={styles.detailText}>{item.bus_id}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="people" size={16} color={colors.teal} />
              <Text style={styles.detailText}>{item.current_capacity}/{item.capacity}</Text>
            </View>
          </View>

          {availableSeats === 0 && (
            <View style={styles.fullBadge}>
              <Text style={styles.fullText}>FULL</Text>
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.teal} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={trips}
        renderItem={renderTrip}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar" size={48} color={colors.gray} />
            <Text style={styles.emptyText}>No trips available</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightGray,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  tripCard: {
    marginBottom: spacing.sm,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tripTime: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.navy,
  },
  tripRoute: {
    fontSize: 14,
    color: colors.gray,
    marginTop: spacing.xs,
  },
  seatsInfo: {
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  seatsAvailable: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.teal,
  },
  seatsLabel: {
    fontSize: 12,
    color: colors.gray,
  },
  tripDetails: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    fontSize: 14,
    color: colors.darkGray,
  },
  fullBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.error,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  fullText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: colors.error,
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: borderRadius.md,
  },
  errorText: {
    color: colors.white,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    color: colors.gray,
    marginTop: spacing.md,
  },
});
