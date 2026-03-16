import { create } from 'zustand';
import api from '../services/api';

const useBookingStore = create((set) => ({
  bookings: [],
  currentBooking: null,
  loading: false,
  error: null,

  fetchBookings: async (userId) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/bookings?user_id=${userId}`);
      set({ bookings: response.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  createBooking: async (bookingData) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/bookings', bookingData);
      set({ currentBooking: response.data, loading: false });
      return response.data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateBookingStatus: async (bookingId, status) => {
    try {
      const response = await api.patch(`/bookings/${bookingId}`, { status });
      set((state) => ({
        bookings: state.bookings.map((b) =>
          b.id === bookingId ? response.data : b
        ),
      }));
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));

export default useBookingStore;
