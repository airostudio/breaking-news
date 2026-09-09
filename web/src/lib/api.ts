import type {
  Bid,
  Listing,
  PayoutSummary,
  PublicStory,
  RequestUrlResponse,
  Role,
  Submission,
  User,
  VerificationNote,
} from "./types";

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://localhost:8787";

const TOKEN_KEY = "bno_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(
      `Could not reach BNO backend at ${API_BASE_URL}. Is the worker running? (${
        err instanceof Error ? err.message : String(err)
      })`,
      0,
    );
  }

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      data && typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed with status ${res.status}`;
    throw new ApiError(msg, res.status);
  }

  return data as T;
}

// ---------- Auth ----------

export function register(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
}) {
  return request<{ token: string; user: User }>("/api/auth/register", {
    method: "POST",
    body: input,
    auth: false,
  });
}

export function login(input: { email: string; password: string }) {
  return request<{ token: string; user: User }>("/api/auth/login", {
    method: "POST",
    body: input,
    auth: false,
  });
}

export function me() {
  return request<{ user: User }>("/api/auth/me");
}

// ---------- Uploads (contributor) ----------

export function requestUploadUrl(input: {
  filename: string;
  contentType: string;
  sizeBytes: number;
}) {
  return request<RequestUrlResponse>("/api/uploads/request-url", {
    method: "POST",
    body: input,
  });
}

export function putUploadFile(
  putUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", putUrl, true);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new ApiError(`Upload failed with status ${xhr.status}`, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Network error during upload", 0));
    xhr.send(file);
  });
}

export interface CompleteUploadInput {
  headline: string;
  description: string;
  locationText?: string;
  lat?: number | null;
  lng?: number | null;
  capturedAt: string;
  mediaType: "photo" | "video";
  contributorContactMethod: string;
  contributorContactValue: string;
  tags: string[];
}

export function completeUpload(uploadId: string, input: CompleteUploadInput) {
  return request<{ submission: Submission }>(
    `/api/uploads/${uploadId}/complete`,
    { method: "POST", body: input },
  );
}

export function myUploads() {
  return request<{ submissions: Submission[] }>("/api/uploads/mine");
}

// ---------- Newsroom (editor) ----------

export function newsroomQueue() {
  return request<{ submissions: Submission[] }>("/api/newsroom/queue");
}

export function newsroomSubmission(id: string) {
  return request<{
    submission: Submission;
    notes: VerificationNote[];
  }>(`/api/newsroom/submissions/${id}`);
}

export function addVerificationNote(
  id: string,
  input: {
    author: string;
    note: string;
    sourceType: string;
    corroborates: boolean;
  },
) {
  return request<{ note: VerificationNote }>(
    `/api/newsroom/submissions/${id}/verification-notes`,
    { method: "POST", body: input },
  );
}

export interface VerifyDecisionInput {
  decision: "verified" | "rejected";
  verificationScore: number;
  summary: string;
  listingType?: "buy_now" | "auction" | "both";
  buyNowPriceCents?: number;
  auctionEndsAt?: string;
  startingBidCents?: number;
}

export function submitVerification(id: string, input: VerifyDecisionInput) {
  return request<{ submission: Submission; listing?: Listing }>(
    `/api/newsroom/submissions/${id}/verify`,
    { method: "POST", body: input },
  );
}

// ---------- Marketplace (outlet) ----------

export function listListings(params: { status?: string; tag?: string; q?: string } = {}) {
  const usp = new URLSearchParams();
  if (params.status) usp.set("status", params.status);
  if (params.tag) usp.set("tag", params.tag);
  if (params.q) usp.set("q", params.q);
  const qs = usp.toString();
  return request<{ listings: Listing[] }>(
    `/api/marketplace/listings${qs ? `?${qs}` : ""}`,
  );
}

export function getListing(id: string) {
  return request<{ listing: Listing; bids: Bid[] }>(
    `/api/marketplace/listings/${id}`,
  );
}

export function placeBid(id: string, amountCents: number) {
  return request<{ bid: Bid; listing: Listing }>(
    `/api/marketplace/listings/${id}/bid`,
    { method: "POST", body: { amountCents } },
  );
}

export function buyNow(id: string) {
  return request<{ transaction: unknown; listing: Listing }>(
    `/api/marketplace/listings/${id}/buy-now`,
    { method: "POST" },
  );
}

export function myPurchases() {
  return request<{ listings: Listing[] }>("/api/marketplace/my-purchases");
}

// ---------- Payouts (contributor) ----------

export function payoutsSummary() {
  return request<PayoutSummary>("/api/payouts/summary");
}

export function connectPayouts() {
  return request<{ message: string; url?: string }>("/api/payouts/connect", {
    method: "POST",
  });
}

// ---------- Public ----------

export function publicStories() {
  return request<{ stories: PublicStory[] }>("/api/public/stories", {
    auth: false,
  });
}

export function publicStory(id: string) {
  return request<{ story: PublicStory }>(`/api/public/stories/${id}`, {
    auth: false,
  });
}
