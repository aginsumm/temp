import { localDatabase, STORES } from '../data/localDatabase';
import type { User } from '../stores/authStore';

const LOCAL_USERS_KEY = 'heritage_local_users';
const CURRENT_USER_KEY = 'heritage_current_user';
const GUEST_USER_ID = 'guest_user';

interface LocalUser extends User {
  password: string;
  isLocal: boolean;
  updated_at?: string;
}

interface GuestUser extends User {
  isGuest: true;
}

type AppUser = LocalUser | GuestUser;

class LocalAuthService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await localDatabase.init();
    await this.ensureGuestUser();
    this.initialized = true;
  }

  private async ensureGuestUser(): Promise<void> {
    const users = this.getLocalUsers();
    const guestExists = users.some((u) => u.id === GUEST_USER_ID);

    if (!guestExists) {
      const guestUser: GuestUser = {
        id: GUEST_USER_ID,
        username: '游客',
        is_active: true,
        isGuest: true,
        created_at: new Date().toISOString(),
      };

      users.push(guestUser as unknown as LocalUser);
      this.saveLocalUsers(users);
    }
  }

  private getLocalUsers(): LocalUser[] {
    try {
      const stored = localStorage.getItem(LOCAL_USERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveLocalUsers(users: LocalUser[]): void {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  }

  private generateId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateToken(userId: string): string {
    return `local_token_${userId}_${Date.now()}`;
  }

  async register(
    username: string,
    password: string,
  ): Promise<{
    success: boolean;
    user?: AppUser;
    token?: string;
    error?: string;
  }> {
    await this.initialize();

    const users = this.getLocalUsers();

    if (users.some((u) => u.username === username)) {
      return { success: false, error: '用户名已存在' };
    }


    const newUser: LocalUser = {
      id: this.generateId(),
      username,
      password,
      is_active: true,
      isLocal: true,
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    this.saveLocalUsers(users);

    const token = this.generateToken(newUser.id);

    const userWithoutPassword = { ...newUser };
    delete (userWithoutPassword as Partial<LocalUser>).password;

    return {
      success: true,
      user: userWithoutPassword as AppUser,
      token,
    };
  }

  async login(
    username: string,
    password: string
  ): Promise<{
    success: boolean;
    user?: AppUser;
    token?: string;
    error?: string;
  }> {
    await this.initialize();

    const users = this.getLocalUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return { success: false, error: '用户不存在' };
    }

    if (user.id === GUEST_USER_ID) {
      const token = this.generateToken(user.id);
      return {
        success: true,
        user: user as unknown as GuestUser,
        token,
      };
    }

    if ((user as LocalUser).password !== password) {
      return { success: false, error: '密码错误' };
    }

    const token = this.generateToken(user.id);

    const userWithoutPassword = { ...user };
    delete (userWithoutPassword as Partial<LocalUser>).password;

    return {
      success: true,
      user: userWithoutPassword as AppUser,
      token,
    };
  }

  async loginAsGuest(): Promise<{
    success: boolean;
    user?: GuestUser;
    token?: string;
  }> {
    await this.initialize();

    const users = this.getLocalUsers();
    const guestUser = users.find((u) => u.id === GUEST_USER_ID);

    if (!guestUser) {
      return { success: false };
    }

    const token = this.generateToken(guestUser.id);

    return {
      success: true,
      user: {
        id: guestUser.id,
        username: '游客',
        is_active: true,
        isGuest: true,
        created_at: guestUser.created_at,
      },
      token,
    };
  }

  async getCurrentUser(): Promise<AppUser | null> {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  async setCurrentUser(user: AppUser, token: string): Promise<void> {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    localStorage.setItem('token', token);
  }

  async logout(): Promise<void> {
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem('token');
  }

  async updateProfile(
    userId: string,
    updates: Partial<User>
  ): Promise<{
    success: boolean;
    user?: AppUser;
    error?: string;
  }> {
    const users = this.getLocalUsers();
    const index = users.findIndex((u) => u.id === userId);

    if (index === -1) {
      return { success: false, error: '用户不存在' };
    }

    const updatedUser = {
      ...users[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    users[index] = updatedUser;
    this.saveLocalUsers(users);

    const userWithoutPassword = { ...updatedUser };
    delete (userWithoutPassword as Partial<LocalUser>).password;

    return {
      success: true,
      user: userWithoutPassword as unknown as AppUser,
    };
  }

  isGuest(user: AppUser | null): boolean {
    return user?.id === GUEST_USER_ID || (user as GuestUser)?.isGuest === true;
  }

  isLocalUser(user: AppUser | null): boolean {
    return (user as LocalUser)?.isLocal === true || this.isGuest(user);
  }

  async validateToken(token: string): Promise<{
    valid: boolean;
    user?: AppUser;
  }> {
    if (!token || !token.startsWith('local_token_')) {
      return { valid: false };
    }

    const parts = token.split('_');
    if (parts.length < 4) {
      return { valid: false };
    }

    const userId = parts.slice(2, -1).join('_');
    const users = this.getLocalUsers();
    const user = users.find((u) => u.id === userId);

    if (!user) {
      return { valid: false };
    }

    const userWithoutPassword = { ...user };
    delete (userWithoutPassword as Partial<LocalUser>).password;

    return {
      valid: true,
      user: userWithoutPassword as AppUser,
    };
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const users = this.getLocalUsers();
    const index = users.findIndex((u) => u.id === userId);

    if (index === -1) {
      return { success: false, error: '用户不存在' };
    }

    const user = users[index];

    if (user.id === GUEST_USER_ID) {
      return { success: false, error: '访客用户无法修改密码' };
    }

    if ((user as LocalUser).password !== oldPassword) {
      return { success: false, error: '原密码错误' };
    }

    users[index] = {
      ...user,
      password: newPassword,
      updated_at: new Date().toISOString(),
    };

    this.saveLocalUsers(users);

    return { success: true };
  }

  async deleteAccount(userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (userId === GUEST_USER_ID) {
      return { success: false, error: '无法删除访客账户' };
    }

    const users = this.getLocalUsers();
    const filtered = users.filter((u) => u.id !== userId);

    if (filtered.length === users.length) {
      return { success: false, error: '用户不存在' };
    }

    this.saveLocalUsers(filtered);

    await localDatabase.deleteByIndex(STORES.SESSIONS, 'user_id', userId);

    return { success: true };
  }

  getAllLocalUsers(): Omit<LocalUser, 'password'>[] {
    const users = this.getLocalUsers();
    return users.map((user) => {
      const result = { ...user };
      delete (result as Partial<LocalUser>).password;
      return result;
    });
  }

  async resetToGuest(): Promise<void> {
    await this.logout();
    const guestResult = await this.loginAsGuest();
    if (guestResult.success && guestResult.user && guestResult.token) {
      await this.setCurrentUser(guestResult.user, guestResult.token);
    }
  }
}

export const localAuthService = new LocalAuthService();
export type { LocalUser, GuestUser, AppUser };
