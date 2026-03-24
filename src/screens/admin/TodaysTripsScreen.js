import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { colors, spacing, borderRadius } from '../../config/theme';

export default function TodaysTripsScreen({ navigation }) {
  const { user } = useAuthStore();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchTrips();
    }, [])
  );

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/trips?assigned_to=${user.id}`);
      setTrips(response.data);
    } catch (error) {
      console.error('Failed to fetch trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTrips();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled':
        return colors.gold;
      case 'departed':
        return colors.teal;
      case 'arrived':
        return colors.success;
      default:
        return colors.gray;
    }
  };

  const renderTrip = ({ item }) => (
    <Card style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <View>
          <Text style={styles.tripTime}>
            {new Date(item.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={styles.tripRoute}>{item.route?.name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.tripDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="people" size={16} color={colors.teal} />
          <Text style={styles.detailText}>{item.current_capacity}/{item.capacity} passengers</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="bus" size={16} color={colors.teal} />
          <Text style={styles.detailText}>Bus #{item.bus_id}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          title="Manifest"
          onPress={() => navigation.navigate('PassengerManifest', { tripId: item.id, trip: item })}
          variant="outline"
          style={styles.actionButton}
        />
        <Button
          title="Scan QR"
          onPress={() => navigation.navigate('QRScanner', { tripId: item.id })}
          variant="outline"
          style={styles.actionButton}
        />
        {item.status === 'scheduled' && (
          <Button
            title="Start Trip"
            onPress={() => updateTripStatus(item.id, 'departed')}
            style={styles.actionButton}
          />
        )}
      </View>
    </Card>
  );

  const updateTripStatus = async (tripId, status) => {
    try {
      await api.patch(`/trips/${tripId}`, { status });
      fetchTrips();
    } catch (error) {
      console.error('Failed to update trip status:', error);
    }
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
      <FlatList
        data={trips}
        renderItem={renderTrip}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar" size={48} color={colors.gray} />
            <Text style={styles.emptyText}>No trips today</Text>
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
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  tripDetails: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
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
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
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
