"use client";
import { useState } from "react";
import { extractFromImage, extractFromText, matchProfile, generateResume, draftEmail, sendEmail, getGmailStatus, resumeDownloadUrl, GMAIL_AUTH_URL } from "@/lib/api";

const STEPS = ["Upload", "Review JD", "Match Score", "Resume", "Email"];

export default function ApplyPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Data state
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [useText, setUseText] = useState(false);
  const [jd, setJd] = useState<any>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [resumeResult, setResumeResult] = useState<any>(null);
  const [emailResult, setEmailResult] = useState<any>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [sendResult, setSendResult] = useState<any>(null);
  const [gmailAuthorized, setGmailAuthorized] = useState<boolean | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setError("");
    setLoading(true);
    try { await fn(); } catch (e: any) { setError(e.message || "Something went wrong"); }
    setLoading(false);
  };

  // Step 1 → Extract JD
  const handleExtract = () => run(async () => {
    let data;
    if (useText) {
      data = await extractFromText(pasteText);
    } else {
      if (!file) throw new Error("Please select a job screenshot.");
      data = await extractFromImage(file);
    }
    setJd(data);
    setJobId(data.job_id);
    setStep(1);
  });

  // Step 2 → Match
  const handleMatch = () => run(async () => {
    const result = await matchProfile(jd);
    setMatchResult(result);
    setStep(2);
  });

  // Step 3 → Generate Resume
  const handleResume = () => run(async () => {
    const result = await generateResume(jobId!, jd);
    setResumeResult(result);
    setStep(3);
  });

  // Step 4 → Draft Email
  const handleEmail = () => run(async () => {
    if (!recipientEmail) throw new Error("Please enter recipient email.");
    const result = await draftEmail(jobId!, recipientEmail);
    setEmailResult(result);
    setEditedSubject(result.subject);
    setEditedBody(result.body);
    // Also check Gmail status when reaching email step
    const gmailStatus = await getGmailStatus();
    setGmailAuthorized(gmailStatus.authorized);
    setStep(4);
  });

  // Step 4 → Send Email (with any user edits applied)
  const handleSend = () => run(async () => {
    if (!emailResult?.draft_id) throw new Error("No draft to send.");
    const result = await sendEmail(emailResult.draft_id, editedSubject, editedBody);
    setSendResult(result);
  });

  const scoreColor = (s: number) =>
    s >= 0.75 ? "text-green-600" : s >= 0.5 ? "text-yellow-600" : "text-red-500";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">New Application</h1>
        <p className="text-slate-500 text-sm mt-1">Follow the steps to apply automatically</p>
      </div>

      {/* Progress bar — completed steps are clickable */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => { if (i < step) setStep(i); }}
              disabled={i >= step}
              className={`flex items-center gap-2 ${i < step ? "cursor-pointer" : "cursor-default"} ${i <= step ? "text-indigo-600" : "text-slate-400"}`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                i < step ? "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700" :
                i === step ? "border-indigo-600 text-indigo-600" :
                "border-slate-300 text-slate-400"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className="text-xs font-medium hidden sm:block">{s}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 ${i < step ? "bg-indigo-600" : "bg-slate-200"}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Step 0 — Upload */}
      {step === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Upload Job Posting</h2>
          <div className="flex gap-3 mb-5">
            <button onClick={() => setUseText(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border ${!useText ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-300 text-slate-600"}`}>
              📷 Screenshot
            </button>
            <button onClick={() => setUseText(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border ${useText ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-300 text-slate-600"}`}>
              📝 Paste Text
            </button>
          </div>

          {!useText ? (
            <label className="block border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors">
              <input type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              {file ? (
                <p className="text-indigo-600 font-medium">{file.name}</p>
              ) : (
                <div>
                  <p className="text-3xl mb-2">📸</p>
                  <p className="text-slate-600 font-medium">Click to upload job screenshot</p>
                  <p className="text-slate-400 text-sm mt-1">PNG, JPG supported</p>
                </div>
              )}
            </label>
          ) : (
            <textarea
              className="w-full border border-slate-300 rounded-xl p-4 text-sm text-slate-700 h-48 resize-none focus:outline-none focus:border-indigo-400"
              placeholder="Paste the full job description here..."
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
            />
          )}

          <button onClick={handleExtract} disabled={loading}
            className="mt-5 w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
            {loading ? "Extracting JD..." : "Extract Job Description →"}
          </button>
        </div>
      )}

      {/* Step 1 — Review JD */}
      {step === 1 && jd && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <button onClick={() => setStep(0)} className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1">← Back</button>
          <h2 className="font-semibold text-slate-800 mb-4">Review Extracted JD</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Role</p>
              <p className="font-semibold text-slate-800">{jd.job_title}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Company</p>
              <p className="font-semibold text-slate-800">{jd.company_name}</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-slate-500 mb-2">Required Skills</p>
            <div className="flex flex-wrap gap-2">
              {jd.required_skills?.map((s: string) => (
                <span key={s} className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <p className="text-xs text-slate-500 mb-2">Responsibilities</p>
            <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
              {jd.core_responsibilities?.map((r: string, i: number) => <li key={i}>{r}</li>)}
            </ul>
          </div>
          <button onClick={handleMatch} disabled={loading}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
            {loading ? "Matching Profile..." : "Match My Profile →"}
          </button>
        </div>
      )}

      {/* Step 2 — Match Score */}
      {step === 2 && matchResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1">← Back</button>
          <h2 className="font-semibold text-slate-800 mb-4">Profile Match Score</h2>
          <div className="flex items-center justify-center mb-6">
            <div className="text-center">
              <p className={`text-6xl font-bold ${scoreColor(matchResult.match_score)}`}>
                {Math.round(matchResult.match_score * 100)}%
              </p>
              <p className="text-slate-500 text-sm mt-1">Match Score</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Semantic", value: matchResult.breakdown?.sbert },
              { label: "Keywords", value: matchResult.breakdown?.tfidf },
              { label: "Skills", value: matchResult.breakdown?.boolean },
            ].map((b) => (
              <div key={b.label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-sm font-semibold text-slate-700">{Math.round((b.value || 0) * 100)}%</p>
                <p className="text-xs text-slate-500">{b.label}</p>
              </div>
            ))}
          </div>
          {matchResult.missing_skills?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
              <p className="text-xs font-semibold text-amber-700 mb-2">Skills to highlight:</p>
              <div className="flex flex-wrap gap-2">
                {matchResult.missing_skills.map((s: string) => (
                  <span key={s} className="bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
          <button onClick={handleResume} disabled={loading}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
            {loading ? "Generating Resume..." : "Generate Tailored Resume →"}
          </button>
        </div>
      )}

      {/* Step 3 — Resume */}
      {step === 3 && resumeResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1">← Back</button>
          <h2 className="font-semibold text-slate-800 mb-2">Resume Generated ✅</h2>
          <p className="text-slate-500 text-sm mb-5">
            ATS Score: <span className={`font-semibold ${scoreColor(resumeResult.match_score)}`}>
              {Math.round(resumeResult.match_score * 100)}%
            </span>
          </p>
          <a
            href={resumeDownloadUrl(resumeResult.job_id)}
            target="_blank"
            className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 hover:border-indigo-300 transition-colors"
          >
            <span className="text-2xl">📄</span>
            <div>
              <p className="font-medium text-slate-800 text-sm">Download PDF Resume</p>
              <p className="text-xs text-slate-500">Tailored for {jd?.job_title} @ {jd?.company_name}</p>
            </div>
          </a>
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Hiring Manager Email
            </label>
            <input
              type="email"
              placeholder="hiring@company.com"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <button onClick={handleEmail} disabled={loading}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
            {loading ? "Drafting Email..." : "Draft Cold Email →"}
          </button>
        </div>
      )}

      {/* Step 4 — Email */}
      {step === 4 && emailResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <button onClick={() => setStep(3)} className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1">← Back</button>
          <h2 className="font-semibold text-slate-800 mb-1">Cold Email Draft ✅</h2>
          <p className="text-xs text-slate-400 mb-4">Review and edit before sending — your changes will be saved automatically.</p>
          <div className="mb-4">
            <label className="block text-xs text-slate-500 mb-1">Subject</label>
            <input
              type="text"
              value={editedSubject}
              onChange={e => setEditedSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div className="mb-6">
            <label className="block text-xs text-slate-500 mb-1">Body</label>
            <textarea
              value={editedBody}
              onChange={e => setEditedBody(e.target.value)}
              rows={10}
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-700 resize-none focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* Gmail Authorization Status */}
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

          {/* Send Button or Success */}
          {!sendResult ? (
            <button
              onClick={handleSend}
              disabled={loading || gmailAuthorized === false}
              className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Sending..." : "📤 Send Email with Resume Attached"}
            </button>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-green-700 font-bold text-lg">🎉 Email Sent!</p>
              <p className="text-green-600 text-sm mt-1">
                Resume delivered to <strong>{sendResult.sent_to}</strong>
              </p>
              <p className="text-green-600 text-sm">
                Role: {jd?.job_title} @ {jd?.company_name}
              </p>
              {sendResult.pdf_attached && (
                <p className="text-xs text-slate-500 mt-2">✅ PDF resume attached</p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Gmail ID: {sendResult.gmail_message_id}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
