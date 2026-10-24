// Shapes mirror the MSS backend DTOs / DB entities. Keep in sync with the Java side.
import type { PageResponse } from './common';

export type BlogStatus = 'DRAFT' | 'PUBLISHED' | 'REMOVED';

export interface BlogResponse {
  id: number;
  title: string;
  content: string;
  thumbnailUrl: string | null;
  status: BlogStatus;
  authorId: number | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  followedAuthor: boolean;
  friendWithAuthor: boolean;
  deletionReason: string | null; // only when REMOVED, only visible to the author
}

export interface BlogReplyResponse {
  id: number;
  commentId: number;
  userId: number | null;
  userName: string | null;
  userAvatar: string | null;
  mentionedUserId: number | null;
  mentionedUserName: string | null;
  content: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
}

export interface BlogCommentResponse extends Omit<BlogReplyResponse, 'commentId'> {
  blogId: number;
  replies?: BlogReplyResponse[];
  replyCount: number;
}

export interface LikeToggleResponse {
  liked: boolean;
  likeCount: number;
}

export interface BlogUserSummary {
  userId: number;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  followerCount: number;
  followingCount: number;
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
}

export interface BlogSearchResponse {
  blogs: PageResponse<BlogResponse>;
  users: PageResponse<BlogUserSummary>;
}

export interface BlogNotificationResponse {
  id: number;
  type: 'MENTION' | 'SHARE';
  read: boolean;
  message: string;
  actorId: number | null;
  actorName: string | null;
  actorAvatar: string | null;
  blogId: number | null;
  blogTitle: string | null;
  createdAt: string;
}

export interface BlogReportResponse {
  id: number;
  reason: string;
  status: 'PENDING' | 'RESOLVED';
  createdAt: string;
  resolvedAt: string | null;
  reporterName: string | null;
  blogId: number | null;
  blogTitle: string | null;
  blogContent: string | null;
  blogStatus: BlogStatus | null;
  blogAuthorName: string | null;
}

export interface BlogPayload {
  title: string;
  content: string;
  status?: BlogStatus;
}
