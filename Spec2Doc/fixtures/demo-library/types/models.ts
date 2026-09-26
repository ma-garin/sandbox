// API の入出力の型（サーバ側の仕様に合わせる）

export type MemberType = 'general' | 'student' | 'staff';
export type LoanState = 'reserved' | 'onLoan' | 'returned' | 'overdue';

export interface Book {
  /** ISBN（13 桁の数字） */
  isbn: string;
  /** 書名（最大 200 文字） */
  title: string;
  /** 著者名（最大 100 文字） */
  author: string;
  /** 分類コード（2 桁） */
  category: string;
  /** 貸出可能か */
  available: boolean;
}

export interface Member {
  /** 会員番号（M + 数字 6 桁、計 7 桁） */
  id: string;
  /** 氏名（最大 50 文字） */
  name: string;
  type: MemberType;
  /** 現在の貸出冊数（0〜10） */
  currentLoans: number;
  hasOverdue: boolean;
  suspended?: boolean;
  studentCardValid?: boolean;
}

export interface Loan {
  /** 貸出番号（L + 数字 8 桁、計 9 桁） */
  id: string;
  memberId: string;
  isbn: string;
  /** 返却期限（YYYY-MM-DD、10 桁） */
  dueDate: string;
  state: LoanState;
  /** 延滞日数（0〜365） */
  overdueDays: number;
}
