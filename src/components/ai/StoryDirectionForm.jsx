import React, { useState } from "react";
import { useStory } from "@/lib/StoryContext";
import { updateStory } from "@/lib/worldcrud";
import { Compass, Save, Forward } from "lucide-react";

const TONES = ["Nhẹ nhàng", "Kịch tính cao trào", "Hài hước", "U ám"];
const ENDINGS = [
  { value: "HE", label: "Viên mãn (HE)" },
  { value: "SE", label: "Hơi tiếc nuối (SE)" },
  { value: "open", label: "Kết mở" },
  { value: "undecided", label: "Chưa quyết định" },
];

const DEFAULT = {
  lengthMode: "suggest",
  customLength: null,
  ending: "undecided",
  tones: [],
  emphasis: { emotion: 50, plot: 50, action: 50 },
  want: "",
  avoid: "",
};

// Form định hướng xuất hiện sau khi chốt concept — lưu vào Story.direction, dùng context cho AI.
export default function StoryDirectionForm({ onDone }) {
  const { currentStory, refresh } = useStory();
  const [form, setForm] = useState(() => ({ ...DEFAULT, ...(currentStory?.direction || {}) }));
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setEmp = (k, v) => setForm((f) => ({ ...f, emphasis: { ...f.emphasis, [k]: v } }));

  const toggleTone = (t) =>
    setForm((f) => ({
      ...f,
      tones: f.tones.includes(t) ? f.tones.filter((x) => x !== t) : [...f.tones, t],
    }));

  const persist = async (dir) => {
    if (!currentStory) return;
    try {
      await updateStory(currentStory.id, { direction: dir });
      await refresh?.();
    } catch (e) {
      console.error(e);
    }
  };

  const submit = async () => {
    setSaving(true);
    await persist(form);
    setSaving(false);
    onDone?.(form);
  };
  const skip = () => onDone?.(DEFAULT);

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 mt-4">
      <h3 className="font-display font-semibold flex items-center gap-2 text-primary mb-1">
        <Compass className="w-4 h-4" /> Định hướng bộ truyện (tuỳ chọn)
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Thông tin này được lưu vào Story Bible và dùng làm bối cảnh cho mọi lệnh AI sau này (Dàn ý,
        Nối Mạch, Viết). Tất cả đều không bắt buộc.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Độ dài dự kiến</label>
          <div className="flex items-center gap-2 mt-1.5">
            <label className="text-xs flex items-center gap-1.5">
              <input
                type="radio"
                checked={form.lengthMode !== "custom"}
                onChange={() => set("lengthMode", "suggest")}
              />
              Để AI đề xuất
            </label>
            <label className="text-xs flex items-center gap-1.5">
              <input
                type="radio"
                checked={form.lengthMode === "custom"}
                onChange={() => set("lengthMode", "custom")}
              />
              Nhập số chương:
            </label>
            <input
              type="number"
              min={1}
              value={form.customLength ?? ""}
              onChange={(e) => set("customLength", e.target.value ? Number(e.target.value) : null)}
              disabled={form.lengthMode !== "custom"}
              className="w-24 rounded-md border border-input bg-transparent px-2 py-1 text-sm disabled:opacity-50"
              placeholder="VD: 60"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Kiểu kết thúc</label>
          <select
            value={form.ending}
            onChange={(e) => set("ending", e.target.value)}
            className="w-full mt-1.5 rounded-md border border-input bg-transparent px-2.5 py-2 text-sm"
          >
            {ENDINGS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Tông truyện (chọn 1-2)</label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {TONES.map((t) => {
              const on = form.tones.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTone(t)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Yếu tố muốn nhấn mạnh (kéo %)
          </label>
          <div className="space-y-2">
            {[
              { key: "emotion", label: "Tình cảm" },
              { key: "plot", label: "Âm mưu / Chính trị" },
              { key: "action", label: "Hành động / Võ hiệp" },
            ].map((s) => (
              <div key={s.key} className="flex items-center gap-3">
                <span className="text-xs w-28 shrink-0">{s.label}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.emphasis?.[s.key] ?? 50}
                  onChange={(e) => setEmp(s.key, Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="text-xs w-8 text-right text-muted-foreground">
                  {form.emphasis?.[s.key] ?? 50}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Điều muốn có</label>
          <textarea
            value={form.want}
            onChange={(e) => set("want", e.target.value)}
            rows={2}
            placeholder="VD: nhiều khắc họa nội tâm, có cảnh trà đạo..."
            className="w-full mt-1.5 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Điều muốn tránh</label>
          <textarea
            value={form.avoid}
            onChange={(e) => set("avoid", e.target.value)}
            rows={2}
            placeholder="VD: tránh hậu cung, tránh từ lóng hiện đại..."
            className="w-full mt-1.5 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? "Đang lưu..." : "Lưu & Chốt ý tưởng"}
        </button>
        <button
          onClick={skip}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition"
        >
          <Forward className="w-4 h-4" /> Bỏ qua, dùng mặc định
        </button>
      </div>
    </div>
  );
}