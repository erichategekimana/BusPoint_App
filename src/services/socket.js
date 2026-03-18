import { io } from 'socket.io-client';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = Constants.expoConfig?.extra?.SOCKET_URL || process.env.SOCKET_URL;

let socket = null;

export const initializeSocket = async () => {
  if (socket?.connected) return socket;

  const token = await AsyncStorage.getItem('authToken');
  
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const subscribeToBusLocations = (callback) => {
  if (!socket) return;
  socket.on('bus_location_update', callback);
};

export const unsubscribeFromBusLocations = () => {
  if (!socket) return;
  socket.off('bus_location_update');
};

export const emitBusLocation = (locationData) => {
  if (!socket) return;
  socket.emit('update_bus_location', locationData);
};
