import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import Card from '../../components/Card';
import api from '../../services/api';
import { colors, spacing, borderRadius } from '../../config/theme';

export default function PaymentScreen({ route, navigation }) {
  const { booking, amount } = route.params;
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);

  const handleMTNMoMoPayment = async () => {
    try {
      setLoading(true);

      const paymentData = {
        booking_id: booking.id,
        amount,
        currency: 'RWF',
        payment_method: 'MTN_MOMO',
      };

      const response = await api.post('/payments/initiate', paymentData);

      if (response.data.redirect_url) {
        await Linking.openURL(response.data.redirect_url);
      }

      setPaymentStatus('pending');

      setTimeout(() => {
        verifyPayment(booking.id);
      }, 3000);
    } catch (error) {
      Alert.alert('Payment Error', error.response?.data?.message || 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async (bookingId) => {
    try {
      const response = await api.get(`/payments/verify/${bookingId}`);
      
      if (response.data.status === 'completed') {
        setPaymentStatus('success');
        Alert.alert('Success', 'Payment completed successfully!', [
          {
            text: 'View Booking',
            onPress: () => navigation.navigate('Bookings'),
          },
        ]);
      } else {
        setPaymentStatus('failed');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text style={styles.title}>Payment Summary</Text>
          
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Total Amount</Text>
            <Text style={styles.amount}>RWF {amount.toLocaleString()}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Booking ID:</Text>
            <Text style={styles.value}>{booking.id}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Seats:</Text>
            <Text style={styles.value}>{booking.seat_number}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Status:</Text>
            <Text style={[
              styles.value,
              paymentStatus === 'success' && { color: colors.success },
              paymentStatus === 'failed' && { color: colors.error },
            ]}>
              {paymentStatus ? paymentStatus.toUpperCase() : 'PENDING'}
            </Text>
          </View>
        </Card>

        <Card style={styles.methodCard}>
          <Text style={styles.methodTitle}>Payment Method</Text>
          <View style={styles.methodOption}>
            <View style={styles.methodIcon}>
              <Text style={styles.methodIconText}>📱</Text>
            </View>
            <View style={styles.methodDetails}>
              <Text style={styles.methodName}>MTN MoMo</Text>
              <Text style={styles.methodDesc}>Fast and secure mobile money payment</Text>
            </View>
          </View>
        </Card>

        {paymentStatus !== 'success' && (
          <Button
            title="Pay with MTN MoMo"
            onPress={handleMTNMoMoPayment}
            loading={loading}
            style={styles.button}
          />
        )}

        <Button
          title={paymentStatus === 'success' ? 'Done' : 'Cancel'}
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
  amountContainer: {
    backgroundColor: colors.lightGray,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  amountLabel: {
    fontSize: 14,
    color: colors.gray,
    marginBottom: spacing.xs,
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.teal,
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
  methodCard: {
    marginBottom: spacing.md,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.navy,
    marginBottom: spacing.md,
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.md,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodIconText: {
    fontSize: 24,
  },
  methodDetails: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.navy,
  },
  methodDesc: {
    fontSize: 12,
    color: colors.gray,
    marginTop: spacing.xs,
  },
  button: {
    marginBottom: spacing.md,
  },
});
