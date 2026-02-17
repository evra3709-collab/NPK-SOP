
export interface Attachment {
  name: string;
  type: string;
  data: string; // Base64 string
}

export interface MaintenanceReport {
  id: string; // 내부 식별자
  notificationNo: string; // 통지번호 (사용자 입력)
  equipmentName: string;
  workDept: string; // 작업부서
  workContent: string;
  failDate: string;
  failTime: string;
  cause: string;
  action: string;
  createdAt: string;
  aiInsights?: string;
  attachments?: Attachment[];
  isCompleted?: boolean; // 작업 완료 여부
  isArchived?: boolean; // 보관 여부
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  isPinned: boolean;
  attachments?: Attachment[];
}

export interface DashboardStats {
  totalReports: number;
  recentFailures: number;
  aiAnalyzed: number;
}
