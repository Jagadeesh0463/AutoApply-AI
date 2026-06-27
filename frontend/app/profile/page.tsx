"use client";
import { useEffect, useState } from "react";
import { getProfile, uploadResume } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { SkeletonProfileItem } from "@/components/Skeleton";

const TYPE_COLORS: Record<string, string> = {
  skill:      "bg-blue-100   text-blue-700",
  experience: "bg-purple-100 text-purple-700",
  project:    "bg-green-100  text-green-700",
  cert:       "bg-orange-100 text-orange-700",
  education:  "bg-pink-100   text-pink-700",
};

export default function ProfilePage() {
  const { toast } = useToast();

  const [items,     setItems]     = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter,    setFilter]    = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getProfile();
      setItems(data.items || []);
    } catch (e: any) {
      toast(e.message || "Failed to load profile", "error");
      setItems([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-uploaded
    e.target.value = "";
    setUploading(true);
    try {
      const result = await uploadResume(file);
      toast(`Profile updated — ${result.items_created} items parsed`, "success");
      await load();
    } catch (err: any) {
      toast(err.message || "Upload failed", "error");
    }
    setUploading(false);
  };

  const types    = ["all", "skill", "experience", "project", "cert", "education"];
  const filtered = filter === "all" ? items : items.filter(i => i.type === filter);
  const counts: Record<string, number> = {};
  items.forEach(i => { counts[i.type] = (counts[i.type] || 0) + 1; });

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 text-sm mt-1">Your parsed resume data used for tailoring</p>
      </div>

      {/* Upload card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-slate-800">Update Profile</p>
          <p className="text-slate-500 text-sm">
            {loading ? "Loading..." : `${items.length} items currently stored`}
          </p>
        </div>
        <label
          className={`cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          aria-label="Upload resume to update profile"
        >
          {uploading ? (
            <><span className="spinner" />Uploading...</>
          ) : (
            <>📄 Upload Resume</>
          )}
          <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          {["skill", "experience", "project", "cert", "education"].map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`bg-white border rounded-xl p-3 text-center transition-all hover:border-indigo-300 ${
                filter === t ? "border-indigo-400 ring-1 ring-indigo-300" : "border-slate-200"
              }`}
              aria-pressed={filter === t}
            >
              <p className="text-xl font-bold text-slate-800">{counts[t] || 0}</p>
              <p className="text-xs text-slate-500 capitalize">{t}s</p>
            </button>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap" role="group" aria-label="Filter by type">
        {types.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            aria-pressed={filter === t}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === t
                ? "bg-indigo-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"
            }`}
          >
            {t}{t !== "all" && counts[t] ? ` (${counts[t]})` : ""}
          </button>
        ))}
      </div>

      {/* Items list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonProfileItem key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-2xl mb-2">🕳️</p>
          <p className="text-sm">No items found{filter !== "all" ? ` for "${filter}"` : ""}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item: any) => (
            <li key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3">
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full h-fit capitalize flex-shrink-0 ${
                  TYPE_COLORS[item.type] || "bg-slate-100 text-slate-600"
                }`}
              >
                {item.type}
              </span>
              <p className="text-sm text-slate-700 flex-1 leading-relaxed">{item.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
