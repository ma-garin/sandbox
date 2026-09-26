/** 予約レコード。localStorage の reservations に配列で保存する */
export interface Reservation {
  reservationNo: string; // 12 桁
  ticketType: TicketType;
  quantity: number;
  total: number;
}

export type TicketType = 'day' | 'night' | 'annual';

export type AppState = 'idle' | 'loading' | 'done' | 'error';

export interface AppConfig {
  apiBase: string;
  timeoutMs: number;
  maxRetries: number;
}
