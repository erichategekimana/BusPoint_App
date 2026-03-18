import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import Card from '../../components/Card';
import { colors, spacing, borderRadius } from '../../config/theme';

export default function NotificationsScreen() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/notifications?user_id=${user.id}`);
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'booking':
        return 'ticket';
      case 'payment':
        return 'card';
      case 'trip':
        return 'bus';
      case 'alert':
        return 'alert-circle';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'booking':
        return colors.teal;
      case 'payment':
        return colors.gold;
      case 'trip':
        return colors.navy;
      case 'alert':
        return colors.error;
      default:
        return colors.gray;
    }
  };

  const renderNotification = ({ item }) => (
    <Card style={styles.notificationCard}>
      <View style={styles.notificationContent}>
        <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(item.type) }]}>
          <Ionicons name={getNotificationIcon(item.type)} size={24} color={colors.white} />
        </View>

        <View style={styles.textContent}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleString()}
          </Text>
        </View>

        {!item.is_read && (
          <View style={styles.unreadDot} />
        )}
      </View>
    </Card>
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
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off" size={48} color={colors.gray} />
            <Text style={styles.emptyText}>No notifications</Text>
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
  notificationCard: {
    marginBottom: spacing.sm,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.navy,
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: 14,
    color: colors.darkGray,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  timestamp: {
    fontSize: 12,
    color: colors.gray,
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.teal,
    marginTop: spacing.sm,
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
