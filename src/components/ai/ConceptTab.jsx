import React, { useState } from "react";
import { aiCall } from "@/lib/aiCall";
import { Lightbulb, Loader2, ArrowRight } from "lucide-react";

const CONCEPT_SCHEMA = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          premise: { type: "string" },
          setting: { type: "string" },
          characters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                role: { type: "string" },
                description: { type: "string" },
              },
              required: ["name", "role", "description"],
            },
          },
        },
        required: ["title", "premise", "setting", "characters"],
      },
    },
  },
};

// Cấp độ 1 — Khởi tạo Ý tưởng từ thể loại / từ khóa thô
export default function ConceptTab({ onUseConcept }) {
  const [genre, setGenre] = useState("");
  const [loading, setLoading] = useState(false);
  const [concepts, setConcepts] = useState([]);
  const [error, setError] = useState("");

  const generate = async () => {
    if (!genre.trim()) {
      setError("Hãy nhập thể loại / từ khóa (VD: NP, Mạt thế, Bách hợp).");
      return;
    }
    setError("");
    setLoading(true);
    setConcepts([]);
    try {
      const prompt = `Bạn là chuyên gia kịch thuật tiểu thuyết mạng Bách Hợp Cổ Đại. Dựa thể loại / từ khóa dưới đây, hãy đề xuất 3 CONCEPT sáng tác (mỗi concept gồm tiêu đề, bối cảnh, tiền đề cốt truyện và 2-3 nhân vật mẫu kèm tên / thân phận / giới thiệu ngắn). Văn phong cổ kính, điền nhã, KHÔNG dùng từ hiện đại. Trả JSON đúng schema.

Thể loại / từ khóa: ${genre}`;
      const res = await aiCall(prompt, { jsonSchema: CONCEPT_SCHEMA });
      setConcepts(res?.concepts || []);
      if (!res?.concepts?.length) setError("AI không trả về concept nào.");
    } catch (e) {
      setError("Lỗi: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const pickConcept = (c) => {
    const ideaText = `Tiêu đề: ${c.title}\nBối cảnh: ${c.setting}\nTiền đề: ${c.premise}\nNhân vật: ${
      (c.characters || []).map((x) => `${x.name} (${x.role})`).join(", ") || "(chưa có)"
    }`;
    onUseConcept(ideaText, c.characters || []);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" /> Cấp độ 1 · Khởi tạo Ý tưởng
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Nhập thể loại / từ khóa thô — AI đề xuất 3 bối cảnh + nhân vật mẫu.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs font-medium text-muted-foreground">Thể loại / từ khóa thô</label>
        <div className="flex gap-2 mt-1.5">
          <input
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="VD: NP, Mạt thế, Bách hợp, Trùng sinh, Sư đồ..."
            className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onKeyDown={(e) => e.key === "Enter" && generate()}
          />
          <button
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
            Sinh 3 concept
          </button>
        </div>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      </div>

      {concepts.length > 0 && (
        <div className="grid md:grid-cols-3 gap-3">
          {concepts.map((c, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 flex flex-col">
              <div className="text-[11px] font-semibold text-primary">Concept {i + 1}</div>
              <h3 className="font-display font-semibold mt-0.5">{c.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.premise}</p>
              <div className="text-[11px] text-muted-foreground mt-2">
                <span className="font-medium">Bối cảnh:</span> {c.setting}
              </div>
              {c.characters?.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                  {c.characters.map((ch, j) => (
                    <li key={j} className="text-foreground/90">
                      <b>{ch.name}</b> <span className="text-muted-foreground">· {ch.role}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => pickConcept(c)}
                className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-primary/40 text-primary text-xs font-medium hover:bg-primary/10 transition mt-auto"
              >
                Chốt ý tưởng này <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}