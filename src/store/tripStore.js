import { create } from 'zustand';
import api from '../services/api';

const useTripStore = create((set) => ({
  routes: [],
  trips: [],
  selectedTrip: null,
  loading: false,
  error: null,

  fetchRoutes: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/routes');
      set({ routes: response.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  fetchTrips: async (routeId) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/trips?route_id=${routeId}&status=scheduled`);
      set({ trips: response.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  selectTrip: (trip) => set({ selectedTrip: trip }),

  clearError: () => set({ error: null }),
}));

export default useTripStore;
