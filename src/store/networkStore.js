import { create } from 'zustand';

const useNetworkStore = create((set) => ({
  isConnected: true,
  
  initialize: () => {
    // Network status will be checked via device connectivity
    // This is a placeholder for future network monitoring
  },
  
  setConnected: (isConnected) => set({ isConnected }),
}));

export default useNetworkStore;
