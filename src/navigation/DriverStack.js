import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import TodaysTripsScreen from '../screens/driver/TodaysTripsScreen';
import PassengerManifestScreen from '../screens/driver/PassengerManifestScreen';
import QRScannerScreen from '../screens/driver/QRScannerScreen';
import GPSBroadcasterScreen from '../screens/driver/GPSBroadcasterScreen';

const Stack = createStackNavigator();

export default function DriverStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="TodaysTrips" component={TodaysTripsScreen} options={{ title: "Today's Trips" }} />
      <Stack.Screen name="PassengerManifest" component={PassengerManifestScreen} options={{ title: 'Passenger Manifest' }} />
      <Stack.Screen name="QRScanner" component={QRScannerScreen} options={{ title: 'Scan Ticket' }} />
      <Stack.Screen name="GPSBroadcaster" component={GPSBroadcasterScreen} options={{ title: 'GPS Tracking' }} />
    </Stack.Navigator>
  );
}
