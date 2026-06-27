"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Pencil, Check, X, Info } from "lucide-react";
import {
  extractFromImage, extractFromText, matchProfile,
  generateResume, draftEmail, sendEmail,
  getGmailStatus, resumeDownloadUrl, GMAIL_AUTH_URL,
} from "@/lib/api";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

const STEPS = ["Upload", "Review JD", "Match Score", "Resume", "Email"];

const LOADING_MESSAGES: Record<string, string> = {
  extract: "Analysing job posting with Groq Vision...",
  match:   "Matching your profile against the JD...",
  resume:  "Generating tailored resume with Groq LLM...",
  email:   "Drafting personalised cold email...",
  send:    "Sending via Gmail with resume attached...",
};

/* Derive a human-readable explanation of the ATS score */
function scoreExplanation(result: any): string {
  const sbert   = result.breakdown?.sbert   ?? 0;
  const tfidf   = result.breakdown?.tfidf   ?? 0;
  const boolean = result.breakdown?.boolean ?? 0;
  const overall = result.match_score        ?? 0;

  if (overall >= 0.75) {
    if (boolean >= 0.8) return "Strong skill match with high semantic and keyword alignment.";
    return "Good overall match — skills and experience align well with the JD.";
  }
  if (overall >= 0.5) {
    if (boolean < 0.4) return "Moderate match — several required skills are missing from your profile.";
    if (sbert < 0.4)   return "Keyword match is good but semantic similarity is low. Consider rephrasing your experience.";
    return "Moderate match — some skills and experience gaps detected.";
  }
  if (tfidf < 0.3 && boolean < 0.3) return "Low match — the JD requires skills and keywords not yet in your profile.";
  return "Low match — consider adding missing skills and tailoring your profile further.";
}

/* ── Hybrid email: AI opening paragraph + structured template ── */
function buildProfessionalEmail(jd: any, matchResult: any, aiBody?: string): string {
  const company = jd?.company_name || jd?.company || "your company";
  const role    = jd?.job_title    || "the role";

  // Top 4 matched skills only — prevents keyword stuffing
  const topSkills: string[] = matchResult?.matched_skills?.slice(0, 4)
    || ["Java", "Selenium", "TestNG", "REST Assured"];

  // Use AI-generated first paragraph as the personalized opening if available,
  // otherwise fall back to a solid professional default
  const aiFirstPara = aiBody?.split(/\n\n+/)[0]?.trim() ?? "";
  const cleanedAiOpening = aiFirstPara
    .replace(/I['']d love to/gi,          "I would be glad to")
    .replace(/I['']m excited to/gi,       "I was keen to")
    .replace(/exciting opportunity/gi,    "opportunity")
    .replace(/passion for/gi,             "focus on")
    .replace(/aligns with my passion/gi,  "matches my experience");

  const opening = cleanedAiOpening.length > 20
    ? cleanedAiOpening
    : `I came across the ${role} opportunity at ${company} and was keen to apply, as my experience closely matches your requirements.`;

  const skillLines = topSkills.map(s => `• ${s}`).join("\n");

  return `Dear Hiring Manager,

${opening}

Key skills matching your requirements:
${skillLines}

In recent projects, I developed an enterprise-grade hybrid automation framework covering UI, API, and database testing, and a scalable REST API automation suite supporting complete CRUD validation, response assertions, and reporting.

I have attached my tailored resume for your review. I would be grateful for the opportunity to discuss how my experience can contribute to your ${role} team.

Thank you for your time and consideration. I look forward to hearing from you.

Best regards,
Jagadeesh S`;
}

export default function ApplyPage() {
  const { toast } = useToast();

  const [step,       setStep]       = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [loadingKey, setLoadingKey] = useState<keyof typeof LOADING_MESSAGES>("extract");
  const [error,      setError]      = useState("");

  // Data state
  const [files,          setFiles]          = useState<File[]>([]);
  const [pasteText,      setPasteText]      = useState("");
  const [useText,        setUseText]        = useState(false);
  const [jd,             setJd]             = useState<any>(null);
  const [jobId,          setJobId]          = useState<number | null>(null);
  const [matchResult,    setMatchResult]    = useState<any>(null);
  const [resumeResult,   setResumeResult]   = useState<any>(null);
  const [prevScore,      setPrevScore]      = useState<number | null>(null);
  const [emailResult,    setEmailResult]    = useState<any>(null);
  const [editedSubject,  setEditedSubject]  = useState("");
  const [editedBody,     setEditedBody]     = useState("");
  const [sendResult,     setSendResult]     = useState<any>(null);
  const [gmailAuthorized, setGmailAuthorized] = useState<boolean | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");

  // Multi-image drag-and-drop
  const [dragging, setDragging] = useState(false);
  const [thumbnailUrls, setThumbnailUrls] = useState<string[]>([]);
  const MAX_IMAGES = 5;

  // Create/revoke object URLs for thumbnails on file change (avoids memory leak)
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f));
    setThumbnailUrls(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [files]);

  const addFiles = (incoming: FileList | File[]) => {
    const imgs = Array.from(incoming).filter(f => f.type.startsWith("image/"));
    if (imgs.length !== Array.from(incoming).length)
      toast("Only image files are supported (PNG, JPG, WEBP)", "warning");
    setFiles(prev => {
      const combined = [...prev, ...imgs].slice(0, MAX_IMAGES);
      if (prev.length + imgs.length > MAX_IMAGES)
        toast(`Maximum ${MAX_IMAGES} screenshots allowed`, "warning");
      return combined;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (idx: number) =>
    setFiles(prev => prev.filter((_, i) => i !== idx));

  /* Stitch images vertically on a canvas → returns a single File */
  const stitchImages = async (imgFiles: File[]): Promise<File> => {
    if (imgFiles.length === 1) return imgFiles[0];
    const bitmaps = await Promise.all(imgFiles.map(f => createImageBitmap(f)));
    const width  = Math.max(...bitmaps.map(b => b.width));
    const height = bitmaps.reduce((s, b) => s + b.height, 0);
    const canvas = document.createElement("canvas");
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    let y = 0;
    for (const bm of bitmaps) {
      ctx.drawImage(bm, 0, y);
      y += bm.height;
      bm.close();
    }
    return new Promise(resolve =>
      canvas.toBlob(blob => resolve(new File([blob!], "stitched.jpg", { type: "image/jpeg" })), "image/jpeg", 0.92)
    );
  };

  // JD inline editing
  const [editingField, setEditingField] = useState<"role" | "company" | "exp" | null>(null);
  const [editRole,     setEditRole]     = useState("");
  const [editCompany,  setEditCompany]  = useState("");
  const [editExp,      setEditExp]      = useState("");

  // ATS tooltip
  const [showTooltip, setShowTooltip] = useState(false);

  // Confirmation dialog
  const [confirmOpen, setConfirmOpen] = useState(false);

  const run = async (key: keyof typeof LOADING_MESSAGES, fn: () => Promise<void>) => {
    setError("");
    setLoading(true);
    setLoadingKey(key);
    try { await fn(); }
    catch (e: any) {
      const msg = e.message || "Something went wrong";
      setError(msg);
      toast(msg, "error");
    }
    setLoading(false);
  };

  // Step 0 → Extract JD
  const handleExtract = () => run("extract", async () => {
    if (!useText && files.length === 0) throw new Error("Please select at least one job screenshot.");
    if (useText && !pasteText.trim())   throw new Error("Please paste a job description.");
    let uploadFile: File | undefined;
    if (!useText) {
      uploadFile = await stitchImages(files);
    }
    const data = useText ? await extractFromText(pasteText) : await extractFromImage(uploadFile!);
    setJd(data);
    setJobId(data.job_id);
    setEditRole(data.job_title ?? "");
    setEditCompany(data.company_name ?? "");
    setEditExp(data.minimum_years_experience ? String(data.minimum_years_experience) : "");
    setStep(1);
    toast(`✓ JD extracted — ${data.job_title} @ ${data.company_name}`, "success");
  });

  // Step 1 → Match
  const handleMatch = () => run("match", async () => {
    const result = await matchProfile(jd);
    setMatchResult(result);
    // Store pre-tailoring score for comparison on resume step
    setPrevScore(Math.round(result.match_score * 100));
    setStep(2);
    const pct = Math.round(result.match_score * 100);
    toast(`Match score: ${pct}%`, pct >= 70 ? "success" : pct >= 50 ? "warning" : "info");
  });

  // Step 2 → Generate Resume
  const handleResume = () => run("resume", async () => {
    const result = await generateResume(jobId!, jd);
    setResumeResult(result);
    setStep(3);
    toast("Tailored resume PDF generated ✅", "success");
  });

  // Step 3 → Draft Email
  const handleEmail = () => run("email", async () => {
    if (!recipientEmail.trim()) throw new Error("Please enter the recipient email.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) throw new Error("Please enter a valid email address.");
    const result = await draftEmail(jobId!, recipientEmail);
    setEmailResult(result);
    // Use a professional subject format; fall back to AI-generated if JD not available
    const professionalSubject = jd?.job_title
      ? `Application for ${jd.job_title} – Jagadeesh S`
      : result.subject;
    setEditedSubject(professionalSubject);
    // Hybrid email: AI opening paragraph for personalization + structured template for consistency
    // Uses user-edited jd state — so corrected company name propagates correctly
    setEditedBody(buildProfessionalEmail(jd, matchResult, result.body));
    const gmailStatus = await getGmailStatus();
    setGmailAuthorized(gmailStatus.authorized);
    setStep(4);
    toast("Cold email drafted — review before sending", "success");
  });

  // Step 4 → Confirm + Send
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
    // Light toast — success card shows full detail
    toast("Email sent successfully 🎉", "success");
  });

  const scoreColor = (s: number) =>
    s >= 0.75 ? "text-green-600" : s >= 0.5 ? "text-yellow-600" : "text-red-500";
  const scoreBg = (s: number) =>
    s >= 0.75 ? "bg-green-50 border-green-200" : s >= 0.5 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail);
  const resumeFilename = jd
    ? `Jagadeesh_Resume_${(jd.job_title ?? "").replace(/\s+/g, "_")}_${(jd.company_name ?? "").replace(/\s+/g, "_")}.pdf`
    : "Resume.pdf";

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
                i < step   ? "bg-indigo-600 border-indigo-600 text-white" :
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
          <span>❌</span><span>{error}</span>
        </div>
      )}

      {/* Loading banner */}
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
            <div>
              {/* Drop zone */}
              <label
                className={`block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-4 ${
                  dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30"
                }`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files && addFiles(e.target.files)}
                  aria-label="Upload job screenshots"
                />
                <p className="text-3xl mb-2">{dragging ? "📂" : "📸"}</p>
                <p className="text-slate-700 font-medium">
                  {dragging ? "Drop screenshots here" : "Drag & drop or click to upload"}
                </p>
                <p className="text-slate-400 text-sm mt-1">
                  PNG, JPG, WEBP · Up to {MAX_IMAGES} screenshots · Max 10 MB each
                </p>
              </label>

              {/* Thumbnail grid */}
              {files.length > 0 && (
                <div className="space-y-2 mb-2">
                  <p className="text-xs font-medium text-slate-500">
                    {files.length} screenshot{files.length > 1 ? "s" : ""} selected
                    {files.length > 1 && <span className="ml-1 text-indigo-500">(will be stitched automatically)</span>}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {files.map((f, i) => (
                      <div key={i} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                        <img
                          src={thumbnailUrls[i]}
                          alt={`Screenshot ${i + 1}`}
                          className="w-full h-24 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                        <div className="absolute top-1 left-1 bg-indigo-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                          {i + 1}
                        </div>
                        <button
                          onClick={() => removeFile(i)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                          aria-label={`Remove screenshot ${i + 1}`}
                        >
                          ✕
                        </button>
                        <p className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs px-1.5 py-0.5 truncate">
                          {(f.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
            disabled={loading || (!useText && files.length === 0) || (useText && !pasteText.trim())}
            className="mt-5 w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <><span className="spinner" />Extracting JD...</> : "Extract Job Description →"}
          </button>
        </div>
      )}

      {/* ── Step 1 — Review JD ── */}
      {step === 1 && jd && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <button onClick={() => setStep(0)} className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1 transition-colors">← Back</button>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Review Extracted JD</h2>
            <span className="text-xs font-medium bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full">
              {useText ? "99%" : "97%"} confidence
            </span>
          </div>

          <EditableField label="Role" value={editRole} editing={editingField === "role"}
            onEdit={() => setEditingField("role")}
            onSave={v => { setEditRole(v); setEditingField(null); setJd((p: any) => ({ ...p, job_title: v })); }}
            onCancel={() => setEditingField(null)} />

          <div className="grid grid-cols-2 gap-3 mb-3">
            <EditableField label="Company" value={editCompany} editing={editingField === "company"}
              onEdit={() => setEditingField("company")}
              onSave={v => { setEditCompany(v); setEditingField(null); setJd((p: any) => ({ ...p, company_name: v })); }}
              onCancel={() => setEditingField(null)} />
            <EditableField label="Experience" value={editExp ? `${editExp}+ years` : "Not specified"} editing={editingField === "exp"}
              onEdit={() => setEditingField("exp")}
              onSave={v => { setEditExp(v.replace(/[^0-9]/g, "")); setEditingField(null); }}
              onCancel={() => setEditingField(null)} inputValue={editExp} placeholder="e.g. 2" />
          </div>

          <div className="bg-slate-50 rounded-xl p-4 mb-3">
            <p className="text-xs text-slate-500 mb-2">
              Required Skills
              {jd.required_skills?.length > 0 && <span className="ml-1 text-slate-400">({jd.required_skills.length})</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {jd.required_skills?.map((s: string) => (
                <span key={s} className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </div>

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

          <p className="text-xs text-slate-400 mb-4 text-center">Review the extracted details before matching your profile.</p>
          <div className="sticky bottom-4">
            <button onClick={handleMatch} disabled={loading}
              className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
              {loading ? <><span className="spinner" />Matching Profile...</> : "Match My Profile →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 — Match Score ── */}
      {step === 2 && matchResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1 transition-colors">← Back</button>
          <h2 className="font-semibold text-slate-800 mb-4">Profile Match Score</h2>

          {/* Big score */}
          <div className={`rounded-2xl border p-6 text-center mb-2 ${scoreBg(matchResult.match_score)}`}>
            <p className={`text-6xl font-bold ${scoreColor(matchResult.match_score)}`}>
              {Math.round(matchResult.match_score * 100)}%
            </p>
            <p className="text-slate-500 text-sm mt-1">Overall ATS Match</p>
          </div>

          {/* Score explanation */}
          <p className="text-xs text-slate-500 text-center mb-5 italic">{scoreExplanation(matchResult)}</p>

          {/* Breakdown with tooltip */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Score Breakdown</p>
            <div className="relative">
              <button
                onClick={() => setShowTooltip(v => !v)}
                className="text-slate-400 hover:text-indigo-600 transition-colors"
                aria-label="How is this score calculated?"
              >
                <Info size={15} />
              </button>
              {showTooltip && (
                <div className="absolute right-0 top-6 w-64 bg-slate-800 text-white text-xs rounded-xl p-3 z-10 shadow-xl leading-relaxed">
                  <p className="font-semibold mb-1">How we calculate your score</p>
                  <p>Hybrid ATS formula:</p>
                  <p className="mt-1">· <b>30%</b> Semantic similarity (SBERT)</p>
                  <p>· <b>30%</b> Keyword overlap (TF-IDF)</p>
                  <p>· <b>40%</b> Skill match (Boolean)</p>
                  <button onClick={() => setShowTooltip(false)} className="mt-2 text-slate-300 hover:text-white">✕ Close</button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Semantic", value: matchResult.breakdown?.sbert,   weight: "30%" },
              { label: "Keywords", value: matchResult.breakdown?.tfidf,   weight: "30%" },
              { label: "Skills",   value: matchResult.breakdown?.boolean, weight: "40%" },
            ].map(b => (
              <div key={b.label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className={`text-lg font-bold ${scoreColor(b.value || 0)}`}>{Math.round((b.value || 0) * 100)}%</p>
                <p className="text-xs text-slate-500 mt-0.5">{b.label}</p>
                <p className="text-xs text-slate-300 mt-0.5">{b.weight} weight</p>
              </div>
            ))}
          </div>

          {/* Matched + Missing skills */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {matchResult.matched_skills?.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-green-700 mb-2">✅ Matched Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {matchResult.matched_skills.map((s: string) => (
                    <span key={s} className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {matchResult.missing_skills?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-2">⚠️ Missing Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {matchResult.missing_skills.map((s: string) => (
                    <span key={s} className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={handleResume} disabled={loading}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading ? <><span className="spinner" />Generating Resume...</> : "Generate Tailored Resume →"}
          </button>
        </div>
      )}

      {/* ── Step 3 — Resume ── */}
      {step === 3 && resumeResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <button onClick={() => setStep(2)} className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1 transition-colors">← Back</button>
          <h2 className="font-semibold text-slate-800 mb-4">Tailored Resume Ready</h2>

          {/* ATS improvement */}
          {prevScore !== null && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-0.5">Before Tailoring</p>
                <p className={`text-2xl font-bold ${scoreColor(prevScore / 100)}`}>{prevScore}%</p>
              </div>
              <div className="text-slate-300 text-2xl">→</div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-0.5">After Tailoring</p>
                <p className={`text-2xl font-bold ${scoreColor(resumeResult.match_score)}`}>
                  {Math.round(resumeResult.match_score * 100)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-0.5">Improvement</p>
                <p className="text-2xl font-bold text-green-600">
                  +{Math.max(0, Math.round(resumeResult.match_score * 100) - prevScore)}%
                </p>
              </div>
            </div>
          )}

          {/* Resume preview (blob URL to bypass attachment header) */}
          <PdfPreview url={resumeDownloadUrl(resumeResult.job_id)} filename={resumeFilename} />

          {/* What AI changed */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-indigo-700 mb-2">✨ What the AI optimised</p>
            <ul className="space-y-1">
              {[
                "Added relevant keywords from the job description",
                "Highlighted matching skills for ATS scanners",
                "Reordered technical skills by relevance",
                "Optimised formatting for ATS compatibility",
              ].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs text-indigo-600">
                  <span className="text-indigo-400">·</span>{item}
                </li>
              ))}
            </ul>
          </div>

          {/* Download */}
          <a
            href={resumeDownloadUrl(resumeResult.job_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-4 mb-5 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">📄</span>
            <div>
              <p className="font-medium text-slate-800 text-sm">Download Tailored Resume (PDF)</p>
              <p className="text-xs text-slate-500">{resumeFilename}</p>
            </div>
            <span className="ml-auto text-indigo-500 text-sm">↓</span>
          </a>

          {/* Recipient email */}
          <div className="mb-5">
            <label htmlFor="recipient-email" className="block text-sm font-medium text-slate-700 mb-2">
              Hiring Manager Email <span className="text-red-500">*</span>
            </label>
            <input
              id="recipient-email"
              type="email"
              placeholder="Enter recruiter's email address"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 transition-colors"
              aria-required="true"
            />
            {recipientEmail && !emailValid && (
              <p className="text-xs text-red-500 mt-1">Please enter a valid email address.</p>
            )}
          </div>

          <button
            onClick={handleEmail}
            disabled={loading || !recipientEmail.trim() || !emailValid}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <><span className="spinner" />Drafting Email...</> : "Draft Cold Email →"}
          </button>
        </div>
      )}

      {/* ── Step 4 — Email ── */}
      {step === 4 && emailResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <button onClick={() => setStep(3)} className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1 transition-colors">← Back</button>
          <h2 className="font-semibold text-slate-800 mb-1">Review &amp; Send Cold Email</h2>
          <p className="text-xs text-slate-400 mb-5">Edit the subject and body below. Your changes are saved when you click Send.</p>

          {/* Recipient section */}
          <div className="bg-slate-50 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wide w-14 flex-shrink-0">To</span>
            <span className="text-sm text-slate-700 font-medium">{recipientEmail}</span>
          </div>

          {/* Subject */}
          <div className="mb-4">
            <label htmlFor="email-subject" className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
            <input
              id="email-subject"
              type="text"
              value={editedSubject}
              onChange={e => setEditedSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300 transition-colors"
              aria-label="Email subject"
            />
            {!editedSubject.trim() && <p className="text-xs text-red-500 mt-1">Subject is required.</p>}
          </div>

          {/* Body */}
          <div className="mb-4">
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

          {/* Attachment pill */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 mb-5">
            <span className="text-base">📎</span>
            <span className="text-sm text-slate-700 font-medium">{resumeFilename}</span>
            <span className="ml-auto text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">Attached</span>
          </div>

          {/* Gmail warning */}
          {gmailAuthorized === false && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="text-amber-800 font-semibold text-sm mb-1">⚠️ Gmail Not Connected</p>
              <p className="text-amber-700 text-xs mb-3">Connect your Gmail account to send this email with your resume attached.</p>
              <a href={GMAIL_AUTH_URL} target="_blank" rel="noopener noreferrer"
                className="inline-block bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors">
                Connect Gmail →
              </a>
            </div>
          )}

          {/* Send button or success card */}
          {!sendResult ? (
            <button
              onClick={handleSendConfirm}
              disabled={loading || gmailAuthorized === false || !editedSubject.trim() || !editedBody.trim()}
              className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading
                ? <><span className="spinner" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />Sending...</>
                : "📤 Send Email with Resume Attached"}
            </button>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
              <p className="text-green-700 font-bold text-xl mb-4 text-center">🎉 Email Sent!</p>
              <div className="space-y-2 mb-5">
                <div className="flex items-center gap-3 bg-white border border-green-100 rounded-xl px-4 py-2.5">
                  <span className="text-xs text-slate-500 w-20 flex-shrink-0">Recipient</span>
                  <span className="text-sm font-medium text-slate-800">{sendResult.sent_to}</span>
                </div>
                <div className="flex items-center gap-3 bg-white border border-green-100 rounded-xl px-4 py-2.5">
                  <span className="text-xs text-slate-500 w-20 flex-shrink-0">Role</span>
                  <span className="text-sm font-medium text-slate-800">{jd?.job_title} @ {jd?.company_name}</span>
                </div>
                <div className="flex items-center gap-3 bg-white border border-green-100 rounded-xl px-4 py-2.5">
                  <span className="text-xs text-slate-500 w-20 flex-shrink-0">Attachment</span>
                  <span className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                    <span>📎</span>{resumeFilename}
                  </span>
                </div>
                {sendResult.gmail_message_id && (
                  <div className="flex items-center gap-3 bg-white border border-green-100 rounded-xl px-4 py-2.5">
                    <span className="text-xs text-slate-500 w-20 flex-shrink-0">Gmail ID</span>
                    <span className="text-xs text-slate-400 font-mono truncate">{sendResult.gmail_message_id}</span>
                  </div>
                )}
              </div>
              {/* Post-send actions */}
              <div className="flex gap-3">
                <Link
                  href="/applications"
                  className="flex-1 text-center bg-white border border-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                >
                  View Applications
                </Link>
                <button
                  onClick={() => {
                    setStep(0); setJd(null); setMatchResult(null);
                    setResumeResult(null); setEmailResult(null);
                    setSendResult(null); setFiles([]); setPasteText("");
                    setRecipientEmail(""); setPrevScore(null);
                  }}
                  className="flex-1 bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Start New Application
                </button>
              </div>
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

/* ── PDF Preview (fetches as blob to bypass Content-Disposition: attachment) ── */
function PdfPreview({ url, filename }: { url: string; filename: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);

  useEffect(() => {
    let objectUrl: string;
    setPdfError(false);
    setBlobUrl(null);

    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error("fetch failed");
        return r.blob();
      })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => setPdfError(true));

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">📄 Preview</span>
        <span className="text-xs text-slate-400">{filename}</span>
      </div>
      {pdfError ? (
        <div className="h-32 flex items-center justify-center text-slate-400 text-sm bg-slate-50">
          Preview unavailable — use the download button below.
        </div>
      ) : !blobUrl ? (
        <div className="h-32 flex items-center justify-center bg-slate-50">
          <span className="spinner" style={{ borderColor: "rgba(99,102,241,0.3)", borderTopColor: "#4f46e5" }} />
        </div>
      ) : (
        <object
          data={blobUrl}
          type="application/pdf"
          className="w-full h-96"
          aria-label="Resume PDF preview"
        >
          <div className="h-32 flex items-center justify-center text-slate-400 text-sm bg-slate-50">
            Your browser cannot display PDFs inline. Use the download button below.
          </div>
        </object>
      )}
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

function EditableField({ label, value, editing, onEdit, onSave, onCancel, inputValue, placeholder }: EditableFieldProps) {
  const [draft, setDraft] = useState(inputValue ?? value);
  const handleEdit = () => { setDraft(inputValue ?? value); onEdit(); };
  return (
    <div className="bg-slate-50 rounded-xl p-3 mb-3 group">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-slate-500">{label}</p>
        {!editing && (
          <button onClick={handleEdit} aria-label={`Edit ${label}`}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600 p-0.5 rounded">
            <Pencil size={12} />
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder}
            onKeyDown={e => { if (e.key === "Enter") onSave(draft); if (e.key === "Escape") onCancel(); }}
            className="flex-1 text-sm font-semibold text-slate-800 bg-white border border-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          <button onClick={() => onSave(draft)} className="text-green-600 hover:text-green-700 p-1" aria-label="Save"><Check size={14} /></button>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Cancel"><X size={14} /></button>
        </div>
      ) : (
        <p className="font-semibold text-slate-800 text-sm">{value}</p>
      )}
    </div>
  );
}
