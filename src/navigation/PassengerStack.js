import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../config/theme';

import HomeScreen from '../screens/passenger/HomeScreen';
import RouteSearchScreen from '../screens/passenger/RouteSearchScreen';
import TripListScreen from '../screens/passenger/TripListScreen';
import SeatSelectionScreen from '../screens/passenger/SeatSelectionScreen';
import BookingConfirmationScreen from '../screens/passenger/BookingConfirmationScreen';
import PaymentScreen from '../screens/passenger/PaymentScreen';
import MyBookingsScreen from '../screens/passenger/MyBookingsScreen';
import NotificationsScreen from '../screens/passenger/NotificationsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RouteSearch" component={RouteSearchScreen} options={{ title: 'Search Routes' }} />
      <Stack.Screen name="TripList" component={TripListScreen} options={{ title: 'Available Trips' }} />
      <Stack.Screen name="SeatSelection" component={SeatSelectionScreen} options={{ title: 'Select Seat' }} />
      <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} options={{ title: 'Confirm Booking' }} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Payment' }} />
    </Stack.Navigator>
  );
}

export default function PassengerStack() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Bookings') iconName = focused ? 'ticket' : 'ticket-outline';
          else if (route.name === 'Notifications') iconName = focused ? 'notifications' : 'notifications-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.gray,
        tabBarStyle: { paddingBottom: 5, height: 60 },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} options={{ headerShown: false }} />
      <Tab.Screen name="Bookings" component={MyBookingsScreen} options={{ title: 'My Bookings' }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
    </Tab.Navigator>
  );
}
