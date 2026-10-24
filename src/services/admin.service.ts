import { http } from '../api/client';
import type {
  AdminSummaryResponse, ApiResponse, BlogPayload, BlogReportResponse, BlogResponse, PageResponse,
  UserResponse, VisitTimePoint, VocabularySuggestionResponse,
} from '../models';
import { q, unwrap } from './shared';

/* =====================  admin  ===================== */
export const adminApi = {
  users: (page = 0, size = 50) =>
    unwrap(http.get<ApiResponse<PageResponse<UserResponse>>>(`/admin/users?${q({ page, size })}`)),
  setUserStatus: (id: number, status: 'ACTIVE' | 'INACTIVE') =>
    unwrap(http.put<ApiResponse<UserResponse>>(`/admin/users/${id}`, { status })),

  blogs: (page = 0, size = 50) =>
    unwrap(http.get<ApiResponse<PageResponse<BlogResponse>>>(`/admin/blogs?${q({ page, size })}`)),
  createBlog: (body: BlogPayload) => unwrap(http.post<ApiResponse<BlogResponse>>('/admin/blogs', body)),
  deleteBlog: (id: number) => unwrap(http.delete<ApiResponse<string>>(`/admin/blogs/${id}`)),

  reports: (page = 0, size = 50) =>
    unwrap(http.get<ApiResponse<PageResponse<BlogReportResponse>>>(`/admin/reports?${q({ page, size })}`)),
  resolveReport: (id: number) => unwrap(http.put<ApiResponse<string>>(`/admin/reports/${id}/resolve`)),
  removeBlog: (blogId: number, reason: string) =>
    unwrap(http.post<ApiResponse<string>>(`/admin/reports/blogs/${blogId}/remove`, { reason })),

  suggestions: (page = 0, size = 50) =>
    unwrap(http.get<ApiResponse<PageResponse<VocabularySuggestionResponse>>>(`/admin/vocabulary-suggestions?${q({ page, size })}`)),
  markSuggestionReviewed: (id: number) =>
    unwrap(http.put<ApiResponse<string>>(`/admin/vocabulary-suggestions/${id}/reviewed`)),

  summary: () => unwrap(http.get<ApiResponse<AdminSummaryResponse>>('/admin/analytics/summary')),
  visits: (from: string, to: string, granularity: 'DAY' | 'MONTH' | 'YEAR') =>
    unwrap(http.get<ApiResponse<VisitTimePoint[]>>(`/admin/analytics/visits/timeseries?${q({ from, to, granularity })}`)),
};
