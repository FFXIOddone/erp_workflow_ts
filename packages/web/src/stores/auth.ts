import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@erp/shared';
import { api } from '../lib/api';
import { disconnectWebSocket } from '../lib/websocket-manager';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        const response = await api.post('/auth/login', { username, password });
        const { token, user } = response.data.data;

        // Set token in API client
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        set({
          token,
          user,
          isAuthenticated: true,
        });

        return user;
      },

      logout: () => {
        delete api.defaults.headers.common['Authorization'];
        disconnectWebSocket();
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
      },

      setUser: (user: User) => {
        set({ user });
      },
    }),
    {
      name: 'erp-auth',
      onRehydrateStorage: () => (state) => {
        // Restore token to API client on rehydration
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
        }
      },
    }
  )
);
