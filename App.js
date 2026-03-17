import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'react-native';
import useAuthStore from './src/store/authStore';
import AuthStack from './src/navigation/AuthStack';
import PassengerStack from './src/navigation/PassengerStack';
import DriverStack from './src/navigation/DriverStack';
import ErrorBoundary from './src/components/ErrorBoundary';
import { initializeSocket } from './src/services/socket';

const Stack = createStackNavigator();

function RootNavigator() {
  const { user, isAuthenticated, initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      initializeSocket();
    }
  }, [isAuthenticated, user]);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthStack} />
      ) : user?.role === 'driver' ? (
        <Stack.Screen name="Driver" component={DriverStack} />
      ) : (
        <Stack.Screen name="Passenger" component={PassengerStack} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StatusBar barStyle="light-content" backgroundColor="#0D1B2A" />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </ErrorBoundary>
  );
}
