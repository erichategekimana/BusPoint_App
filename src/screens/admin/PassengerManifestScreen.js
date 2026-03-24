import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import Card from '../../components/Card';
import { colors, spacing, borderRadius } from '../../config/theme';

export default function PassengerManifestScreen({ route }) {
  const { tripId } = route.params;
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchManifest();
  }, [tripId]);

  const fetchManifest = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/bookings/trip/${tripId}`);
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch manifest:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderPassenger = ({ item }) => (
    <Card style={styles.passengerCard}>
      <View style={styles.passengerHeader}>
        <View style={styles.passengerIcon}>
          <Ionicons name="person" size={24} color={colors.white} />
        </View>
        <View style={styles.passengerInfo}>
          <Text style={styles.passengerName}>{item.user?.full_name}</Text>
          <Text style={styles.passengerPhone}>{item.user?.phone_number}</Text>
        </View>
        <View style={styles.seatBadge}>
          <Text style={styles.seatNumber}>{item.seat_number}</Text>
        </View>
      </View>

      <View style={styles.passengerDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="location" size={16} color={colors.teal} />
          <Text style={styles.detailText}>Pickup: Stop {item.pickup_stop_id}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="flag" size={16} color={colors.teal} />
          <Text style={styles.detailText}>Dropoff: Stop {item.dropoff_stop_id}</Text>
        </View>
      </View>

      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
        <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
      </View>
    </Card>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return colors.success;
      case 'boarded':
        return colors.teal;
      case 'cancelled':
        return colors.error;
      default:
        return colors.gray;
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Passenger Manifest</Text>
        <Text style={styles.headerSubtitle}>{bookings.length} passengers</Text>
      </View>

      <FlatList
        data={bookings}
        renderItem={renderPassenger}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people" size={48} color={colors.gray} />
            <Text style={styles.emptyText}>No passengers</Text>
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
  header: {
    backgroundColor: colors.navy,
    padding: spacing.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.lightGray,
    marginTop: spacing.xs,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  passengerCard: {
    marginBottom: spacing.sm,
  },
  passengerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  passengerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.teal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.navy,
  },
  passengerPhone: {
    fontSize: 12,
    color: colors.gray,
    marginTop: spacing.xs,
  },
  seatBadge: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  seatNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.navy,
  },
  passengerDetails: {
    gap: spacing.sm,
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
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
  statusText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
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
