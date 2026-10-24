import { formData, http } from '../api/client';
import type {
  ApiResponse, BlogCommentResponse, BlogNotificationResponse, BlogPayload, BlogReplyResponse,
  BlogResponse, BlogSearchResponse, BlogUserSummary, FollowStatusResponse, LikeToggleResponse,
  PageResponse,
} from '../models';
import { q, unwrap } from './shared';

/* =====================  social-service  ===================== */
export const blogApi = {
  published: (page = 0, size = 10) =>
    unwrap(http.get<ApiResponse<PageResponse<BlogResponse>>>(`/blogs?${q({ page, size })}`)),
  get: (id: number) => unwrap(http.get<ApiResponse<BlogResponse>>(`/blogs/${id}`)),
  search: (keyword: string, page = 0, size = 10) =>
    unwrap(http.get<ApiResponse<BlogSearchResponse>>(`/blogs/search?${q({ keyword, page, size })}`)),
  byUser: (userId: number, page = 0, size = 20) =>
    unwrap(http.get<ApiResponse<PageResponse<BlogResponse>>>(`/blogs/users/${userId}?${q({ page, size })}`)),
  toggleLike: (id: number) => unwrap(http.post<ApiResponse<LikeToggleResponse>>(`/blogs/${id}/like`)),
  comments: (id: number) => unwrap(http.get<ApiResponse<BlogCommentResponse[]>>(`/blogs/${id}/comments`)),
  addComment: (id: number, content: string) =>
    unwrap(http.post<ApiResponse<BlogCommentResponse>>(`/blogs/${id}/comments`, { content })),
  deleteComment: (blogId: number, commentId: number) =>
    unwrap(http.delete<ApiResponse<string>>(`/blogs/${blogId}/comments/${commentId}`)),
  toggleCommentLike: (commentId: number) =>
    unwrap(http.post<ApiResponse<LikeToggleResponse>>(`/blogs/comments/${commentId}/like`)),
  replies: (commentId: number, page = 0, size = 20) =>
    unwrap(http.get<ApiResponse<PageResponse<BlogReplyResponse>>>(`/blogs/comments/${commentId}/replies?${q({ page, size })}`)),
  addReply: (commentId: number, content: string) =>
    unwrap(http.post<ApiResponse<BlogReplyResponse>>(`/blogs/comments/${commentId}/replies`, { content })),
  deleteReply: (replyId: number) => unwrap(http.delete<ApiResponse<void>>(`/blogs/replies/${replyId}`)),
  report: (id: number, reason: string) => unwrap(http.post<ApiResponse<string>>(`/blogs/${id}/report`, { reason })),
  shareLink: (id: number) => unwrap(http.post<ApiResponse<unknown>>(`/blogs/${id}/share?${q({ shareType: 'COPY_URL' })}`)),
  follow: (userId: number) => unwrap(http.post<ApiResponse<FollowStatusResponse>>(`/users/${userId}/follow`)),
  unfollow: (userId: number) => unwrap(http.delete<ApiResponse<FollowStatusResponse>>(`/users/${userId}/follow`)),
  following: (userId: number, page = 0, size = 20) =>
    unwrap(http.get<ApiResponse<PageResponse<BlogUserSummary>>>(`/users/${userId}/following?${q({ page, size })}`)),
  notifications: (page = 0, size = 20) =>
    unwrap(http.get<ApiResponse<PageResponse<BlogNotificationResponse>>>(`/blogs/notifications?${q({ page, size })}`)),
  unreadCount: () => unwrap(http.get<ApiResponse<number>>('/blogs/notifications/unread-count')),
  markRead: (id: number) => unwrap(http.patch<ApiResponse<BlogNotificationResponse>>(`/blogs/notifications/${id}/read`)),
  markAllRead: () => unwrap(http.patch<ApiResponse<string>>('/blogs/notifications/read-all')),
};

export const myBlogApi = {
  list: (page = 0, size = 50) =>
    unwrap(http.get<ApiResponse<PageResponse<BlogResponse>>>(`/user/blogs?${q({ page, size })}`)),
  create: (body: BlogPayload) => unwrap(http.post<ApiResponse<BlogResponse>>('/user/blogs', body)),
  update: (id: number, body: BlogPayload) => unwrap(http.put<ApiResponse<BlogResponse>>(`/user/blogs/${id}`, body)),
  remove: (id: number) => unwrap(http.delete<ApiResponse<string>>(`/user/blogs/${id}`)),
  uploadThumbnail: (id: number, image: File) =>
    unwrap(http.post<ApiResponse<string>>(`/user/blogs/${id}/thumbnail`, formData({ image }))),
};
