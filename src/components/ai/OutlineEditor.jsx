import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  Layers,
  Clock,
  Pencil,
  Check,
  X,
  Bot,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Loader2,
} from "lucide-react";

// Trình soạn thảo dàn ý — sửa trực tiếp / AI viết lại từng phần / thêm-xoá-keo-thả chương.
export default function OutlineEditor({
  arc,
  onArcChange,
  onRegenChapter,
  onRegenArc,
  onRegenAll,
  regenBusy,
  regenAllBusy,
}) {
  const [editingArc, setEditingArc] = useState(null);
  const [editingCh, setEditingCh] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
  const [noteText, setNoteText] = useState("");

  const chapters = arc?.chapters || [];
  const arcs = arc?.arcs || [];

  const patchChapters = (next) => {
    // Re-number tuần tự sau khi đổi / thêm / xoá
    const renum = next.map((c, i) => ({ ...c, chapter_number: c.chapter_number ?? i + 1 }));
    renum.forEach((c, i) => {
      c.chapter_number = i + 1;
    });
    onArcChange({ ...arc, chapters: renum });
  };
  const updateChapterField = (idx, patch) =>
    patchChapters(chapters.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  const addChapterAt = (at) => {
    const base = [
      { chapter_number: 0, arc_name: "", title: "Chương mới", summary: "", key_events: [] },
    ];
    const next = [...chapters.slice(0, at), ...base, ...chapters.slice(at)];
    patchChapters(next);
  };
  const deleteChapter = (idx) =>
    patchChapters(chapters.filter((_, i) => i !== idx));

  const moveArc = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= arcs.length) return;
    const next = [...arcs];
    [next[i], next[j]] = [next[j], next[i]];
    onArcChange({ ...arc, arcs: next });
  };
  const updateArcField = (i, patch) =>
    onArcChange({ ...arc, arcs: arcs.map((a, k) => (k === i ? { ...a, ...patch } : a)) });

  const onDragEndChapters = (res) => {
    if (!res.destination || res.destination.index === res.source.index) return;
    const next = [...chapters];
    const [moved] = next.splice(res.source.index, 1);
    next.splice(res.destination.index, 0, moved);
    patchChapters(next);
  };

  const startNote = (type, idx) => {
    setNoteFor({ type, idx });
    setNoteText("");
  };
  const sendNote = () => {
    if (!noteFor) return;
    if (noteFor.type === "chapter") onRegenChapter(noteFor.idx, noteText.trim());
    else onRegenArc(noteFor.idx, noteText.trim());
    setNoteFor(null);
    setNoteText("");
  };

  const busy = (type, idx) =>
    regenBusy && regenBusy.type === type && regenBusy.idx === idx;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-sm font-medium">
          Tổng số chương: <b>{arc?.total_chapters || chapters.length || "?"}</b>
        </div>
        <button
          onClick={() => startNote("all", -1)}
          disabled={regenAllBusy}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-primary text-primary text-xs font-medium hover:bg-primary/10 disabled:opacity-50"
        >
          {regenAllBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sinh lại toàn bộ nhưng giữ cấu trúc
        </button>
      </div>

      {noteFor?.type === "all" && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5 flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary shrink-0" />
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Góp ý định hướng (tuỳ chọn) — VD: nhẹ nhàng hơn, thêm xung đột gia tộc..."
            className="flex-1 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs"
          />
          <button onClick={sendNote} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs">
            Sinh lại
          </button>
          <button onClick={() => setNoteFor(null)} className="p-1.5 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Arcs */}
      {arcs.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="font-display font-semibold flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-primary" /> Các Arc (Màn)
          </h3>
          <div className="space-y-2">
            {arcs.map((a, i) => (
              <div key={i} className="rounded-lg border border-border px-3 py-2">
                {editingArc === i ? (
                  <div className="space-y-2">
                    <input
                      value={a.name}
                      onChange={(e) => updateArcField(i, { name: e.target.value })}
                      placeholder="Tên arc"
                      className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm"
                    />
                    <input
                      value={a.from_chapter}
                      type="number"
                      onChange={(e) => updateArcField(i, { from_chapter: Number(e.target.value) })}
                      className="w-24 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm"
                    />
                    <input
                      value={a.to_chapter}
                      type="number"
                      onChange={(e) => updateArcField(i, { to_chapter: Number(e.target.value) })}
                      className="w-24 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm ml-2"
                    />
                    <textarea
                      value={a.summary || ""}
                      onChange={(e) => updateArcField(i, { summary: e.target.value })}
                      rows={2}
                      placeholder="Tóm tắt arc"
                      className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm resize-y"
                    />
                    <button
                      onClick={() => setEditingArc(null)}
                      className="inline-flex items-center gap-1 text-xs text-primary"
                    >
                      <Check className="w-3.5 h-3.5" /> Xong
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <b className="text-primary text-sm">{a.name}</b>
                      <span className="text-[11px] text-muted-foreground">Ch.{a.from_chapter}–{a.to_chapter}</span>
                      <div className="ml-auto flex items-center gap-1">
                        <button onClick={() => moveArc(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30" title="Lên"><ChevronUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => moveArc(i, 1)} disabled={i === arcs.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30" title="Xuống"><ChevronDown className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingArc(i)} className="p-1 rounded hover:bg-muted" title="Sửa"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => startNote("arc", i)} disabled={busy("arc", i)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-primary/40 text-primary hover:bg-primary/10" title="AI viết lại arc này">
                          {busy("arc", i) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />} Viết lại
                        </button>
                      </div>
                    </div>
                    {a.summary && <p className="text-xs text-muted-foreground mt-1">{a.summary}</p>}
                    {noteFor?.type === "arc" && noteFor.idx === i && (
                      <NoteInput
                        value={noteText}
                        setValue={setNoteText}
                        onSend={sendNote}
                        onCancel={() => setNoteFor(null)}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chapters with DnD */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-display font-semibold flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-primary" /> Danh sách chương & sự kiện
        </h3>
        <DragDropContext onDragEnd={onDragEndChapters}>
          <Droppable droppableId="chapters">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {chapters.map((ch, i) => (
                  <Draggable key={i} draggableId={String(i)} index={i}>
                    {(p) => (
                      <div
                        ref={p.innerRef}
                        {...p.draggableProps}
                        className="rounded-lg border border-border p-3 bg-card"
                      >
                        <div className="flex items-center gap-2">
                          <span {...p.dragHandleProps} className="cursor-grab text-muted-foreground">
                            <GripVertical className="w-4 h-4" />
                          </span>
                          <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                            Ch.{ch.chapter_number}
                          </span>
                          {editingCh === i ? (
                            <input
                              value={ch.title}
                              onChange={(e) => updateChapterField(i, { title: e.target.value })}
                              className="flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                            />
                          ) : (
                            <b className="text-sm flex-1">{ch.title}</b>
                          )}
                          <div className="flex items-center gap-1">
                            {editingCh === i ? (
                              <button onClick={() => setEditingCh(null)} className="p-1 rounded hover:bg-muted text-primary" title="Xong"><Check className="w-3.5 h-3.5" /></button>
                            ) : (
                              <button onClick={() => setEditingCh(i)} className="p-1 rounded hover:bg-muted" title="Sửa"><Pencil className="w-3.5 h-3.5" /></button>
                            )}
                            <button onClick={() => startNote("chapter", i)} disabled={busy("chapter", i)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-primary/40 text-primary hover:bg-primary/10" title="AI viết lại chương này">
                              {busy("chapter", i) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />} Viết lại
                            </button>
                            <button onClick={() => deleteChapter(i)} className="p-1 rounded hover:bg-muted hover:text-destructive" title="Xoá chương"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>

                        {editingCh === i ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={ch.summary || ""}
                              onChange={(e) => updateChapterField(i, { summary: e.target.value })}
                              rows={2}
                              placeholder="Tóm tắt chương"
                              className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm resize-y"
                            />
                            <textarea
                              value={(ch.key_events || []).join("\n")}
                              onChange={(e) => updateChapterField(i, { key_events: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                              rows={3}
                              placeholder="Sự kiện chính (mỗi dòng 1 sự kiện)"
                              className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm resize-y"
                            />
                          </div>
                        ) : (
                          <div className="mt-1">
                            {ch.summary && <p className="text-xs text-muted-foreground">{ch.summary}</p>}
                            {ch.key_events?.length > 0 && (
                              <ul className="mt-1.5 list-disc list-inside text-xs space-y-0.5">
                                {ch.key_events.map((e, j) => (
                                  <li key={j}>{e}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {noteFor?.type === "chapter" && noteFor.idx === i && (
                          <NoteInput
                            value={noteText}
                            setValue={setNoteText}
                            onSend={sendNote}
                            onCancel={() => setNoteFor(null)}
                          />
                        )}

                        <button
                          onClick={() => addChapterAt(i + 1)}
                          className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
                        >
                          <Plus className="w-3 h-3" /> Chèn chương mới phía dưới
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        <button
          onClick={() => addChapterAt(chapters.length)}
          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:bg-muted"
        >
          <Plus className="w-3.5 h-3.5" /> Thêm chương mới
        </button>
      </div>
    </div>
  );
}

function NoteInput({ value, setValue, onSend, onCancel }) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 p-2">
      <Bot className="w-3.5 h-3.5 text-primary shrink-0" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Góp ý cho AI (tuỳ chọn): VD: kịch tính hơn, bớt miêu tả..."
        className="flex-1 text-xs bg-transparent outline-none"
      />
      <button onClick={onSend} className="px-2.5 py-1 rounded bg-primary text-primary-foreground text-[11px]">Gửi</button>
      <button onClick={onCancel} className="p-1 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}