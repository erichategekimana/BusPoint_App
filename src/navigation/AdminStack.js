import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import TodaysTripsScreen from '../screens/admin/TodaysTripsScreen';
import PassengerManifestScreen from '../screens/admin/PassengerManifestScreen';
import QRScannerScreen from '../screens/admin/QRScannerScreen';
import GPSBroadcasterScreen from '../screens/admin/GPSBroadcasterScreen';

const Stack = createStackNavigator();

export default function AdminStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="TodaysTrips" component={TodaysTripsScreen} options={{ title: "Today's Trips" }} />
      <Stack.Screen name="PassengerManifest" component={PassengerManifestScreen} options={{ title: 'Passenger Manifest' }} />
      <Stack.Screen name="QRScanner" component={QRScannerScreen} options={{ title: 'Scan Ticket' }} />
      <Stack.Screen name="GPSBroadcaster" component={GPSBroadcasterScreen} options={{ title: 'GPS Tracking' }} />
    </Stack.Navigator>
  );
}
