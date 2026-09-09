// Shared types: environment bindings and domain rows.

export type Role = "contributor" | "outlet" | "editor" | "admin";

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  CORS_ORIGIN: string;
  SESSION_SECRET: string;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: string;
}

export interface SessionRow {
  token: string;
  user_id: string;
  expires_at: string;
}

export type SubmissionStatus =
  | "pending_verification"
  | "verified"
  | "rejected"
  | "listed"
  | "sold";

export interface SubmissionRow {
  id: string;
  contributor_id: string;
  headline: string;
  description: string;
  location_text: string | null;
  lat: number | null;
  lng: number | null;
  captured_at: string | null;
  media_type: "photo" | "video";
  object_key: string;
  thumbnail_key: string | null;
  contributor_contact_method: string | null;
  contributor_contact_value: string | null;
  tags_json: string;
  status: SubmissionStatus;
  verification_score: number | null;
  created_at: string;
}

export interface VerificationNoteRow {
  id: string;
  submission_id: string;
  author: string;
  note: string;
  source_type: "on_ground_contact" | "witness" | "wire_service" | "cross_reference" | "other";
  corroborates: number; // sqlite boolean (0/1)
  created_at: string;
}

export type ListingType = "buy_now" | "auction" | "both";
export type ListingStatus = "listed" | "sold" | "closed" | "cancelled";

export interface ListingRow {
  id: string;
  submission_id: string;
  listing_type: ListingType;
  buy_now_price_cents: number | null;
  starting_bid_cents: number | null;
  auction_ends_at: string | null;
  status: ListingStatus;
  created_at: string;
}

export interface BidRow {
  id: string;
  listing_id: string;
  outlet_id: string;
  amount_cents: number;
  created_at: string;
}

export interface TransactionRow {
  id: string;
  listing_id: string;
  buyer_outlet_id: string;
  amount_cents: number;
  uploader_share_cents: number;
  bno_share_cents: number;
  created_at: string;
}
