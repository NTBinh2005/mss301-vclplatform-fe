// Shapes mirror the MSS backend DTOs. Keep in sync with the Java side.

export interface AdminSummaryResponse {
  totalStudents: number | null; // null when identity-service did not answer
  totalVisits: number;
  totalVocabularies: number;
  totalBlogs: number | null; // null when social-service did not answer
}

export interface VisitTimePoint {
  label: string;
  count: number;
}

export interface VisitLogResponse {
  id: number;
  visitorType: 'USER' | 'GUEST';
  userId: number | null;
  deviceInfo: string | null;
  ipAddress: string | null;
  location: string | null;
  visitedAt: string;
}

export interface PublicStats {
  totalUsers: number | null;
  totalVocabs: number;
  satisfactionRate: number;
}
