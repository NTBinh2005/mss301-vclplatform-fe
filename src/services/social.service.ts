import { formData, http } from '../api/client';
import type {
  ApiResponse, BlogPayload, BlogResponse, BlogSearchResponse, CommentLikeResponse, CommentResponse,
  FollowStatusResponse, LikeResponse, LikerResponse, NotificationResponse, PageResponse,
  ReplyResponse, ShareResponse, ShareType, SharedBlogResponse, SocialUserResponse,
} from '../models';
import { q, unwrap } from './shared';

/* =====================  social-service  /api/blogs, /api/comments  ===================== */
export const blogApi = {
  // Public feed; signed-in readers see people they follow first.
  published: (page = 0, size = 10, keyword?: string) =>
    unwrap(http.get<ApiResponse<PageResponse<BlogResponse>>>(`/blogs?${q({ keyword, page, size })}`)),
  get: (id: number) => unwrap(http.get<ApiResponse<BlogResponse>>(`/blogs/${id}`)),
  search: (keyword: string, page = 0, size = 10) =>
    unwrap(http.get<ApiResponse<BlogSearchResponse>>(`/blogs/search?${q({ keyword, page, size })}`)),
  // The author themself (and admins) also get drafts and posts removed by a moderator.
  byAuthor: (userId: number, page = 0, size = 20) =>
    unwrap(http.get<ApiResponse<PageResponse<BlogResponse>>>(`/blogs/user/${userId}?${q({ page, size })}`)),
  sharedOnProfile: (userId: number, page = 0, size = 20) =>
    unwrap(http.get<ApiResponse<PageResponse<SharedBlogResponse>>>(`/blogs/user/${userId}/shared?${q({ page, size })}`)),

  create: (body: BlogPayload) => unwrap(http.post<ApiResponse<BlogResponse>>('/blogs', body, { timeout: 60000 })),
  update: (id: number, body: BlogPayload) =>
    unwrap(http.put<ApiResponse<BlogResponse>>(`/blogs/${id}`, body, { timeout: 60000 })),
  remove: (id: number) => unwrap(http.delete<ApiResponse<void>>(`/blogs/${id}`)),
  uploadThumbnail: (id: number, image: File) =>
    unwrap(http.post<ApiResponse<BlogResponse>>(`/blogs/${id}/thumbnail`, formData({ image }), { timeout: 60000 })),
  removeThumbnail: (id: number) => unwrap(http.delete<ApiResponse<BlogResponse>>(`/blogs/${id}/thumbnail`)),

  like: (id: number) => unwrap(http.post<ApiResponse<LikeResponse>>(`/blogs/${id}/likes`)),
  unlike: (id: number) => unwrap(http.delete<ApiResponse<LikeResponse>>(`/blogs/${id}/likes`)),
  likers: (id: number, page = 0, size = 50) =>
    unwrap(http.get<ApiResponse<PageResponse<LikerResponse>>>(`/blogs/${id}/likes?${q({ page, size })}`)),
  // COPY_URL just counts the share; PROFILE pins it to your own page, or a friend's (recipientUserId).
  share: (id: number, shareType: ShareType = 'COPY_URL', recipientUserId?: number) =>
    unwrap(http.post<ApiResponse<ShareResponse>>(`/blogs/${id}/shares`, { shareType, recipientUserId: recipientUserId ?? null })),
  report: (id: number, reason: string) => unwrap(http.post<ApiResponse<void>>(`/blogs/${id}/reports`, { reason })),

  comments: (blogId: number, page = 0, size = 50) =>
    unwrap(http.get<ApiResponse<PageResponse<CommentResponse>>>(`/blogs/${blogId}/comments?${q({ page, size })}`)),
  // Comments and replies go through AI moderation, which can take a few seconds.
  addComment: (blogId: number, content: string, mentionedUserId?: number | null) =>
    unwrap(http.post<ApiResponse<CommentResponse>>(`/blogs/${blogId}/comments`, { content, mentionedUserId: mentionedUserId ?? null }, { timeout: 45000 })),
  updateComment: (id: number, content: string, mentionedUserId?: number | null) =>
    unwrap(http.put<ApiResponse<CommentResponse>>(`/comments/${id}`, { content, mentionedUserId: mentionedUserId ?? null }, { timeout: 45000 })),
  deleteComment: (id: number) => unwrap(http.delete<ApiResponse<void>>(`/comments/${id}`)),
  likeComment: (id: number) => unwrap(http.post<ApiResponse<CommentLikeResponse>>(`/comments/${id}/like`)),
  unlikeComment: (id: number) => unwrap(http.delete<ApiResponse<CommentLikeResponse>>(`/comments/${id}/like`)),

  replies: (commentId: number, page = 0, size = 50) =>
    unwrap(http.get<ApiResponse<PageResponse<ReplyResponse>>>(`/comments/${commentId}/replies?${q({ page, size })}`)),
  addReply: (commentId: number, content: string, mentionedUserId?: number | null) =>
    unwrap(http.post<ApiResponse<ReplyResponse>>(`/comments/${commentId}/replies`, { content, mentionedUserId: mentionedUserId ?? null }, { timeout: 45000 })),
  updateReply: (id: number, content: string, mentionedUserId?: number | null) =>
    unwrap(http.put<ApiResponse<ReplyResponse>>(`/comments/replies/${id}`, { content, mentionedUserId: mentionedUserId ?? null }, { timeout: 45000 })),
  deleteReply: (id: number) => unwrap(http.delete<ApiResponse<void>>(`/comments/replies/${id}`)),
  likeReply: (id: number) => unwrap(http.post<ApiResponse<CommentLikeResponse>>(`/comments/replies/${id}/like`)),
  unlikeReply: (id: number) => unwrap(http.delete<ApiResponse<CommentLikeResponse>>(`/comments/replies/${id}/like`)),
};

/* =====================  social-service  /api/follows  ===================== */
export const followApi = {
  follow: (userId: number) => unwrap(http.post<ApiResponse<FollowStatusResponse>>(`/follows/${userId}`)),
  unfollow: (userId: number) => unwrap(http.delete<ApiResponse<FollowStatusResponse>>(`/follows/${userId}`)),
  stats: (userId: number) => unwrap(http.get<ApiResponse<FollowStatusResponse>>(`/follows/${userId}/stats`)),
  followers: (userId: number, page = 0, size = 50) =>
    unwrap(http.get<ApiResponse<PageResponse<SocialUserResponse>>>(`/follows/${userId}/followers?${q({ page, size })}`)),
  following: (userId: number, page = 0, size = 50) =>
    unwrap(http.get<ApiResponse<PageResponse<SocialUserResponse>>>(`/follows/${userId}/following?${q({ page, size })}`)),
  friends: (userId: number, page = 0, size = 50) =>
    unwrap(http.get<ApiResponse<PageResponse<SocialUserResponse>>>(`/follows/${userId}/friends?${q({ page, size })}`)),
};

/* =====================  social-service  /api/notifications  ===================== */
export const notificationApi = {
  list: (page = 0, size = 20) =>
    unwrap(http.get<ApiResponse<PageResponse<NotificationResponse>>>(`/notifications?${q({ page, size })}`)),
  unreadCount: () => unwrap(http.get<ApiResponse<number>>('/notifications/unread-count')),
  markRead: (id: number) => unwrap(http.patch<ApiResponse<NotificationResponse>>(`/notifications/${id}/read`)),
  markAllRead: () => unwrap(http.patch<ApiResponse<number>>('/notifications/read-all')),
};
