import React, { useState } from "react";
import { aiCall } from "@/lib/aiCall";
import { Lightbulb, Loader2, ArrowRight, Pencil, Check, RefreshCw, Bot, X } from "lucide-react";
import StoryDirectionForm from "@/components/ai/StoryDirectionForm";
import { genreStyleLine } from "@/lib/genreStyle";

const CHARACTER_ITEM_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    role: { type: "string" },
    description: { type: "string" },
  },
  required: ["name", "role", "description"],
};

const ANTAGONIST_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    role: { type: "string" },
    motivation: { type: "string" },
    description: { type: "string" },
  },
  required: ["name", "role", "motivation", "description"],
};

const SUPPORTING_ITEM_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    role: { type: "string" },
    narrative_function: { type: "string" },
    description: { type: "string" },
  },
  required: ["name", "role", "narrative_function", "description"],
};

const CONCEPT_FIELDS_SCHEMA = {
  title: { type: "string" },
  hook: { type: "string" },
  conflict: { type: "string" },
  premise: { type: "string" },
  setting: { type: "string" },
  protagonists: { type: "array", items: CHARACTER_ITEM_SCHEMA },
  antagonist: ANTAGONIST_SCHEMA,
  supporting_characters: { type: "array", items: SUPPORTING_ITEM_SCHEMA },
};

const CONCEPT_SCHEMA = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        properties: CONCEPT_FIELDS_SCHEMA,
        required: ["title", "hook", "conflict", "premise", "setting", "protagonists", "antagonist", "supporting_characters"],
      },
    },
  },
};

const SINGLE_SCHEMA = {
  type: "object",
  properties: CONCEPT_FIELDS_SCHEMA,
  required: ["title", "hook", "conflict", "premise", "setting", "protagonists", "antagonist", "supporting_characters"],
};

// Cấp độ 1 — Khởi tạo Ý tưởng. Mỗi concept có 3 lựa chọn: chốt / góp ý AI sửa lại / sửa tay.
// Có nút sinh lại cả 3 kèm ghi chú. Sau khi chốt → form định hướng → sang Dàn Ý.
export default function ConceptTab({ genre, onGenreChange, onUseConcept }) {
  const setGenre = onGenreChange;
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
      const prompt = `Bạn là chuyên gia kịch thuật tiểu thuyết mạng. ${genreStyleLine(genre)} Dựa thể loại / từ khóa dưới đây, hãy đề xuất 3 CONCEPT sáng tác CÓ THỰC CHẤT KỊCH TÍNH, không chỉ tả không khí/khung cảnh chung chung kiểu "buổi sáng nắng đẹp, ngồi uống trà".

Mỗi concept BẮT BUỘC gồm:
- "hook": biến cố khởi đầu cụ thể kéo hai nhân vật chính vào nhau (1-2 câu, phải là một SỰ KIỆN, không phải mô tả cảnh).
- "conflict": xung đột trung tâm xuyên suốt cả truyện — gồm cả xung đột nội tâm (VD: thân phận, mặc cảm, lời thề) LẪN xung đột ngoại cảnh (VD: rào cản lễ giáo, gia tộc, thù hận, bí mật) — không được để trống hoặc chung chung.
- "premise": tiền đề nêu rõ ai muốn gì, điều gì cản trở, và vì sao khán giả nên quan tâm.
- "setting": bối cảnh không gian/thời gian.
- "protagonists": đúng 2 nhân vật chính (tên, thân phận, giới thiệu ngắn có gắn với xung đột).
- "antagonist": MỘT thế lực/nhân vật đối đầu cụ thể. Nếu thể loại phù hợp hơn với rào cản trừu tượng (lễ giáo, gia tộc, số phận) thay vì một nhân vật phản diện, hãy đặt "role" là thế lực đó và mô tả "motivation" của nó — KHÔNG được bỏ trống hay ghi "không có".
- "supporting_characters": 1-3 nhân vật phụ, mỗi người có "narrative_function" rõ ràng (VD: sư phụ dẫn dắt, tri kỷ an ủi, gia tộc cản trở, tình địch xen vào...).

Trả JSON đúng schema.

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
      const prompt = `Bạn là chuyên gia kịch thuật tiểu thuyết mạng. ${genreStyleLine(genre)} Tác giả muốn CHỈ sửa RIÊNG concept số ${idx + 1} theo góp ý, 2 concept còn lại giữ nguyên. Hãy sinh lại concept số ${idx + 1} (giữ không khí chung, điều chỉnh theo góp ý). Phải có thực chất kịch tính: "hook" là một sự kiện cụ thể, "conflict" nêu rõ xung đột nội tâm + ngoại cảnh, "antagonist" là thế lực/nhân vật đối đầu cụ thể (không bỏ trống), "supporting_characters" có narrative_function rõ ràng. Trả JSON đúng schema của 1 concept (gồm title, hook, conflict, premise, setting, protagonists[], antagonist, supporting_characters[]).

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
    setConcepts((cs) =>
      cs.map((c, k) =>
        k === i
          ? {
              ...c,
              protagonists: Array.isArray(c.protagonists) ? c.protagonists.map((x) => ({ ...x })) : [],
              antagonist: c.antagonist ? { ...c.antagonist } : { name: "", role: "", motivation: "", description: "" },
              supporting_characters: Array.isArray(c.supporting_characters)
                ? c.supporting_characters.map((x) => ({ ...x }))
                : [],
            }
          : c
      )
    );
    setEditIdx(i);
  };
  const commitEdit = () => setEditIdx(null);

  const pickConcept = (c) => {
    // Báo cho bản chưa nào biết concept nào đang chốt — hiện form định hướng
    setPicked(c);
  };

  const [picked, setPicked] = useState(null);

  const doUseConcept = (c) => {
    const allChars = [
      ...(c.protagonists || []),
      ...(c.antagonist?.name ? [{ ...c.antagonist, role: c.antagonist.role, description: `${c.antagonist.description || ""}${c.antagonist.motivation ? ` (Động cơ: ${c.antagonist.motivation})` : ""}` }] : []),
      ...(c.supporting_characters || []).map((s) => ({ name: s.name, role: s.role, description: `${s.description || ""}${s.narrative_function ? ` (Vai trò: ${s.narrative_function})` : ""}` })),
    ];
    const ideaText = `Tiêu đề: ${c.title}\nBiến cố khởi đầu: ${c.hook || ""}\nXung đột trung tâm: ${c.conflict || ""}\nBối cảnh: ${c.setting}\nTiền đề: ${c.premise}\nNhân vật chính: ${
      (c.protagonists || []).map((x) => `${x.name} (${x.role})`).join(", ") || "(chưa có)"
    }\nPhản diện / thế lực đối đầu: ${c.antagonist?.name ? `${c.antagonist.name} (${c.antagonist.role}) — ${c.antagonist.motivation || ""}` : "(chưa có)"}\nNhân vật phụ: ${
      (c.supporting_characters || []).map((x) => `${x.name} (${x.narrative_function || x.role})`).join(", ") || "(chưa có)"
    }`;
    onUseConcept(ideaText, allChars);
  };

  if (picked) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="text-[11px] font-semibold text-primary">Ý tưởng đã chốt</div>
          <h3 className="font-display font-semibold mt-0.5">{picked.title}</h3>
          {picked.hook && <p className="text-xs text-foreground/90 mt-1"><b>Biến cố khởi đầu:</b> {picked.hook}</p>}
          {picked.conflict && <p className="text-xs text-foreground/90 mt-1"><b>Xung đột trung tâm:</b> {picked.conflict}</p>}
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
                      value={c.hook || ""}
                      onChange={(e) => setConcepts((cs) => cs.map((x, k) => (k === i ? { ...x, hook: e.target.value } : x)))}
                      rows={2}
                      className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs resize-y"
                      placeholder="Biến cố khởi đầu (hook)"
                    />
                    <textarea
                      value={c.conflict || ""}
                      onChange={(e) => setConcepts((cs) => cs.map((x, k) => (k === i ? { ...x, conflict: e.target.value } : x)))}
                      rows={2}
                      className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs resize-y"
                      placeholder="Xung đột trung tâm"
                    />
                    <textarea
                      value={c.setting}
                      onChange={(e) => setConcepts((cs) => cs.map((x, k) => (k === i ? { ...x, setting: e.target.value } : x)))}
                      rows={2}
                      className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs resize-y"
                      placeholder="Bối cảnh"
                    />
                    <div className="text-[10px] font-semibold text-muted-foreground pt-1">Nhân vật chính</div>
                    <div className="space-y-1">
                      {(c.protagonists || []).map((ch, j) => (
                        <div key={j} className="flex gap-1">
                          <input
                            value={ch.name}
                            onChange={(e) => setConcepts((cs) => cs.map((x, k) => k === i ? { ...x, protagonists: x.protagonists.map((p, q) => q === j ? { ...p, name: e.target.value } : p) } : x))}
                            className="flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                            placeholder="Tên"
                          />
                          <input
                            value={ch.role}
                            onChange={(e) => setConcepts((cs) => cs.map((x, k) => k === i ? { ...x, protagonists: x.protagonists.map((p, q) => q === j ? { ...p, role: e.target.value } : p) } : x))}
                            className="w-20 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                            placeholder="Vai"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] font-semibold text-muted-foreground pt-1">Phản diện / thế lực đối đầu</div>
                    <div className="flex gap-1">
                      <input
                        value={c.antagonist?.name || ""}
                        onChange={(e) => setConcepts((cs) => cs.map((x, k) => k === i ? { ...x, antagonist: { ...x.antagonist, name: e.target.value } } : x))}
                        className="flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                        placeholder="Tên"
                      />
                      <input
                        value={c.antagonist?.role || ""}
                        onChange={(e) => setConcepts((cs) => cs.map((x, k) => k === i ? { ...x, antagonist: { ...x.antagonist, role: e.target.value } } : x))}
                        className="w-20 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                        placeholder="Vai"
                      />
                    </div>
                    <textarea
                      value={c.antagonist?.motivation || ""}
                      onChange={(e) => setConcepts((cs) => cs.map((x, k) => k === i ? { ...x, antagonist: { ...x.antagonist, motivation: e.target.value } } : x))}
                      rows={1}
                      className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs resize-y"
                      placeholder="Động cơ của phản diện"
                    />
                    <div className="text-[10px] font-semibold text-muted-foreground pt-1">Nhân vật phụ</div>
                    <div className="space-y-1">
                      {(c.supporting_characters || []).map((ch, j) => (
                        <div key={j} className="flex gap-1">
                          <input
                            value={ch.name}
                            onChange={(e) => setConcepts((cs) => cs.map((x, k) => k === i ? { ...x, supporting_characters: x.supporting_characters.map((p, q) => q === j ? { ...p, name: e.target.value } : p) } : x))}
                            className="flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                            placeholder="Tên"
                          />
                          <input
                            value={ch.narrative_function || ""}
                            onChange={(e) => setConcepts((cs) => cs.map((x, k) => k === i ? { ...x, supporting_characters: x.supporting_characters.map((p, q) => q === j ? { ...p, narrative_function: e.target.value } : p) } : x))}
                            className="w-24 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                            placeholder="Vai trò"
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
                    {c.hook && (
                      <p className="text-xs text-foreground/90 mt-1.5">
                        <span className="font-medium text-primary">Biến cố:</span> {c.hook}
                      </p>
                    )}
                    {c.conflict && (
                      <p className="text-xs text-foreground/90 mt-1">
                        <span className="font-medium text-primary">Xung đột:</span> {c.conflict}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.premise}</p>
                    <div className="text-[11px] text-muted-foreground mt-2">
                      <span className="font-medium">Bối cảnh:</span> {c.setting}
                    </div>
                    {c.protagonists?.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs">
                        {c.protagonists.map((ch, j) => (
                          <li key={j} className="text-foreground/90">
                            <b>{ch.name}</b> <span className="text-muted-foreground">· {ch.role}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {c.antagonist?.name && (
                      <div className="mt-2 text-xs text-foreground/90">
                        <span className="font-medium text-destructive/80">Phản diện:</span>{" "}
                        <b>{c.antagonist.name}</b> <span className="text-muted-foreground">· {c.antagonist.role}</span>
                      </div>
                    )}
                    {c.supporting_characters?.length > 0 && (
                      <ul className="mt-1.5 space-y-1 text-xs">
                        {c.supporting_characters.map((ch, j) => (
                          <li key={j} className="text-foreground/90">
                            <b>{ch.name}</b>{" "}
                            <span className="text-muted-foreground">· {ch.narrative_function || ch.role}</span>
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