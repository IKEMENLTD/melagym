// メラジム予約システム データベース型定義

export interface Store {
  id: string;
  name: string;
  area: string;
  address: string;
  google_calendar_id: string;
  business_hours: BusinessHours;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessHours {
  [day: string]: { open: string; close: string } | null; // null = 定休日
}

export interface Trainer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  specialties: string[];
  bio: string;
  is_first_visit_eligible: boolean; // 初回対応フラグ
  is_active: boolean;
  google_calendar_id: string | null; // サービスアカウント経由で取得
  available_hours: { start: string; end: string }; // 対応可能時間帯
  created_at: string;
  updated_at: string;
}

export interface TrainerStore {
  trainer_id: string;
  store_id: string;
  buffer_minutes: number; // 移動バッファ時間
}

export interface Customer {
  id: string;
  line_uid: string | null;
  name: string;
  email: string | null;
  phone: string;
  age_group: string | null;
  is_first_visit_completed: boolean;
  favorite_trainer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  customer_id: string;
  trainer_id: string;
  store_id: string;
  scheduled_at: string; // ISO datetime
  duration_minutes: number;
  booking_type: 'first_visit' | 'regular';
  status: BookingStatus;
  google_calendar_event_id: string | null;
  notes: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type BookingStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface TimeSlot {
  start: string; // ISO datetime
  end: string;
  available: boolean;
}

export interface AvailabilityCache {
  id: string;
  trainer_id: string;
  store_id: string;
  date: string; // YYYY-MM-DD
  slots: TimeSlot[];
  fetched_at: string;
}

export interface SlotLock {
  id: string;
  trainer_id: string;
  store_id: string;
  slot_start: string; // ISO datetime
  slot_end: string; // ISO datetime
  locked_at: string;
  expires_at: string;
}

// API レスポンス型
export interface AvailabilityResponse {
  trainer: Pick<Trainer, 'id' | 'name' | 'photo_url' | 'specialties'>;
  store: Pick<Store, 'id' | 'name' | 'area'>;
  slots: TimeSlot[];
}

export interface BookingRequest {
  store_id: string;
  trainer_id: string | 'auto'; // 'auto' = おまかせ
  slot_start: string;
  customer: {
    name?: string;
    email?: string;
    phone?: string;
    age_group?: string;
    line_uid?: string;
  };
  booking_type: 'first_visit' | 'regular';
}

export interface BookingResponse {
  success: boolean;
  booking?: Booking;
  error?: string;
}
