// Shared types matching API_CONTRACT.md exactly.

export type Role = "contributor" | "outlet" | "editor" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at?: string;
}

export type MediaType = "photo" | "video";

export type SubmissionStatus =
  | "pending_verification"
  | "verified"
  | "rejected"
  | "listed"
  | "sold";

export type SourceType =
  | "on_ground_contact"
  | "witness"
  | "wire_service"
  | "cross_reference"
  | "other";

export type ListingType = "buy_now" | "auction" | "both";

export type ListingStatus = "listed" | "sold" | "closed" | "expired";

export interface Submission {
  id: string;
  contributor_id?: string;
  headline: string;
  description: string;
  location_text?: string;
  lat?: number | null;
  lng?: number | null;
  captured_at: string;
  media_type: MediaType;
  object_key?: string;
  thumbnail_key?: string;
  thumbnail_url?: string;
  media_url?: string;
  contributor_contact_method?: string;
  contributor_contact_value?: string;
  tags: string[];
  status: SubmissionStatus;
  verification_score?: number | null;
  created_at: string;
  earnings_cents?: number;
  uploader_share_cents?: number;
  listing?: Listing | null;
}

export interface VerificationNote {
  id: string;
  submission_id: string;
  author: string;
  note: string;
  source_type: SourceType;
  corroborates: boolean;
  created_at: string;
}

export interface Listing {
  id: string;
  submission_id: string;
  listing_type: ListingType;
  buy_now_price_cents?: number | null;
  starting_bid_cents?: number | null;
  auction_ends_at?: string | null;
  status: ListingStatus;
  created_at: string;
  headline?: string;
  description?: string;
  thumbnail_url?: string;
  preview_url?: string;
  tags?: string[];
  highest_bid_cents?: number | null;
}

export interface Bid {
  id: string;
  listing_id: string;
  outlet_id?: string;
  bidder_name?: string;
  amount_cents: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  listing_id: string;
  buyer_outlet_id: string;
  amount_cents: number;
  uploader_share_cents: number;
  bno_share_cents: number;
  created_at: string;
}

export interface PublicStory {
  id: string;
  headline: string;
  dek?: string;
  description?: string;
  thumbnail_url?: string;
  media_url?: string;
  outlet_credit?: string;
  location_text?: string;
  captured_at?: string;
  created_at?: string;
  tags?: string[];
}

export interface PayoutSummary {
  lifetime_earnings_cents: number;
  pending_cents: number;
  paid_cents: number;
  breakdown: {
    submission_id: string;
    headline: string;
    amount_cents: number;
    uploader_share_cents: number;
    status: string;
    created_at: string;
  }[];
}

export interface RequestUrlResponse {
  uploadId: string;
  putUrl: string;
  objectKey: string;
}
