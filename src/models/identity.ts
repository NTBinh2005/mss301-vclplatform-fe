// Shapes mirror the MSS backend DTOs (identity-service). Keep in sync with the Java side.

export type Role = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'BANNED' | 'PENDING_VERIFICATION' | 'DELETED';

/** UserDto — GET/PUT /users/me. */
export interface UserResponse {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  role: Role;
  active: boolean;
  emailNotificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** TokenResponse — login / register / refresh. It carries no profile, so /users/me follows. */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  userId: number;
  username: string;
  email: string;
  role: Role;
}

export interface RegisterRequest {
  fullName: string;
  username: string;
  email: string;
  password: string;
  otp: string;
}

/** UserSummaryResponse — public: /users/{id}, /users/summaries, /users/search. */
export interface UserSummary {
  userId: number;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}

/** AdminUserResponse — /users/admin. */
export interface AdminUserResponse {
  id: number;
  username: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  pendingUsers: number;
  adminUsers: number;
  regularUsers: number;
}

export interface AdminCreateUserRequest {
  username: string;
  email: string;
  password: string;
  fullName?: string;
  role?: Role;
}
