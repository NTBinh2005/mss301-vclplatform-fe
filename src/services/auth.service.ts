import { formData, http } from '../api/client';
import type { ApiResponse, AuthResponse, PageResponse, RegisterRequest, UserResponse, UserSummary } from '../models';
import { q, unwrap } from './shared';

/* =====================  identity-service  /api/auth  ===================== */
export const authApi = {
  // `identifier` is a username or an email; identity accepts either in the `username` field.
  login: (identifier: string, password: string) =>
    unwrap(http.post<ApiResponse<AuthResponse>>('/auth/login', { username: identifier, password })),
  sendRegisterOtp: (email: string, username: string) =>
    unwrap(http.post<ApiResponse<void>>('/auth/send-register-otp', { email, username })),
  register: (data: RegisterRequest) =>
    unwrap(http.post<ApiResponse<AuthResponse>>('/auth/register', data)),
  logout: (refreshToken: string) =>
    unwrap(http.post<ApiResponse<void>>('/auth/logout', { refreshToken })),
  forgotPassword: (email: string) =>
    unwrap(http.post<ApiResponse<void>>('/auth/forgot-password', { email })),
  verifyOtp: (email: string, otp: string) =>
    unwrap(http.post<ApiResponse<void>>('/auth/verify-otp', { email, otp })),
  resetPassword: (email: string, otp: string, newPassword: string) =>
    unwrap(http.post<ApiResponse<void>>('/auth/reset-password', { email, otp, newPassword })),
};

/* =====================  identity-service  /api/users  ===================== */
export const userApi = {
  me: () => unwrap(http.get<ApiResponse<UserResponse>>('/users/me')),
  updateProfile: (data: { fullName: string; bio?: string }) =>
    unwrap(http.put<ApiResponse<UserResponse>>('/users/me', data)),
  changePassword: (currentPassword: string, newPassword: string) =>
    unwrap(http.put<ApiResponse<void>>('/users/me/password', { currentPassword, newPassword })),
  // Soft delete + anonymise; the password confirms it is really the owner.
  deleteAccount: (password: string) =>
    unwrap(http.delete<ApiResponse<void>>('/users/me', { data: { password } })),
  uploadAvatar: (image: File) =>
    unwrap(http.post<ApiResponse<UserResponse>>('/users/me/avatar', formData({ image }))),
  removeAvatar: () => unwrap(http.delete<ApiResponse<UserResponse>>('/users/me/avatar')),
  setEmailNotifications: (enabled: boolean) =>
    unwrap(http.patch<ApiResponse<UserResponse>>(`/users/me/notifications?${q({ emailNotificationsEnabled: enabled })}`)),

  // Public lookups (no token needed).
  get: (id: number) => unwrap(http.get<ApiResponse<UserSummary>>(`/users/${id}`)),
  search: (keyword: string, page = 0, size = 8) =>
    unwrap(http.get<ApiResponse<PageResponse<UserSummary>>>(`/users/search?${q({ keyword, page, size })}`)),
  summaries: (ids: number[]) =>
    ids.length
      ? unwrap(http.get<ApiResponse<UserSummary[]>>(`/users/summaries?${q({ ids: [...new Set(ids)].join(',') })}`))
      : Promise.resolve([] as UserSummary[]),
};

/** id -> display name, for DTOs that only carry a userId. Missing people are skipped. */
export async function namesFor(ids: (number | null | undefined)[]): Promise<Map<number, UserSummary>> {
  const wanted = ids.filter((x): x is number => x != null);
  try {
    const list = await userApi.summaries(wanted);
    return new Map(list.map(u => [u.userId, u]));
  } catch {
    return new Map();
  }
}
