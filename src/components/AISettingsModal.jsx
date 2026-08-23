import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2, KeyRound, Check, Trash2, Plus, UserRound } from "lucide-react";
import {
  getCustomKey,
  setCustomKey,
  getCustomModel,
  setCustomModel,
  getAIProvider,
  setAIProvider,
  getCustomProviderConfig,
  setCustomProviderConfig,
  testAIConnection,
  KNOWN_RELAY_PROVIDERS,
  getAIProfiles,
  getActiveAIProfileId,
  saveAIProfile,
  activateAIProfile,
  deleteAIProfile,
  getAIUsageToday,
} from "@/lib/aiCall";
import { GEMINI_MODELS } from "@/lib/geminiModels";

const DEFAULT_MODEL_ID = "gemini-3.1-flash-lite";

export default function AISettingsModal({ open, onOpenChange }) {
  const [provider, setProvider] = useState(getAIProvider());

  const [key, setKey] = useState(getCustomKey());
  const [model, setModel] = useState(getCustomModel());
  const [show, setShow] = useState(false);

  const customCfg = getCustomProviderConfig();
  const [cProviderId, setCProviderId] = useState(customCfg.providerId || "stali");
  const [cBaseUrl, setCBaseUrl] = useState(customCfg.baseUrl);
  const [cKey, setCKey] = useState(customCfg.key);
  const [cModel, setCModel] = useState(customCfg.model);
  const [cShow, setCShow] = useState(false);
  const isOtherProvider = cProviderId === "other";

  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState({ type: "", text: "" });
  const [saved, setSaved] = useState(false);
  const [profiles, setProfiles] = useState(getAIProfiles());
  const [activeProfileId, setActiveProfileId] = useState(getActiveAIProfileId());
  const [profileName, setProfileName] = useState("");
  const usage = getAIUsageToday();

  const isCustom = provider === "custom";

  const save = () => {
    setAIProvider(provider);
    setCustomKey(key.trim());
    setCustomModel(model);
    setCustomProviderConfig({ providerId: cProviderId, baseUrl: cBaseUrl, key: cKey, model: cModel });
    const active = profiles.find((item) => item.id === activeProfileId);
    if (active) {
      saveAIProfile(isCustom
        ? { ...active, provider: "custom", custom: { providerId: cProviderId, baseUrl: cBaseUrl.trim(), key: cKey.trim(), model: cModel.trim() } }
        : { ...active, provider: "gemini", key: key.trim(), model });
      setProfiles(getAIProfiles());
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const clear = () => {
    if (isCustom) {
      setCBaseUrl(""); setCKey(""); setCModel("");
      setCustomProviderConfig({ providerId: cProviderId, baseUrl: "", key: "", model: "" });
    } else {
      setKey("");
      setCustomKey("");
    }
    setTestMsg({ type: "", text: "" });
  };

  const saveAsProfile = () => {
    if (!profileName.trim() || !canSave) return;
    const row = saveAIProfile(isCustom
      ? { name: profileName.trim(), provider: "custom", custom: { providerId: cProviderId, baseUrl: cBaseUrl.trim(), key: cKey.trim(), model: cModel.trim() } }
      : { name: profileName.trim(), provider: "gemini", key: key.trim(), model });
    activateAIProfile(row.id);
    setProfiles(getAIProfiles()); setActiveProfileId(row.id); setProfileName("");
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  const selectProfile = (id) => {
    const row = activateAIProfile(id);
    setActiveProfileId(id); setProvider(row.provider);
    if (row.provider === "custom") {
      setCProviderId(row.custom?.providerId || "other"); setCBaseUrl(row.custom?.baseUrl || ""); setCKey(row.custom?.key || ""); setCModel(row.custom?.model || "");
    } else { setKey(row.key || ""); setModel(row.model || DEFAULT_MODEL_ID); }
    setTestMsg({ type: "", text: "" });
  };

  const removeProfile = (id) => {
    deleteAIProfile(id); setProfiles(getAIProfiles());
    if (activeProfileId === id) setActiveProfileId("");
  };

  const test = async () => {
    setTesting(true);
    setTestMsg({ type: "", text: "" });
    try {
      await testAIConnection(
        isCustom
          ? { provider: "custom", providerId: cProviderId, baseUrl: cBaseUrl.trim(), key: cKey.trim(), model: cModel.trim() }
          : { provider: "gemini", key: key.trim(), model }
      );
      setTestMsg({ type: "ok", text: "Kết nối thành công! Cấu hình hợp lệ." });
    } catch (e) {
      setTestMsg({ type: "err", text: "Kết nối thất bại: " + (e?.message || "lỗi") });
    } finally {
      setTesting(false);
    }
  };

  const canTest = isCustom ? !!(cKey.trim() && cModel.trim() && (!isOtherProvider || cBaseUrl.trim())) : !!key.trim();
  const canSave = canTest;
  const hasSomethingToClear = isCustom ? !!(cBaseUrl || cKey || cModel) : !!key;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" /> Quản lý AI API Key
          </DialogTitle>
          <DialogDescription>Chọn thủ công hồ sơ Gemini hoặc cổng API dùng cho các tính năng sáng tác.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-2"><UserRound className="w-4 h-4 text-primary" /><div><div className="text-sm font-medium">Hồ sơ AI</div><div className="text-[11px] text-muted-foreground">Chọn thủ công; hệ thống không tự xoay key khi hết quota.</div></div></div>
            {!!profiles.length && <div className="space-y-1.5">{profiles.map((item) => <div key={item.id} className={`flex items-center gap-2 rounded-md border px-2.5 py-2 ${activeProfileId === item.id ? "border-primary bg-primary/10" : "border-border bg-background"}`}><button type="button" onClick={() => selectProfile(item.id)} className="flex-1 text-left"><div className="text-xs font-medium">{item.name}</div><div className="text-[10px] text-muted-foreground">{item.provider === "gemini" ? `Gemini · ${item.model}` : `${item.custom?.providerId || "API khác"} · ${item.custom?.model || "?"}`}</div></button>{activeProfileId === item.id && <span className="text-[10px] text-primary">Đang dùng</span>}<button type="button" onClick={() => removeProfile(item.id)} className="text-muted-foreground hover:text-destructive" title="Xóa hồ sơ"><Trash2 className="w-3.5 h-3.5" /></button></div>)}</div>}
            <div className="flex gap-2"><input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Tên hồ sơ, ví dụ Gemini chính" className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs" /><button type="button" onClick={saveAsProfile} disabled={!profileName.trim() || !canSave} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-primary/40 text-primary text-xs disabled:opacity-40"><Plus className="w-3.5 h-3.5" /> Lưu thành hồ sơ</button></div>
            <div className="text-[10px] text-muted-foreground">Hôm nay: {usage.calls} lượt gọi · cache đã tránh {usage.cacheHits} lượt.</div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nhà cung cấp AI</label>
            <div className="flex gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => { setProvider("gemini"); setTestMsg({ type: "", text: "" }); }}
                className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition ${
                  !isCustom ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"
                }`}
              >
                Google Gemini
              </button>
              <button
                type="button"
                onClick={() => { setProvider("custom"); setTestMsg({ type: "", text: "" }); }}
                className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition ${
                  isCustom ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"
                }`}
              >
                Cổng API tuỳ chỉnh
              </button>
            </div>
          </div>

          {!isCustom && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Google Gemini API Key</label>
                <div className="relative mt-1">
                  <input
                    type={show ? "text" : "password"}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="Nhập Google Gemini API Key của bạn"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 pr-9 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={show ? "Ẩn" : "Hiện"}
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full mt-1 rounded-md border border-input bg-transparent px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {GEMINI_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} — {m.perMinute}/phút, {m.perDay}/ngày
                      {m.id === DEFAULT_MODEL_ID ? " (mặc định)" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Hạn mức theo trang aistudio.google.com/rate-limit — có thể đổi theo thời gian, kiểm
                  tra lại trang đó nếu nghi ngờ hoặc gặp lỗi kết nối.
                </p>
              </div>
            </>
          )}

          {isCustom && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nhà cung cấp</label>
                <div className="flex gap-2 mt-1.5">
                  {Object.entries(KNOWN_RELAY_PROVIDERS).map(([id, p]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => { setCProviderId(id); setTestMsg({ type: "", text: "" }); }}
                      className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition ${
                        cProviderId === id ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setCProviderId("other"); setTestMsg({ type: "", text: "" }); }}
                    className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition ${
                      isOtherProvider ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Khác
                  </button>
                </div>
                {!isOtherProvider ? (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Gọi qua trạm trung chuyển riêng của app (Stali/EcoAPI không cho trình duyệt gọi thẳng) —
                    <b> chỉ hoạt động trên bản đã deploy lên Vercel</b>, không chạy được khi chạy thử ở máy (npm run dev).
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-600 mt-1.5">
                    Gọi thẳng từ trình duyệt — chỉ hoạt động nếu nhà cung cấp đó có bật CORS cho web, không có gì đảm bảo trước.
                  </p>
                )}
              </div>
              {isOtherProvider && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Base URL</label>
                  <input
                    type="text"
                    value={cBaseUrl}
                    onChange={(e) => setCBaseUrl(e.target.value)}
                    placeholder="vd: https://api.example.com/v1"
                    className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Hệ thống sẽ gọi tới <code className="px-1 py-0.5 rounded bg-muted">{"{Base URL}"}/chat/completions</code> theo chuẩn OpenAI Chat Completions.
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground">API Key</label>
                <div className="relative mt-1">
                  <input
                    type={cShow ? "text" : "password"}
                    value={cKey}
                    onChange={(e) => setCKey(e.target.value)}
                    placeholder="Nhập API Key của nhà cung cấp"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 pr-9 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setCShow((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={cShow ? "Ẩn" : "Hiện"}
                  >
                    {cShow ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tên Model</label>
                <input
                  type="text"
                  value={cModel}
                  onChange={(e) => setCModel(e.target.value)}
                  placeholder="vd: gemini-2.5-flash, gpt-5.6-sol, claude-sonnet-4-6..."
                  className="w-full mt-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Tên model đúng như bên cung cấp liệt kê (xem trang tài liệu/dashboard của họ).
                </p>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={test}
              disabled={testing || !canTest}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-primary/50 text-primary text-sm font-medium hover:bg-primary/10 disabled:opacity-50 transition"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Kiểm tra kết nối
            </button>
            <button
              onClick={save}
              disabled={!canSave}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
            >
              <Check className="w-4 h-4" /> Lưu
            </button>
            {hasSomethingToClear && (
              <button
                onClick={clear}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-muted-foreground text-sm hover:bg-muted hover:text-destructive transition"
              >
                <Trash2 className="w-4 h-4" /> Xóa
              </button>
            )}
          </div>

          {testMsg.text && (
            <div
              className={`text-xs rounded-md px-3 py-2 ${
                testMsg.type === "ok"
                  ? "text-emerald-600 bg-emerald-500/10"
                  : "text-destructive bg-destructive/10"
              }`}
            >
              {testMsg.text}
            </div>
          )}
          {saved && (
            <div className="text-xs text-emerald-600 bg-emerald-500/10 rounded-md px-3 py-2 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Đã lưu cấu hình AI.
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            {isCustom
              ? "Base URL/API Key/Model lưu trong localStorage của trình duyệt, gửi thẳng tới nhà cung cấp bạn chọn — bên này không giữ hộ."
              : "API Key lưu trong localStorage của trình duyệt, gửi thẳng tới Google AI Studio."}{" "}
            Bắt buộc phải có cấu hình hợp lệ — không có thì mọi tính năng AI sẽ báo lỗi.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
