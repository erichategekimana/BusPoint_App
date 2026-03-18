import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { colors, spacing, borderRadius } from '../../config/theme';

export default function SeatSelectionScreen({ route, navigation }) {
  const { tripId, trip } = route.params;
  const [selectedSeats, setSelectedSeats] = useState([]);

  const capacity = trip.capacity;
  const bookedSeats = trip.current_capacity;
  const seatsPerRow = 4;
  const totalRows = Math.ceil(capacity / seatsPerRow);

  const toggleSeat = (seatNumber) => {
    if (selectedSeats.includes(seatNumber)) {
      setSelectedSeats(selectedSeats.filter(s => s !== seatNumber));
    } else {
      setSelectedSeats([...selectedSeats, seatNumber]);
    }
  };

  const isSeatBooked = (seatNumber) => seatNumber <= bookedSeats;

  const handleContinue = () => {
    if (selectedSeats.length === 0) {
      Alert.alert('Select Seat', 'Please select at least one seat');
      return;
    }
    navigation.navigate('BookingConfirmation', {
      tripId,
      trip,
      selectedSeats,
    });
  };

  const renderSeats = () => {
    const seats = [];
    for (let i = 1; i <= capacity; i++) {
      const isBooked = isSeatBooked(i);
      const isSelected = selectedSeats.includes(i);

      seats.push(
        <TouchableOpacity
          key={i}
          disabled={isBooked}
          onPress={() => toggleSeat(i)}
          style={[
            styles.seat,
            isBooked && styles.seatBooked,
            isSelected && styles.seatSelected,
          ]}
        >
          <Text style={[
            styles.seatNumber,
            isBooked && styles.seatNumberBooked,
            isSelected && styles.seatNumberSelected,
          ]}>
            {i}
          </Text>
        </TouchableOpacity>
      );
    }
    return seats;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.legendCard}>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSeat, { backgroundColor: colors.lightGray }]} />
              <Text style={styles.legendText}>Available</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSeat, { backgroundColor: colors.error }]} />
              <Text style={styles.legendText}>Booked</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSeat, { backgroundColor: colors.teal }]} />
              <Text style={styles.legendText}>Selected</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.seatsCard}>
          <Text style={styles.seatGridTitle}>Select Your Seat(s)</Text>
          <View style={styles.seatGrid}>
            {renderSeats()}
          </View>
        </Card>

        <Card style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Booking Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Selected Seats:</Text>
            <Text style={styles.summaryValue}>
              {selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Departure:</Text>
            <Text style={styles.summaryValue}>
              {new Date(trip.departure_time).toLocaleTimeString()}
            </Text>
          </View>
        </Card>

        <Button
          title={`Continue (${selectedSeats.length} seat${selectedSeats.length !== 1 ? 's' : ''})`}
          onPress={handleContinue}
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
  legendCard: {
    marginBottom: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendSeat: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: colors.darkGray,
  },
  seatsCard: {
    marginBottom: spacing.sm,
  },
  seatGridTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.navy,
    marginBottom: spacing.md,
  },
  seatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },
  seat: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.lightGray,
  },
  seatBooked: {
    backgroundColor: colors.error,
    opacity: 0.5,
  },
  seatSelected: {
    backgroundColor: colors.teal,
    borderColor: colors.navy,
  },
  seatNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.navy,
  },
  seatNumberBooked: {
    color: colors.white,
  },
  seatNumberSelected: {
    color: colors.white,
  },
  summaryCard: {
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.navy,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.gray,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.navy,
  },
  button: {
    marginBottom: spacing.lg,
  },
});
