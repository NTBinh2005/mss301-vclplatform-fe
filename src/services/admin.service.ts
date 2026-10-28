import { http } from '../api/client';
import type {
  AdminCreateUserRequest, AdminSummaryResponse, AdminUserResponse, ApiResponse, BlogResponse, BlogStatus,
  PageResponse, ReportDetailResponse, ReportResponse, ReportStatus, Role, SocialOverview, UserStatistics,
  UserStatus, VisitLogResponse, VisitTimePoint, VocabularySuggestionResponse,
} from '../models';
import { q, unwrap } from './shared';

/* =====================  admin — every route is ADMIN-only on the backend  ===================== */
export const adminApi = {
  // identity-service /api/users/admin
  users: (params: { keyword?: string; role?: Role; status?: UserStatus; page?: number; size?: number } = {}) =>
    unwrap(http.get<ApiResponse<PageResponse<AdminUserResponse>>>(`/users/admin?${q({ page: 0, size: 100, ...params })}`)),
  userStats: () => unwrap(http.get<ApiResponse<UserStatistics>>('/users/admin/statistics')),
  createUser: (body: AdminCreateUserRequest) => unwrap(http.post<ApiResponse<AdminUserResponse>>('/users/admin', body)),
  setUserStatus: (id: number, status: 'ACTIVE' | 'BANNED', reason?: string) =>
    unwrap(http.put<ApiResponse<AdminUserResponse>>(`/users/admin/${id}/status`, { status, reason })),
  setUserRole: (id: number, role: Role) =>
    unwrap(http.put<ApiResponse<AdminUserResponse>>(`/users/admin/${id}/role`, { role })),
  deleteUser: (id: number) => unwrap(http.delete<ApiResponse<void>>(`/users/admin/${id}`)),

  // social-service /api/blogs/admin
  blogs: (params: { status?: BlogStatus; keyword?: string; page?: number; size?: number } = {}) =>
    unwrap(http.get<ApiResponse<PageResponse<BlogResponse>>>(`/blogs/admin?${q({ page: 0, size: 50, ...params })}`)),
  hideBlog: (id: number, reason: string) =>
    unwrap(http.put<ApiResponse<BlogResponse>>(`/blogs/admin/${id}/hide`, { reason })),
  restoreBlog: (id: number) => unwrap(http.put<ApiResponse<BlogResponse>>(`/blogs/admin/${id}/restore`)),
  socialOverview: () => unwrap(http.get<ApiResponse<SocialOverview>>('/blogs/admin/analytics/overview')),

  reports: (params: { status?: ReportStatus; page?: number; size?: number } = {}) =>
    unwrap(http.get<ApiResponse<PageResponse<ReportResponse>>>(`/blogs/admin/reports?${q({ page: 0, size: 50, ...params })}`)),
  report: (id: number) => unwrap(http.get<ApiResponse<ReportDetailResponse>>(`/blogs/admin/reports/${id}`)),
  pendingReports: () => unwrap(http.get<ApiResponse<number>>('/blogs/admin/reports/pending-count')),
  // The report holds up: the post is removed with this reason and every open report on it closes.
  resolveReport: (id: number, reason: string) =>
    unwrap(http.put<ApiResponse<ReportResponse>>(`/blogs/admin/reports/${id}/resolve`, { reason })),
  // The post is fine: only the report closes.
  rejectReport: (id: number) => unwrap(http.put<ApiResponse<ReportResponse>>(`/blogs/admin/reports/${id}/reject`)),

  // learning-service
  suggestions: (page = 0, size = 50) =>
    unwrap(http.get<ApiResponse<PageResponse<VocabularySuggestionResponse>>>(`/vocabulary-suggestions/admin?${q({ page, size })}`)),
  pendingSuggestions: () => unwrap(http.get<ApiResponse<number>>('/vocabulary-suggestions/admin/pending-count')),
  markSuggestionReviewed: (id: number) =>
    unwrap(http.put<ApiResponse<void>>(`/vocabulary-suggestions/admin/${id}/reviewed`)),

  summary: () => unwrap(http.get<ApiResponse<AdminSummaryResponse>>('/visits/admin/summary')),
  visits: (from: string, to: string, granularity: 'DAY' | 'MONTH' | 'YEAR') =>
    unwrap(http.get<ApiResponse<VisitTimePoint[]>>(`/visits/admin/timeseries?${q({ from, to, granularity })}`)),
  visitLogs: (page = 0, size = 20) =>
    unwrap(http.get<ApiResponse<PageResponse<VisitLogResponse>>>(`/visits/admin/logs?${q({ page, size })}`)),
};
