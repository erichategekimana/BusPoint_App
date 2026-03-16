import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import Card from '../../components/Card';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { colors, spacing, borderRadius } from '../../config/theme';

export default function BookingConfirmationScreen({ route, navigation }) {
  const { tripId, trip, selectedSeats } = route.params;
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleConfirmBooking = async () => {
    try {
      setLoading(true);
      
      const bookingData = {
        user_id: user.id,
        trip_id: tripId,
        seat_numbers: selectedSeats,
        pickup_stop_id: 1,
        dropoff_stop_id: 2,
      };

      const response = await api.post('/bookings', bookingData);
      
      navigation.navigate('Payment', {
        booking: response.data,
        amount: selectedSeats.length * 5000,
      });
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const totalPrice = selectedSeats.length * 5000;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text style={styles.title}>Booking Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Passenger Name:</Text>
            <Text style={styles.value}>{user?.full_name}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Phone Number:</Text>
            <Text style={styles.value}>{user?.phone_number}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Departure Time:</Text>
            <Text style={styles.value}>
              {new Date(trip.departure_time).toLocaleString()}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Seats:</Text>
            <Text style={styles.value}>{selectedSeats.join(', ')}</Text>
          </View>

          <View style={[styles.detailRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalValue}>RWF {totalPrice.toLocaleString()}</Text>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.subtitle}>Payment Method</Text>
          <Text style={styles.paymentInfo}>MTN MoMo</Text>
          <Text style={styles.paymentNote}>
            You will be redirected to complete payment via MTN MoMo
          </Text>
        </Card>

        <Button
          title="Proceed to Payment"
          onPress={handleConfirmBooking}
          loading={loading}
          style={styles.button}
        />

        <Button
          title="Cancel"
          onPress={() => navigation.goBack()}
          variant="outline"
          style={styles.button}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightGray,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.navy,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.navy,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  label: {
    fontSize: 14,
    color: colors.gray,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.navy,
  },
  totalRow: {
    borderBottomWidth: 0,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.teal,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.navy,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.teal,
  },
  paymentInfo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.teal,
    marginBottom: spacing.sm,
  },
  paymentNote: {
    fontSize: 14,
    color: colors.gray,
    lineHeight: 20,
  },
  button: {
    marginBottom: spacing.md,
  },
});
