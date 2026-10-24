// Shapes mirror the MSS backend DTOs / DB entities. Keep in sync with the Java side.

export type Role = 'USER' | 'ADMIN';

export interface UserResponse {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: Role | string;
  status: 'ACTIVE' | 'INACTIVE' | string;
  createdAt: string;
  lastLogin?: string | null;
  emailNotificationsEnabled?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserResponse;
}

export interface RegisterRequest {
  fullName: string;
  username: string;
  email: string;
  password: string;
  otp: string;
}
