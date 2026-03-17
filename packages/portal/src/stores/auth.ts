import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PortalUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  customerId: string;
  customerName?: string;
}

interface AuthState {
  token: string | null;
  user: PortalUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: PortalUser) => void;
  logout: () => void;
  updateUser: (user: Partial<PortalUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: (token, user) =>
        set({
          token,
          user,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        }),

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
    }),
    {
      name: 'portal-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
