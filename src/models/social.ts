// Shapes mirror the MSS backend DTOs (social-service). Keep in sync with the Java side.
import type { PageResponse } from './common';

export type BlogStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN';

/** UserBriefResponse — social-service resolves names/avatars from identity in batches. */
export interface UserBrief {
  userId: number;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  displayName: string | null;
}

/**
 * BlogResponse (lists, `excerpt`) and BlogDetailResponse (single post, `content`)
 * share every other field, so the UI treats them as one type. Read the text with
 * `postBody()`.
 */
export interface BlogResponse {
  id: number;
  author: UserBrief | null;
  title: string;
  excerpt?: string;
  content?: string;
  thumbnailUrl: string | null;
  status: BlogStatus;
  deletionReason: string | null; // only when HIDDEN, only visible to the author / admin
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByMe: boolean;
  followedAuthor: boolean;
  friendWithAuthor: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommentResponse {
  id: number;
  blogId: number;
  user: UserBrief | null;
  mentionedUser: UserBrief | null;
  content: string;
  replyCount: number;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReplyResponse {
  id: number;
  commentId: number;
  user: UserBrief | null;
  mentionedUser: UserBrief | null;
  content: string;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LikeResponse {
  blogId: number;
  liked: boolean;
  likeCount: number;
}

export interface CommentLikeResponse {
  targetId: number;
  liked: boolean;
  likeCount: number;
}

export interface LikerResponse {
  user: UserBrief | null;
  likedAt: string;
}

export interface SocialUserResponse {
  userId: number;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  displayName: string | null;
  followerCount: number;
  followingCount: number;
  friendCount: number;
  followedByMe: boolean;
  followsMe: boolean;
  friend: boolean;
}

export interface FollowStatusResponse {
  targetUserId: number;
  followedByMe: boolean;
  followsMe: boolean;
  friend: boolean;
  followerCount: number;
  followingCount: number;
  friendCount: number;
}

export interface BlogSearchResponse {
  blogs: PageResponse<BlogResponse>;
  users: PageResponse<SocialUserResponse>;
}

export type NotificationType = 'LIKE' | 'COMMENT' | 'REPLY' | 'SHARE' | 'FOLLOW' | 'MENTION';

export interface NotificationResponse {
  id: number;
  type: NotificationType;
  actor: UserBrief | null;
  blogId: number | null;
  blogTitle: string | null;
  commentId: number | null;
  replyId: number | null;
  read: boolean;
  createdAt: string;
}

export type ShareType = 'COPY_URL' | 'PROFILE';

export interface ShareResponse {
  shareCount: number;
  blogUrl: string;
  shareType: ShareType;
  recipient: UserBrief | null;
}

export interface SharedBlogResponse {
  shareId: number;
  sharedBy: UserBrief | null;
  shareType: ShareType;
  sharedAt: string;
  blog: BlogResponse;
}

export type ReportStatus = 'PENDING' | 'RESOLVED' | 'REJECTED';

export interface ReportResponse {
  id: number;
  blogId: number | null;
  blogTitle: string | null;
  blogStatus: BlogStatus | null;
  reporter: UserBrief | null;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDetailResponse {
  id: number;
  blogId: number | null;
  blogTitle: string | null;
  blogContent: string | null;
  blogThumbnailUrl: string | null;
  blogStatus: BlogStatus | null;
  deletionReason: string | null;
  author: UserBrief | null;
  reporter: UserBrief | null;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SocialOverview {
  totalBlogs: number;
  publishedBlogs: number;
  hiddenBlogs: number;
  draftBlogs: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  pendingReports: number;
  resolvedReports: number;
  rejectedReports: number;
}

export interface BlogPayload {
  title: string;
  content: string;
  status?: 'DRAFT' | 'PUBLISHED';
}
