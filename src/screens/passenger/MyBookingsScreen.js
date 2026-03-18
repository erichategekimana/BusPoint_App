import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import Card from '../../components/Card';
import { colors, spacing, borderRadius } from '../../config/theme';

export default function MyBookingsScreen() {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedBooking, setExpandedBooking] = useState(null);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [])
  );

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/bookings?user_id=${user.id}`);
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return colors.success;
      case 'cancelled':
        return colors.error;
      case 'completed':
        return colors.teal;
      default:
        return colors.gray;
    }
  };

  const renderBooking = ({ item }) => (
    <TouchableOpacity
      onPress={() => setExpandedBooking(expandedBooking === item.id ? null : item.id)}
    >
      <Card style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.bookingInfo}>
            <Text style={styles.bookingId}>Booking #{item.id}</Text>
            <Text style={styles.bookingDate}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.bookingDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="ticket" size={16} color={colors.teal} />
            <Text style={styles.detailText}>Seat {item.seat_number}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="time" size={16} color={colors.teal} />
            <Text style={styles.detailText}>
              {new Date(item.trip?.departure_time).toLocaleTimeString()}
            </Text>
          </View>
        </View>

        {expandedBooking === item.id && (
          <View style={styles.expandedContent}>
            <View style={styles.qrContainer}>
              <QRCode
                value={item.ticket_token}
                size={150}
                color={colors.navy}
                backgroundColor={colors.white}
              />
              <Text style={styles.qrLabel}>Scan at boarding</Text>
            </View>

            <View style={styles.ticketInfo}>
              <Text style={styles.ticketToken}>{item.ticket_token}</Text>
            </View>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );

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
        data={bookings}
        renderItem={renderBooking}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="ticket-outline" size={48} color={colors.gray} />
            <Text style={styles.emptyText}>No bookings yet</Text>
            <Text style={styles.emptySubtext}>Book a trip to get started</Text>
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
  bookingCard: {
    marginBottom: spacing.sm,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.navy,
  },
  bookingDate: {
    fontSize: 12,
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
  bookingDetails: {
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
  expandedContent: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    alignItems: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  qrLabel: {
    fontSize: 12,
    color: colors.gray,
    marginTop: spacing.sm,
  },
  ticketInfo: {
    backgroundColor: colors.lightGray,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    width: '100%',
  },
  ticketToken: {
    fontSize: 12,
    color: colors.darkGray,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl * 2,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.navy,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.gray,
    marginTop: spacing.sm,
  },
});
