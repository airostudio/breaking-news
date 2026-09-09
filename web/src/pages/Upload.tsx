import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import * as api from "../lib/api";

type Step = 1 | 2 | 3;

interface FormState {
  headline: string;
  description: string;
  locationText: string;
  lat: string;
  lng: string;
  capturedAt: string;
  mediaType: "photo" | "video";
  contactMethod: string;
  contactValue: string;
  tags: string[];
}

const initialForm: FormState = {
  headline: "",
  description: "",
  locationText: "",
  lat: "",
  lng: "",
  capturedAt: "",
  mediaType: "photo",
  contactMethod: "whatsapp",
  contactValue: "",
  tags: [],
};

export default function Upload() {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [tagInput, setTagInput] = useState("");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function pickFile(f: File) {
    setFile(f);
    setForm((s) => ({
      ...s,
      mediaType: f.type.startsWith("video") ? "video" : "photo",
    }));
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      setForm((s) => ({ ...s, tags: [...s.tags, t] }));
    }
    setTagInput("");
  }

  function removeTag(t: string) {
    setForm((s) => ({ ...s, tags: s.tags.filter((x) => x !== t) }));
  }

  function goToReview(e: FormEvent) {
    e.preventDefault();
    setStep(3);
  }

  async function submit() {
    if (!file) return;
    setError(null);
    setPhase("uploading");
    setProgress(0);
    try {
      const { uploadId, putUrl } = await api.requestUploadUrl({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });

      await api.putUploadFile(putUrl, file, setProgress);

      setPhase("saving");
      const { submission } = await api.completeUpload(uploadId, {
        headline: form.headline,
        description: form.description,
        locationText: form.locationText || undefined,
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
        capturedAt: form.capturedAt
          ? new Date(form.capturedAt).toISOString()
          : new Date().toISOString(),
        mediaType: form.mediaType,
        contributorContactMethod: form.contactMethod,
        contributorContactValue: form.contactValue,
        tags: form.tags,
      });

      setSubmissionId(submission.id);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
    }
  }

  if (phase === "done") {
    return (
      <div className="page container">
        <div className="auth-shell">
          <div className="form-success">
            Your submission has been received and is now with our verification desk.
          </div>
          <p>
            Submission ID: <code>{submissionId}</code>
          </p>
          <p>
            Our research desk may reach out via your provided contact method to
            corroborate the footage before it goes to market.
          </p>
          <Link className="btn btn-primary" to="/dashboard">
            View my dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page container">
      <div className="page-header">
        <div className="eyebrow">Contributor Upload Portal</div>
        <h1>Submit Breaking Footage</h1>
        <p className="lead">
          Upload raw photo or video from the scene. Our newsroom verifies every
          submission before it is licensed to outlets.
        </p>
      </div>

      <div className="stepper">
        <div className={`step ${step === 1 ? "active" : step > 1 ? "done" : ""}`}>1. Media</div>
        <div className={`step ${step === 2 ? "active" : step > 2 ? "done" : ""}`}>2. Details</div>
        <div className={`step ${step === 3 ? "active" : ""}`}>3. Review &amp; Submit</div>
      </div>

      {step === 1 && (
        <div className="panel">
          <div
            className={`dropzone ${dragOver ? "drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={onFileChange}
            />
            <p style={{ margin: 0, fontWeight: 600 }}>
              Drag &amp; drop your photo or video here
            </p>
            <p style={{ margin: "6px 0 0" }}>or click to browse files</p>
          </div>

          {file && (
            <div className="file-preview" style={{ marginTop: 16 }}>
              {file.type.startsWith("video") ? (
                <video src={URL.createObjectURL(file)} muted />
              ) : (
                <img src={URL.createObjectURL(file)} alt="preview" />
              )}
              <div>
                <div style={{ fontWeight: 600 }}>{file.name}</div>
                <div className="hint">{(file.size / 1_000_000).toFixed(1)} MB &middot; {file.type || "unknown type"}</div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
            <button
              className="btn btn-primary"
              type="button"
              disabled={!file}
              onClick={() => setStep(2)}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <form className="panel" onSubmit={goToReview}>
          <div className="form-field">
            <label htmlFor="headline">Headline</label>
            <input
              id="headline"
              type="text"
              required
              value={form.headline}
              onChange={(e) => setForm((s) => ({ ...s, headline: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              required
              rows={5}
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="locationText">Location</label>
              <input
                id="locationText"
                type="text"
                placeholder="City, region, landmark"
                value={form.locationText}
                onChange={(e) => setForm((s) => ({ ...s, locationText: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="capturedAt">Captured at</label>
              <input
                id="capturedAt"
                type="datetime-local"
                required
                value={form.capturedAt}
                onChange={(e) => setForm((s) => ({ ...s, capturedAt: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="lat">Latitude (optional)</label>
              <input
                id="lat"
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => setForm((s) => ({ ...s, lat: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="lng">Longitude (optional)</label>
              <input
                id="lng"
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => setForm((s) => ({ ...s, lng: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="mediaType">Media type</label>
            <select
              id="mediaType"
              value={form.mediaType}
              onChange={(e) =>
                setForm((s) => ({ ...s, mediaType: e.target.value as "photo" | "video" }))
              }
            >
              <option value="photo">Photo</option>
              <option value="video">Video</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="tags">Tags</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="tags"
                type="text"
                placeholder="e.g. wildfire, downtown, protest"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <button type="button" className="btn btn-outline" onClick={addTag}>
                Add
              </button>
            </div>
            {form.tags.length > 0 && (
              <div className="tag-list">
                {form.tags.map((t) => (
                  <span className="tag-pill" key={t}>
                    {t}
                    <button type="button" onClick={() => removeTag(t)} aria-label={`Remove ${t}`}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="contactMethod">Research desk contact method</label>
            <span className="hint">
              So our research desk can verify your footage with you — we may reach
              out to confirm details before this goes to market.
            </span>
            <select
              id="contactMethod"
              value={form.contactMethod}
              onChange={(e) => setForm((s) => ({ ...s, contactMethod: e.target.value }))}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Phone</option>
              <option value="email">Email</option>
              <option value="signal">Signal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="contactValue">Contact value</label>
            <input
              id="contactValue"
              type="text"
              required
              placeholder="Phone number, email, or handle"
              value={form.contactValue}
              onChange={(e) => setForm((s) => ({ ...s, contactValue: e.target.value }))}
            />
          </div>

          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
            <button className="btn btn-outline" type="button" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="btn btn-primary" type="submit">
              Review submission
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div className="panel">
          {error && <div className="form-error">{error}</div>}

          <dl className="review-grid">
            <dt>File</dt>
            <dd>{file?.name}</dd>
            <dt>Headline</dt>
            <dd>{form.headline}</dd>
            <dt>Description</dt>
            <dd>{form.description}</dd>
            <dt>Location</dt>
            <dd>{form.locationText || "—"} {form.lat && form.lng ? `(${form.lat}, ${form.lng})` : ""}</dd>
            <dt>Captured</dt>
            <dd>{form.capturedAt || "—"}</dd>
            <dt>Media type</dt>
            <dd>{form.mediaType}</dd>
            <dt>Tags</dt>
            <dd>{form.tags.join(", ") || "—"}</dd>
            <dt>Contact</dt>
            <dd>
              {form.contactMethod}: {form.contactValue}
            </dd>
          </dl>

          {phase === "uploading" && (
            <div style={{ margin: "20px 0" }}>
              <div className="hint" style={{ marginBottom: 6 }}>
                Uploading media… {progress}%
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {phase === "saving" && (
            <div className="hint" style={{ margin: "20px 0" }}>
              Saving submission details…
            </div>
          )}

          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => setStep(2)}
              disabled={phase === "uploading" || phase === "saving"}
            >
              Back
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={submit}
              disabled={phase === "uploading" || phase === "saving"}
            >
              {phase === "uploading" || phase === "saving" ? "Submitting…" : "Submit to newsroom"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
