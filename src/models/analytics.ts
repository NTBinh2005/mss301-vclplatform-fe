// Shapes mirror the MSS backend DTOs / DB entities. Keep in sync with the Java side.

export interface AdminSummaryResponse {
  totalStudents: number;
  totalVisits: number;
  totalVocabularies: number;
  totalBlogs: number;
}

export interface VisitTimePoint {
  label: string;
  count: number;
}

export interface PublicStats {
  totalUsers: number;
  totalVocabs: number;
  satisfactionRate: number;
}
