import { formData, http } from '../api/client';
import type { ApiResponse, AuthResponse, RegisterRequest, UserResponse } from '../models';
import { q, unwrap } from './shared';

/* =====================  identity-service  /api/auth, /api/users  ===================== */
export const authApi = {
  login: (email: string, password: string) =>
    unwrap(http.post<ApiResponse<AuthResponse>>('/auth/login', { email, password })),
  sendRegisterOtp: (email: string, username: string) =>
    unwrap(http.post<ApiResponse<void>>('/auth/send-register-otp', { email, username })),
  register: (data: RegisterRequest) =>
    unwrap(http.post<ApiResponse<UserResponse>>('/auth/register', data)),
  logout: (refreshToken: string) =>
    unwrap(http.post<ApiResponse<void>>('/auth/logout', { refreshToken })),
  me: () => unwrap(http.get<ApiResponse<UserResponse>>('/auth/me')),
  forgotPassword: (email: string) =>
    unwrap(http.post<ApiResponse<void>>('/auth/forgot-password', { email })),
  verifyOtp: (email: string, otp: string) =>
    unwrap(http.post<ApiResponse<void>>('/auth/verify-otp', { email, otp })),
  resetPassword: (email: string, otp: string, newPassword: string) =>
    unwrap(http.post<ApiResponse<void>>('/auth/reset-password', { email, otp, newPassword })),
};

export const userApi = {
  profile: () => unwrap(http.get<ApiResponse<UserResponse>>('/users/me')),
  updateProfile: (data: { username: string; email: string; fullName: string }) =>
    unwrap(http.put<ApiResponse<UserResponse>>('/users/me', data)),
  updatePassword: (data: { oldPassword: string; newPassword: string }) =>
    unwrap(http.put<ApiResponse<string>>('/users/password', data)),
  deleteAccount: () => unwrap(http.delete<ApiResponse<string>>('/users/me')),
  uploadAvatar: (file: File) =>
    unwrap(http.post<ApiResponse<string>>('/users/avatar/upload', formData({ file }))),
  updateAvatarUrl: (avatarUrl: string) =>
    unwrap(http.put<ApiResponse<UserResponse>>('/users/avatar', { avatarUrl })),
  setEmailNotifications: (enabled: boolean) =>
    unwrap(http.patch<ApiResponse<UserResponse>>(`/users/me/notifications?${q({ emailNotificationsEnabled: enabled })}`)),
};
