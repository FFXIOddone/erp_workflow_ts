import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { disconnectShopFloorWebSocket } from '../lib/websocket-manager';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: string;
  allowedStations: string[];
  eulaAcceptedAt: string | null;
  eulaAcceptedVersion: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      setUser: (user) => set({ user }),
      logout: () => {
        disconnectShopFloorWebSocket();
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    { name: 'shop-floor-auth' },
  ),
);
