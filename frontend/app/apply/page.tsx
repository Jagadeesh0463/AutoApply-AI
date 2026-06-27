"use client";
import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import {
  extractFromImage, extractFromText, matchProfile,
  generateResume, draftEmail, sendEmail,
  getGmailStatus, resumeDownloadUrl, GMAIL_AUTH_URL,
} from "@/lib/api";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

const STEPS = ["Upload", "Review JD", "Match Score", "Resume", "Email"];

const LOADING_MESSAGES: Record<string, string> = {
  extract:  "Analysing job posting with Groq Vision...",
  match:    "Matching your profile against the JD...",
  resume:   "Generating tailored resume with Groq LLM...",
  email:    "Drafting personalised cold email...",
  send:     "Sending via Gmail with resume attached...",
};

export default function ApplyPage() {
  const { toast } = useToast();

  const [step, setStep]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingKey, setLoadingKey] = useState<keyof typeof LOADING_MESSAGES>("extract");
  const [error, setError]     = useState("");

  // Data state
  const [file, setFile]         = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [useText, setUseText]   = useState(false);
  const [jd, setJd]             = useState<any>(null);
  const [jobId, setJobId]       = useState<number | null>(null);
  const [matchResult, setMatchResult]   = useState<any>(null);
  const [resumeResult, setResumeResult] = useState<any>(null);
  const [emailResult, setEmailResult]   = useState<any>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody]       = useState("");
  const [sendResult, setSendResult]       = useState<any>(null);
  const [gmailAuthorized, setGmailAuthorized] = useState<boolean | null>(null);
  const [recipientEmail, setRecipientEmail]   = useState("");

  // JD inline editing
  const [editingField, setEditingField] = useState<"role" | "company" | "exp" | null>(null);
  const [editRole,    setEditRole]    = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editExp,     setEditExp]     = useState("");

  // Confirmation dialog
  const [confirmOpen, setConfirmOpen] = useState(false);

  const run = async (key: keyof typeof LOADING_MESSAGES, fn: () => Promise<void>) => {
    setError("");
    setLoading(true);
    setLoadingKey(key);
    try {
      await fn();
    } catch (e: any) {
      const msg = e.message || "Something went wrong";
      setError(msg);
      toast(msg, "error");
    }
    setLoading(false);
  };

  // Step 1 → Extract JD
  const handleExtract = () => run("extract", async () => {
    if (!useText && !file) throw new Error("Please select a job screenshot.");
    if (useText && !pasteText.trim()) throw new Error("Please paste a job description.");
    const data = useText ? await extractFromText(pasteText) : await extractFromImage(file!);
    setJd(data);
    setJobId(data.job_id);
    setEditRole(data.job_title ?? "");
    setEditCompany(data.company_name ?? "");
    setEditExp(data.minimum_years_experience ? String(data.minimum_years_experience) : "");
    setStep(1);
    toast(
      `✓ Job Description extracted successfully\nRole: ${data.job_title}\nCompany: ${data.company_name}`,
      "success"
    );
  });

  // Step 2 → Match
  const handleMatch = () => run("match", async () => {
    const result = await matchProfile(jd);
    setMatchResult(result);
    setStep(2);
    const pct = Math.round(result.match_score * 100);
    toast(`Match score: ${pct}%`, pct >= 70 ? "success" : pct >= 50 ? "warning" : "info");
  });

  // Step 3 → Generate Resume
  const handleResume = () => run("resume", async () => {
    const result = await generateResume(jobId!, jd);
    setResumeResult(result);
    setStep(3);
    toast("ATS-safe resume PDF generated ✅", "success");
  });

  // Step 4 → Draft Email
  const handleEmail = () => run("email", async () => {
    if (!recipientEmail.trim()) throw new Error("Please enter the recipient email.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) throw new Error("Please enter a valid email address.");
    const result = await draftEmail(jobId!, recipientEmail);
    setEmailResult(result);
    setEditedSubject(result.subject);
    setEditedBody(result.body);
    const gmailStatus = await getGmailStatus();
    setGmailAuthorized(gmailStatus.authorized);
    setStep(4);
    toast("Cold email drafted — review before sending", "success");
  });

  // Step 4 → Confirm then Send
  const handleSendConfirm = () => {
    if (!editedSubject.trim()) { toast("Subject cannot be empty.", "warning"); return; }
    if (!editedBody.trim())    { toast("Email body cannot be empty.", "warning"); return; }
    setConfirmOpen(true);
  };

  const handleSend = () => run("send", async () => {
    setConfirmOpen(false);
    if (!emailResult?.draft_id) throw new Error("No draft to send.");
    const result = await sendEmail(emailResult.draft_id, editedSubject, editedBody);
    setSendResult(result);
    toast(`Email sent to ${result.sent_to} with resume attached 🎉`, "success");
  });

  const scoreColor = (s: number) =>
    s >= 0.75 ? "text-green-600" : s >= 0.5 ? "text-yellow-600" : "text-red-500";

  const scoreBg = (s: number) =>
    s >= 0.75 ? "bg-green-50 border-green-200" : s >= 0.5 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">New Application</h1>
        <p className="text-slate-500 text-sm mt-1">Follow the steps to apply automatically</p>
      </div>

      {/* Step progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => { if (i < step) setStep(i); }}
              disabled={i >= step}
              aria-label={`Step ${i + 1}: ${s}`}
              className={`flex items-center gap-2 ${i < step ? "cursor-pointer" : "cursor-default"} ${i <= step ? "text-indigo-600" : "text-slate-400"}`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                i < step  ? "bg-indigo-600 border-indigo-600 text-white" :
                i === step ? "border-indigo-600 text-indigo-600 bg-white" :
                "border-slate-300 text-slate-400 bg-white"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className="text-xs font-medium hidden sm:block">{s}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 transition-colors ${i < step ? "bg-indigo-600" : "bg-slate-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm flex items-start gap-2">
          <span>❌</span>
          <span>{error}</span>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-3">
          <span className="spinner" style={{ borderColor: "rgba(99,102,241,0.3)", borderTopColor: "#4f46e5" }} />
          <span className="text-indigo-700 font-medium">{LOADING_MESSAGES[loadingKey]}</span>
        </div>
      )}

      {/* ── Step 0 — Upload ── */}
      {step === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Upload Job Posting</h2>
          <div className="flex gap-3 mb-5">
            <button
              onClick={() => setUseText(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${!useText ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-300 text-slate-600 hover:border-indigo-300"}`}
            >
              📷 Screenshot
            </button>
            <button
              onClick={() => setUseText(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${useText ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-300 text-slate-600 hover:border-indigo-300"}`}
            >
              📝 Paste Text
            </button>
          </div>

          {!useText ? (
            <label className="block border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)}
                aria-label="Upload job screenshot"
              />
              {file ? (
                <div>
                  <p className="text-2xl mb-2">✅</p>
                  <p className="text-indigo-600 font-medium">{file.name}</p>
                  <p className="text-slate-400 text-xs mt-1">Click to change</p>
                </div>
              ) : (
                <div>
                  <p className="text-3xl mb-2">📸</p>
                  <p className="text-slate-700 font-medium">Click to upload job screenshot</p>
                  <p className="text-slate-400 text-sm mt-1">PNG, JPG — any job board</p>
                </div>
              )}
            </label>
          ) : (
            <textarea
              className="w-full border border-slate-300 rounded-xl p-4 text-sm text-slate-700 h-48 resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300"
              placeholder="Paste the full job description here..."
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              aria-label="Job description text"
            />
          )}

          <button
            onClick={handleExtract}
            disabled={loading || (!useText && !file) || (useText && !pasteText.trim())}
            className="mt-5 w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <><span className="spinner" />Extracting JD...</>
            ) : "Extract Job Description →"}
          </button>
        </div>
      )}

      {/* ── Step 1 — Review JD ── */}
      {step === 1 && jd && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <button onClick={() => setStep(0)} className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1 transition-colors">
            ← Back
          </button>

          {/* Header row: title + confidence badge */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Review Extracted JD</h2>
            <span className="text-xs font-medium bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full">
              {useText ? "99%" : "97%"} confidence
            </span>
          </div>

          {/* Role — editable */}
          <EditableField
            label="Role"
            value={editRole}
            editing={editingField === "role"}
            onEdit={() => { setEditingField("role"); }}
            onSave={v => { setEditRole(v); setEditingField(null); setJd((prev: any) => ({ ...prev, job_title: v })); }}
            onCancel={() => setEditingField(null)}
          />

          {/* Company + Experience inline */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <EditableField
              label="Company"
              value={editCompany}
              editing={editingField === "company"}
              onEdit={() => setEditingField("company")}
              onSave={v => { setEditCompany(v); setEditingField(null); setJd((prev: any) => ({ ...prev, company_name: v })); }}
              onCancel={() => setEditingField(null)}
            />
            <EditableField
              label="Experience"
              value={editExp ? `${editExp}+ years` : "Not specified"}
              editing={editingField === "exp"}
              onEdit={() => setEditingField("exp")}
              onSave={v => { setEditExp(v.replace(/[^0-9]/g, "")); setEditingField(null); }}
              onCancel={() => setEditingField(null)}
              inputValue={editExp}
              placeholder="e.g. 2"
            />
          </div>

          {/* Skills */}
          <div className="bg-slate-50 rounded-xl p-4 mb-3">
            <p className="text-xs text-slate-500 mb-2">
              Required Skills
              {jd.required_skills?.length > 0 && (
                <span className="ml-1 text-slate-400">({jd.required_skills.length})</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {jd.required_skills?.map((s: string) => (
                <span key={s} className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </div>

          {/* Responsibilities */}
          <div className="bg-slate-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-slate-500 mb-2">Responsibilities</p>
            <ul className="space-y-1.5">
              {jd.core_responsibilities?.map((r: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-green-500 font-bold mt-0.5 flex-shrink-0">✓</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Helper text */}
          <p className="text-xs text-slate-400 mb-4 text-center">
            Review the extracted details before matching your profile.
          </p>

          {/* Sticky-ish CTA */}
          <div className="sticky bottom-4">
            <button
              onClick={handleMatch}
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
            >
              {loading ? <><span className="spinner" />Matching Profile...</> : "Match My Profile →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 — Match Score ── */}
      {step === 2 && matchResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1 transition-colors">
            ← Back
          </button>
          <h2 className="font-semibold text-slate-800 mb-4">Profile Match Score</h2>

          {/* Big score */}
          <div className={`rounded-2xl border p-6 text-center mb-5 ${scoreBg(matchResult.match_score)}`}>
            <p className={`text-6xl font-bold ${scoreColor(matchResult.match_score)}`}>
              {Math.round(matchResult.match_score * 100)}%
            </p>
            <p className="text-slate-500 text-sm mt-1">Overall ATS Match</p>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Semantic", value: matchResult.breakdown?.sbert, tip: "SBERT" },
              { label: "Keywords", value: matchResult.breakdown?.tfidf, tip: "TF-IDF" },
              { label: "Skills",   value: matchResult.breakdown?.boolean, tip: "Boolean" },
            ].map(b => (
              <div key={b.label} className="bg-slate-50 rounded-xl p-3 text-center" title={b.tip}>
                <p className={`text-lg font-bold ${scoreColor(b.value || 0)}`}>{Math.round((b.value || 0) * 100)}%</p>
                <p className="text-xs text-slate-500 mt-0.5">{b.label}</p>
              </div>
            ))}
          </div>

          {/* Missing skills */}
          {matchResult.missing_skills?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
              <p className="text-xs font-semibold text-amber-700 mb-2">⚠️ Skills to highlight in resume:</p>
              <div className="flex flex-wrap gap-2">
                {matchResult.missing_skills.map((s: string) => (
                  <span key={s} className="bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleResume}
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <><span className="spinner" />Generating Resume...</> : "Generate Tailored Resume →"}
          </button>
        </div>
      )}

      {/* ── Step 3 — Resume ── */}
      {step === 3 && resumeResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1 transition-colors">
            ← Back
          </button>
          <h2 className="font-semibold text-slate-800 mb-1">Resume Generated ✅</h2>
          <p className="text-slate-500 text-sm mb-5">
            ATS Score:{" "}
            <span className={`font-semibold ${scoreColor(resumeResult.match_score)}`}>
              {Math.round(resumeResult.match_score * 100)}%
            </span>
          </p>

          <a
            href={resumeDownloadUrl(resumeResult.job_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">📄</span>
            <div>
              <p className="font-medium text-slate-800 text-sm">Download PDF Resume</p>
              <p className="text-xs text-slate-500">Tailored for {jd?.job_title} @ {jd?.company_name}</p>
            </div>
            <span className="ml-auto text-indigo-500 text-sm">↓</span>
          </a>

          <div className="mb-5">
            <label htmlFor="recipient-email" className="block text-sm font-medium text-slate-700 mb-2">
              Hiring Manager Email <span className="text-red-500">*</span>
            </label>
            <input
              id="recipient-email"
              type="email"
              placeholder="hiring@company.com"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 transition-colors"
              aria-required="true"
            />
            {recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) && (
              <p className="text-xs text-red-500 mt-1">Please enter a valid email address.</p>
            )}
          </div>

          <button
            onClick={handleEmail}
            disabled={loading || !recipientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <><span className="spinner" />Drafting Email...</> : "Draft Cold Email →"}
          </button>
        </div>
      )}

      {/* ── Step 4 — Email ── */}
      {step === 4 && emailResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <button onClick={() => setStep(3)} className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1 transition-colors">
            ← Back
          </button>
          <h2 className="font-semibold text-slate-800 mb-1">Review &amp; Send Cold Email</h2>
          <p className="text-xs text-slate-400 mb-5">
            Edit the subject and body below. Your changes are saved when you click Send.
          </p>

          <div className="mb-4">
            <label htmlFor="email-subject" className="block text-xs font-medium text-slate-600 mb-1">
              Subject
            </label>
            <input
              id="email-subject"
              type="text"
              value={editedSubject}
              onChange={e => setEditedSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 transition-colors"
              aria-label="Email subject"
            />
            {!editedSubject.trim() && (
              <p className="text-xs text-red-500 mt-1">Subject is required.</p>
            )}
          </div>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="email-body" className="block text-xs font-medium text-slate-600">Body</label>
              <span className="text-xs text-slate-400">{editedBody.trim().split(/\s+/).filter(Boolean).length} words</span>
            </div>
            <textarea
              id="email-body"
              value={editedBody}
              onChange={e => setEditedBody(e.target.value)}
              rows={10}
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-700 resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 transition-colors"
              aria-label="Email body"
            />
          </div>

          {/* Gmail not connected warning */}
          {gmailAuthorized === false && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="text-amber-800 font-semibold text-sm mb-1">⚠️ Gmail Not Connected</p>
              <p className="text-amber-700 text-xs mb-3">
                Connect your Gmail account to send this email with your resume attached.
              </p>
              <a
                href={GMAIL_AUTH_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
              >
                Connect Gmail →
              </a>
            </div>
          )}

          {/* Send button or success */}
          {!sendResult ? (
            <button
              onClick={handleSendConfirm}
              disabled={loading || gmailAuthorized === false || !editedSubject.trim() || !editedBody.trim()}
              className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <><span className="spinner" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />Sending...</> : "📤 Send Email with Resume Attached"}
            </button>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <p className="text-green-700 font-bold text-xl mb-1">🎉 Email Sent!</p>
              <p className="text-green-600 text-sm">
                Resume delivered to <strong>{sendResult.sent_to}</strong>
              </p>
              <p className="text-green-600 text-sm">
                Role: {jd?.job_title} @ {jd?.company_name}
              </p>
              {sendResult.pdf_attached && (
                <p className="text-xs text-slate-500 mt-2">✅ PDF resume attached</p>
              )}
              <p className="text-xs text-slate-400 mt-1">Gmail ID: {sendResult.gmail_message_id}</p>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Send Email?"
        message={`This will send the email to ${recipientEmail} with your tailored resume attached. This action cannot be undone.`}
        confirmLabel="Yes, Send →"
        confirmClass="bg-green-600 hover:bg-green-700 text-white"
        onConfirm={handleSend}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/* ── Inline-editable field ── */
interface EditableFieldProps {
  label: string;
  value: string;
  editing: boolean;
  onEdit: () => void;
  onSave: (v: string) => void;
  onCancel: () => void;
  inputValue?: string;
  placeholder?: string;
}

function EditableField({
  label, value, editing, onEdit, onSave, onCancel,
  inputValue, placeholder,
}: EditableFieldProps) {
  const [draft, setDraft] = useState(inputValue ?? value);

  // Sync draft when editing starts
  const handleEdit = () => { setDraft(inputValue ?? value); onEdit(); };

  return (
    <div className="bg-slate-50 rounded-xl p-3 mb-3 group">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-slate-500">{label}</p>
        {!editing && (
          <button
            onClick={handleEdit}
            aria-label={`Edit ${label}`}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600 p-0.5 rounded"
          >
            <Pencil size={12} />
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={placeholder}
            onKeyDown={e => {
              if (e.key === "Enter") onSave(draft);
              if (e.key === "Escape") onCancel();
            }}
            className="flex-1 text-sm font-semibold text-slate-800 bg-white border border-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <button onClick={() => onSave(draft)} className="text-green-600 hover:text-green-700 p-1" aria-label="Save">
            <Check size={14} />
          </button>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Cancel">
            <X size={14} />
          </button>
        </div>
      ) : (
        <p className="font-semibold text-slate-800 text-sm">{value}</p>
      )}
    </div>
  );
}
