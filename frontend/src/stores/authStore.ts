import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { localAuthService } from '../services/localAuthService';
import { authApi } from '../api/auth';
import { apiAdapterManager } from '../data/apiAdapter';

export interface User {
  id: string;
  username: string;
  avatar?: string;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isGuest: boolean;
  isLocalUser: boolean;
  backendAvailable: boolean;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (user: User, token: string) => void;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  setUserFromStorage: (user: User, token: string) => void;

  loginWithCredentials: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginAsGuest: () => Promise<{ success: boolean; error?: string }>;
  register: (
    username: string,
    email: string,
    password: string,
    nickname?: string
  ) => Promise<{ success: boolean; error?: string }>;

  checkBackendStatus: () => Promise<boolean>;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isGuest: false,
      isLocalUser: false,
      backendAvailable: false,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isGuest: user?.id === 'guest_user',
          isLocalUser: user?.id?.startsWith('local_') || user?.id === 'guest_user',
        }),

      setToken: (token) => set({ token }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      login: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
          error: null,
          isGuest: user?.id === 'guest_user',
          isLocalUser: user?.id?.startsWith('local_') || user?.id === 'guest_user',
        }),

      logout: async () => {
        const state = get();

        if (!state.isLocalUser && state.backendAvailable) {
          try {
            await authApi.logout();
          } catch (e) {
            console.warn('Backend logout failed:', e);
          }
        }

        await localAuthService.logout();

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
          isGuest: false,
          isLocalUser: false,
        });
      },

      // 把原来的 updateUser 替换为这个增强版：
      updateUser: (userData) => {
        const currentUser = get().user;
        if (currentUser) {
          // 1. 更新 Zustand 全局状态
          const updatedUser = { ...currentUser, ...userData };
          set({ user: updatedUser });

          // 2. 🔥 核心修复：同步更新底层 LocalStorage，防止路由跳转时被 App.jsx 的旧数据覆盖
          try {
            const legacyUserStr = localStorage.getItem('heritage_current_user');
            if (legacyUserStr) {
              const legacyUser = JSON.parse(legacyUserStr);
              // 把新的 userData (比如 avatar) 合并进去，再存回本地
              localStorage.setItem(
                'heritage_current_user',
                JSON.stringify({ ...legacyUser, ...userData })
              );
            }
          } catch (e) {
            console.warn('同步本地 legacy 存储失败:', e);
          }
        }
      },

      setUserFromStorage: (user, token) => {
        set({
          user,
          token,
          isAuthenticated: true,
          isGuest: user?.id === 'guest_user',
          isLocalUser: user?.id?.startsWith('local_') || user?.id === 'guest_user',
        });
      },

      checkBackendStatus: async () => {
        const isOnline = apiAdapterManager.getOnlineStatus();
        set({ backendAvailable: isOnline });
        return isOnline;
      },

      initializeAuth: async () => {
        set({ isLoading: true });

        try {
          const backendAvailable = await get().checkBackendStatus();

          const token = localStorage.getItem('token');
          if (token) {
            if (token.startsWith('local_token_')) {
              const result = await localAuthService.validateToken(token);
              if (result.valid && result.user) {
                set({
                  user: result.user as User,
                  token,
                  isAuthenticated: true,
                  isGuest: localAuthService.isGuest(result.user),
                  isLocalUser: true,
                  isLoading: false,
                });
                return;
              }
            } else if (backendAvailable) {
              try {
                const user = await authApi.getCurrentUser();
                set({
                  user,
                  token,
                  isAuthenticated: true,
                  isGuest: false,
                  isLocalUser: false,
                  isLoading: false,
                });
                return;
              } catch (e) {
                console.warn('Failed to validate remote token:', e);
              }
            }
          }

          set({ isLoading: false });
        } catch (e) {
          console.error('Auth initialization failed:', e);
          set({ isLoading: false });
        }
      },

      loginWithCredentials: async (username: string, password: string) => {
        // 【关键新增】：如果当前有残留的登录状态（比如游客），先静默退出，彻底清理旧 Token 和环境
        const currentState = get();
        if (currentState.isGuest || currentState.isAuthenticated) {
          await currentState.logout();
        }

        set({ isLoading: true, error: null });

        try {
          const backendAvailable = await get().checkBackendStatus();

          if (backendAvailable) {
            try {
              const response = await authApi.login({ username, password });
              set({
                user: response.user,
                token: response.access_token,
                isAuthenticated: true,
                isGuest: false,
                isLocalUser: false,
                isLoading: false,
              });
              localStorage.setItem('token', response.access_token);
              return { success: true };
            } catch (e: unknown) {
              console.warn('Backend login failed, trying local:', e);
            }
          }

          const localResult = await localAuthService.login(username, password);

          if (localResult.success && localResult.user && localResult.token) {
            await localAuthService.setCurrentUser(localResult.user, localResult.token);
            set({
              user: localResult.user as User,
              token: localResult.token,
              isAuthenticated: true,
              isGuest: localAuthService.isGuest(localResult.user),
              isLocalUser: true,
              isLoading: false,
            });
            return { success: true };
          }

          set({ isLoading: false, error: localResult.error });
          return { success: false, error: localResult.error };
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      loginAsGuest: async () => {
        // 【关键新增】：防止游客重复点击或从真实用户切回游客导致的状态混乱
        const currentState = get();
        if (currentState.isAuthenticated) {
          await currentState.logout();
        }
        set({ isLoading: true, error: null });

        try {
          const result = await localAuthService.loginAsGuest();

          if (result.success && result.user && result.token) {
            await localAuthService.setCurrentUser(result.user, result.token);
            set({
              user: result.user as User,
              token: result.token,
              isAuthenticated: true,
              isGuest: true,
              isLocalUser: true,
              isLoading: false,
            });
            return { success: true };
          }

          set({ isLoading: false, error: '访客登录失败' });
          return { success: false, error: '访客登录失败' };
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      register: async (username: string, password: string) => {
        // 【关键新增】：如果是游客点击了注册，注册前先清理游客状态
        const currentState = get();
        if (currentState.isAuthenticated) {
          await currentState.logout();
        }
        set({ isLoading: true, error: null });

        try {
          // 1. 检查后端是否可用
          const backendAvailable = await get().checkBackendStatus();
          if (!backendAvailable) {
            set({ isLoading: false, error: '服务器不可用，请稍后重试' });
            return { success: false, error: '服务器不可用' };
          }

          // 2. 直接调用后端注册（不再降级到本地）
          const response = await authApi.register({ username, password });

          // 3. 注册成功，更新状态
          set({
            user: response.user,
            token: response.access_token,
            isAuthenticated: true,
            isGuest: false,
            isLocalUser: false, // 明确标记为在线用户
            isLoading: false,
          });
          localStorage.setItem('token', response.access_token);
          return { success: true };
        } catch (e: unknown) {
          // 4. 后端注册失败，直接返回错误，不进行任何本地降级
          console.error('Backend register failed:', e);
          const errorObj = e as Record<string, unknown>;
          const errorMsg =
            (((errorObj.response as Record<string, unknown>)?.data as Record<string, unknown>)
              ?.detail as string) ||
            (e instanceof Error ? e.message : String(e)) ||
            '注册失败，请重试';
          set({ isLoading: false, error: errorMsg });
          return { success: false, error: errorMsg };
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        isGuest: state.isGuest,
        isLocalUser: state.isLocalUser,
      }),
    }
  )
);
