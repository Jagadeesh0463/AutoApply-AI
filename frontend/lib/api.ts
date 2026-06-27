const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function extractFromImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/extract/from-image`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function extractFromText(text: string) {
  const form = new FormData();
  form.append("jd_text", text);
  const res = await fetch(`${BASE}/extract/from-text`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function matchProfile(jd: any) {
  // Strip job_id — /match expects only JobDescription fields
  const { job_id, ...jobDescription } = jd;
  const res = await fetch(`${BASE}/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jobDescription),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateResume(jobId: number, jd: any) {
  // Strip job_id from jd before sending as job_description
  const { job_id, ...jobDescription } = jd;
  const res = await fetch(`${BASE}/generate-resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, job_description: jobDescription }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function draftEmail(jobId: number, recipientEmail: string) {
  const res = await fetch(`${BASE}/email/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, recipient_email: recipientEmail }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getProfile() {
  const res = await fetch(`${BASE}/profile`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadResume(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/profile/upload-resume`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function resumeDownloadUrl(jobId: number) {
  return `${BASE}/generate-resume/download/${jobId}`;
}

export async function getEmailDrafts() {
  const res = await fetch(`${BASE}/email/drafts`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sendEmail(draftId: number, subject?: string, body?: string) {
  const res = await fetch(`${BASE}/email/send/${draftId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject: subject || null, body: body || null }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getGmailStatus() {
  const res = await fetch(`${BASE}/auth/gmail/status`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const GMAIL_AUTH_URL = `${BASE}/auth/gmail`;
