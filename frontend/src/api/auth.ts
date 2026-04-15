import apiClient from './client';
import type { User } from '../stores/authStore';

interface LoginRequest {
  username: string;
  password: string;
  avatar?: string;
}

interface RegisterRequest {
  username: string;
  password: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

interface UserResponse {
  id: string;
  username: string;
  avatar?: string;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}

export const authApi = {
  login: async (credentials: LoginRequest): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/user/login', credentials);
    return response;
  },

  register: async (data: RegisterRequest): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/user/register', data);
    return response;
  },

  getCurrentUser: async (): Promise<UserResponse> => {
    const response = await apiClient.get<UserResponse>('/api/v1/auth/me');
    return response;
  },

  updateProfile: async (data: {avatar?: string }): Promise<UserResponse> => {
    const response = await apiClient.put<UserResponse>('/api/v1/auth/me', data);
    return response;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/api/v1/auth/logout');
  },
};

export default authApi;
