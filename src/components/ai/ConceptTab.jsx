import React, { useState } from "react";
import { aiCall } from "@/lib/aiCall";
import { Lightbulb, Loader2, ArrowRight, Pencil, Check, RefreshCw, Bot, X } from "lucide-react";
import StoryDirectionForm from "@/components/ai/StoryDirectionForm";

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

const SINGLE_SCHEMA = {
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
};

// Cấp độ 1 — Khởi tạo Ý tưởng. Mỗi concept có 3 lựa chọn: chốt / góp ý AI sửa lại / sửa tay.
// Có nút sinh lại cả 3 kèm ghi chú. Sau khi chốt → form định hướng → sang Dàn Ý.
export default function ConceptTab({ onUseConcept }) {
  const [genre, setGenre] = useState("");
  const [loading, setLoading] = useState(false);
  const [concepts, setConcepts] = useState([]);
  const [error, setError] = useState("");
  const [busyIdx, setBusyIdx] = useState(null); // "all" | number | null
  const [noteFor, setNoteFor] = useState(null); // {type:'single'|'all', idx?, text}
  const [editIdx, setEditIdx] = useState(null); // chỉnh sửa tay concept nào

  const generate = async (note) => {
    if (!genre.trim()) {
      setError("Hãy nhập thể loại / từ khóa (VD: NP, Mạt thế, Bách hợp).");
      return;
    }
    setError("");
    setLoading(true);
    setConcepts([]);
    try {
      const prompt = `Bạn là chuyên gia kịch thuật tiểu thuyết mạng Bách Hợp Cổ Đại. Dựa thể loại / từ khóa dưới đây, hãy đề xuất 3 CONCEPT sáng tác (mỗi concept gồm tiêu đề, bối cảnh, tiền đề và 2-3 nhân vật mẫu kèm tên / thân phận / giới thiệu ngắn). Văn phong cổ kính, điền nhã, KHÔNG dùng từ hiện đại. Trả JSON đúng schema.

Thể loại / từ khóa: ${genre}${note ? `\n\nĐịnh hướng lại của tác giả: ${note}` : ""}`;
      const res = await aiCall(prompt, { jsonSchema: CONCEPT_SCHEMA });
      setConcepts(res?.concepts || []);
      if (!res?.concepts?.length) setError("AI không trả về concept nào.");
    } catch (e) {
      setError("Lỗi: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const regenSingle = async (idx, note) => {
    setBusyIdx(idx);
    setError("");
    try {
      const prompt = `Bạn là chuyên gia kịch thuật Bách Hợp Cổ Đại. Tác giả muốn CHỈ sửa RIÊNG concept số ${idx + 1} theo góp ý, 2 concept còn lại giữ nguyên. Hãy sinh lại concept số ${idx + 1} (giữ không khí chung, điều chỉnh theo góp ý). Văn phong cổ kính, không từ hiện đại. Trả JSON đúng schema của 1 concept (gồm title, premise, setting, characters[]).

# Concept gốc cần chỉnh sửa
${JSON.stringify(concepts[idx])}

# Góp ý của tác giả
${note || "(chỉ làm cho hay hơn, giữ ý chính)"}`;
      const res = await aiCall(prompt, { jsonSchema: SINGLE_SCHEMA });
      setConcepts((cs) => cs.map((c, i) => (i === idx ? res : c)));
    } catch (e) {
      setError("Không thể sửa concept: " + (e?.message || ""));
    } finally {
      setBusyIdx(null);
    }
  };

  const regenAll = async (note) => {
    setError("");
    let ok = false;
    try {
      await generate(note);
      ok = true;
    } catch (e) {
      setError("Lỗi: " + (e?.message || ""));
    }
    return ok;
  };

  const startNote = (type, idx) => {
    setNoteFor({ type, idx, text: "" });
  };
  const sendNote = async () => {
    if (!noteFor) return;
    const text = noteFor.text.trim();
    if (noteFor.type === "all") {
      setNoteFor(null);
      await regenAll(text);
    } else {
      const idx = noteFor.idx;
      setNoteFor(null);
      await regenSingle(idx, text);
    }
  };

  const beginManualEdit = (i) => {
    // clone để chỉnh tay không ảnh hưởng Object gốc từ AI
    setConcepts((cs) => cs.map((c, k) => (k === i ? { ...c, characters: Array.isArray(c.characters) ? c.characters.map((x) => ({ ...x })) : [] } : c)));
    setEditIdx(i);
  };
  const commitEdit = () => setEditIdx(null);

  const pickConcept = (c) => {
    // Báo cho bản chưa nào biết concept nào đang chốt — hiện form định hướng
    setPicked(c);
  };

  const [picked, setPicked] = useState(null);

  const doUseConcept = (c) => {
    const ideaText = `Tiêu đề: ${c.title}\nBối cảnh: ${c.setting}\nTiền đề: ${c.premise}\nNhân vật: ${
      (c.characters || []).map((x) => `${x.name} (${x.role})`).join(", ") || "(chưa có)"
    }`;
    onUseConcept(ideaText, c.characters || []);
  };

  if (picked) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="text-[11px] font-semibold text-primary">Ý tưởng đã chốt</div>
          <h3 className="font-display font-semibold mt-0.5">{picked.title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{picked.premise}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Bối cảnh: {picked.setting}</p>
        </div>
        <StoryDirectionForm
          onDone={() => {
            const c = picked;
            setPicked(null);
            doUseConcept(c);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" /> Cấp độ 1 · Khởi tạo Ý tưởng
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Nhập thể loại / từ khóa — AI đề xuất 3 concept. Bạn có thể chốt, góp ý AI sửa riêng, hoặc sửa tay từng concept.
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
            onClick={() => generate()}
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
          {concepts.map((c, i) => {
            const editing = editIdx === i;
            return (
              <div key={i} className="rounded-xl border border-border bg-card p-4 flex flex-col">
                <div className="text-[11px] font-semibold text-primary">Concept {i + 1}</div>
                {editing ? (
                  <div className="mt-0.5 space-y-1.5">
                    <input
                      value={c.title}
                      onChange={(e) => setConcepts((cs) => cs.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))}
                      className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                      placeholder="Tiêu đề"
                    />
                    <textarea
                      value={c.premise}
                      onChange={(e) => setConcepts((cs) => cs.map((x, k) => (k === i ? { ...x, premise: e.target.value } : x)))}
                      rows={2}
                      className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs resize-y"
                      placeholder="Tiền đề"
                    />
                    <textarea
                      value={c.setting}
                      onChange={(e) => setConcepts((cs) => cs.map((x, k) => (k === i ? { ...x, setting: e.target.value } : x)))}
                      rows={2}
                      className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs resize-y"
                      placeholder="Bối cảnh"
                    />
                    <div className="space-y-1">
                      {(c.characters || []).map((ch, j) => (
                        <div key={j} className="flex gap-1">
                          <input
                            value={ch.name}
                            onChange={(e) => setConcepts((cs) => cs.map((x, k) => k === i ? { ...x, characters: x.characters.map((p, q) => q === j ? { ...p, name: e.target.value } : p) } : x))}
                            className="flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                            placeholder="Tên"
                          />
                          <input
                            value={ch.role}
                            onChange={(e) => setConcepts((cs) => cs.map((x, k) => k === i ? { ...x, characters: x.characters.map((p, q) => q === j ? { ...p, role: e.target.value } : p) } : x))}
                            className="w-20 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                            placeholder="Vai"
                          />
                        </div>
                      ))}
                    </div>
                    <button onClick={commitEdit} className="inline-flex items-center gap-1 text-xs text-primary">
                      <Check className="w-3.5 h-3.5" /> Xong
                    </button>
                  </div>
                ) : (
                  <>
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
                  </>
                )}

                <div className="mt-3 flex flex-col gap-1.5 mt-auto">
                  <button
                    onClick={() => pickConcept(c)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
                  >
                    Chốt ý tưởng này <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => startNote("single", i)}
                      disabled={busyIdx === i}
                      className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-primary/40 text-primary text-[11px] hover:bg-primary/10 disabled:opacity-50"
                    >
                      {busyIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />} Góp ý AI sửa
                    </button>
                    <button
                      onClick={() => (editing ? commitEdit() : beginManualEdit(i))}
                      className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-border text-muted-foreground text-[11px] hover:bg-muted"
                    >
                      {editing ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />} {editing ? "Xong" : "Sửa tay"}
                    </button>
                  </div>
                  {noteFor && noteFor.type === "single" && noteFor.idx === i && (
                    <div className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 p-2">
                      <Bot className="w-3.5 h-3.5 text-primary shrink-0" />
                      <input
                        value={noteFor.text}
                        onChange={(e) => setNoteFor((n) => ({ ...n, text: e.target.value }))}
                        placeholder="Góp ý chừng concept này..."
                        className="flex-1 text-xs bg-transparent outline-none"
                      />
                      <button onClick={sendNote} className="px-2 py-1 rounded bg-primary text-primary-foreground text-[11px]">Gửi</button>
                      <button onClick={() => setNoteFor(null)} className="p-0.5 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {concepts.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => startNote("all")}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Không ưng, sinh lại
          </button>
        </div>
      )}

      {noteFor && noteFor.type === "all" && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5 flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary shrink-0" />
          <input
            value={noteFor.text}
            onChange={(e) => setNoteFor((n) => ({ ...n, text: e.target.value }))}
            placeholder="Định hướng lại (tuỳ chọn) — VD: muốn yếu tố trùng sinh, bớt u ám..."
            className="flex-1 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm"
          />
          <button onClick={sendNote} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm">Sinh lại</button>
          <button onClick={() => setNoteFor(null)} className="p-1.5 text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}