"use client";
import { useEffect, useState } from "react";
import { getProfile, uploadResume } from "@/lib/api";

const TYPE_COLORS: Record<string, string> = {
  skill: "bg-blue-100 text-blue-700",
  experience: "bg-purple-100 text-purple-700",
  project: "bg-green-100 text-green-700",
  cert: "bg-orange-100 text-orange-700",
  education: "bg-pink-100 text-pink-700",
};

export default function ProfilePage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getProfile();
      setItems(data.items || []);
    } catch { setItems([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const result = await uploadResume(file);
      setMessage(`✅ Profile updated — ${result.items_created} items parsed`);
      await load();
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    }
    setUploading(false);
  };

  const types = ["all", "skill", "experience", "project", "cert", "education"];
  const filtered = filter === "all" ? items : items.filter(i => i.type === filter);

  const counts: Record<string, number> = {};
  items.forEach(i => { counts[i.type] = (counts[i.type] || 0) + 1; });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 text-sm mt-1">Your parsed resume data used for tailoring</p>
      </div>

      {/* Upload card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-800">Update Profile</p>
          <p className="text-slate-500 text-sm">{items.length} items currently stored</p>
        </div>
        <label className={`cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          {uploading ? "Uploading..." : "Upload Resume"}
          <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleUpload} />
        </label>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 mb-4 text-sm ${message.startsWith("✅") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {["skill", "experience", "project", "cert", "education"].map(t => (
          <div key={t} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-slate-800">{counts[t] || 0}</p>
            <p className="text-xs text-slate-500 capitalize">{t}s</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === t ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"
            }`}>
            {t} {t !== "all" && counts[t] ? `(${counts[t]})` : ""}
          </button>
        ))}
      </div>

      {/* Items list */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading profile...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No items found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item: any) => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full h-fit capitalize ${TYPE_COLORS[item.type] || "bg-slate-100 text-slate-600"}`}>
                {item.type}
              </span>
              <p className="text-sm text-slate-700 flex-1">{item.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
