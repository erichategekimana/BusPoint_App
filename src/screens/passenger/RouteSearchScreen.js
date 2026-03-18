import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import Card from '../../components/Card';
import { colors, spacing, borderRadius, typography } from '../../config/theme';

export default function RouteSearchScreen({ navigation }) {
  const [routes, setRoutes] = useState([]);
  const [filteredRoutes, setFilteredRoutes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRoutes();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredRoutes(routes);
    } else {
      const filtered = routes.filter(route =>
        route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        route.route_code.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredRoutes(filtered);
    }
  }, [searchQuery, routes]);

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/routes');
      setRoutes(response.data);
      setFilteredRoutes(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load routes');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderRoute = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('TripList', { routeId: item.id, routeName: item.name })}
    >
      <Card style={styles.routeCard}>
        <View style={styles.routeHeader}>
          <View style={styles.routeIcon}>
            <Ionicons name="bus" size={24} color={colors.teal} />
          </View>
          <View style={styles.routeDetails}>
            <Text style={styles.routeName}>{item.name}</Text>
            <Text style={styles.routeCode}>{item.route_code}</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.gray} />
        </View>
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
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.gray} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search routes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.gray}
        />
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={filteredRoutes}
        renderItem={renderRoute}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={48} color={colors.gray} />
            <Text style={styles.emptyText}>No routes found</Text>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  routeCard: {
    marginBottom: spacing.sm,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  routeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeDetails: {
    flex: 1,
  },
  routeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.navy,
  },
  routeCode: {
    fontSize: 14,
    color: colors.gray,
    marginTop: spacing.xs,
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
