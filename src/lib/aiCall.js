// =============================================================================
// AI Call — gọi thẳng tới nhà cung cấp AI bằng key riêng của người dùng (lưu ở
// localStorage). Không còn backend trung gian nào giữ key hộ — mỗi người dùng
// phải tự nhập key riêng ở phần Cài đặt AI.
//
// Hỗ trợ 2 nhà cung cấp:
//   - "gemini": gọi thẳng Google AI Studio (mặc định, miễn phí, có bật CORS
//     cho trình duyệt nên gọi thẳng được).
//   - "custom": chuẩn OpenAI Chat Completions. Với các dịch vụ ĐÃ XÁC MINH
//     không bật CORS cho trình duyệt (Stali, EcoAPI — kiểm chứng bằng
//     preflight request thật, khác Gemini/OpenAI/Claude chính chủ), phải đi
//     qua trạm trung chuyển `/api/ai-relay?provider=...` (Vercel Serverless,
//     xem api/ai-relay.js) — CHỈ hoạt động sau khi deploy lên Vercel, KHÔNG
//     chạy được ở `npm run dev` local. Nếu người dùng nhập một Base URL khác
//     (không nằm trong KNOWN_RELAY_PROVIDERS), gọi thẳng — có thể lỗi CORS
//     tuỳ nhà cung cấp đó có bật hay không, không có gì đảm bảo.
// =============================================================================

const KEY_STORAGE = "fiction_ai_gemini_key";
const MODEL_STORAGE = "fiction_ai_gemini_model";
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const CACHE_STORAGE = "fiction_ai_response_cache_v1";
const USAGE_STORAGE = "fiction_ai_daily_usage_v1";
const PROFILES_STORAGE = "fiction_ai_profiles_v1";
const ACTIVE_PROFILE_STORAGE = "fiction_ai_active_profile_v1";
const inFlightRequests = new Map();

const PROVIDER_STORAGE = "fiction_ai_provider";
const CUSTOM_PROVIDER_ID_STORAGE = "fiction_ai_custom_provider_id";
const CUSTOM_BASEURL_STORAGE = "fiction_ai_custom_baseurl";
const CUSTOM_KEY_STORAGE = "fiction_ai_custom_key";
const CUSTOM_MODEL_STORAGE = "fiction_ai_custom_model";

// Nhà cung cấp đã xác minh không bật CORS trình duyệt — bắt buộc đi qua relay.
export const KNOWN_RELAY_PROVIDERS = {
  stali: { label: "Stali", baseUrl: "https://api.stali.vn/v1" },
  ecoapi: { label: "EcoAPI", baseUrl: "https://ecoapi.net/v1" },
};

function lsGet(key, fallback = "") {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function lsSet(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
}

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36);
}

function readJsonStorage(name, fallback) {
  try { return JSON.parse(lsGet(name, "")) || fallback; } catch { return fallback; }
}

function cacheKeyFor(prompt, schema) {
  const provider = getAIProvider();
  const model = provider === "custom" ? getCustomProviderConfig().model : getCustomModel();
  return hashText(`${provider}|${model}|${prompt}|${JSON.stringify(schema || null)}`);
}

function readCache(key) {
  const cache = readJsonStorage(CACHE_STORAGE, []);
  const hit = cache.find((entry) => entry.key === key && Date.now() - entry.time < 7 * 86400000);
  return hit?.value;
}

function writeCache(key, value) {
  try {
    const cache = readJsonStorage(CACHE_STORAGE, []).filter((entry) => entry.key !== key && Date.now() - entry.time < 7 * 86400000).slice(-39);
    cache.push({ key, time: Date.now(), value });
    lsSet(CACHE_STORAGE, JSON.stringify(cache));
  } catch {}
}

function recordUsage(calls = 1) {
  const today = new Date().toISOString().slice(0, 10);
  const usage = readJsonStorage(USAGE_STORAGE, { date: today, calls: 0, cacheHits: 0 });
  const next = usage.date === today ? usage : { date: today, calls: 0, cacheHits: 0 };
  next.calls += calls;
  lsSet(USAGE_STORAGE, JSON.stringify(next));
}

function recordCacheHit() {
  const today = new Date().toISOString().slice(0, 10);
  const usage = readJsonStorage(USAGE_STORAGE, { date: today, calls: 0, cacheHits: 0 });
  const next = usage.date === today ? usage : { date: today, calls: 0, cacheHits: 0 };
  next.cacheHits += 1;
  lsSet(USAGE_STORAGE, JSON.stringify(next));
}

export function getAIUsageToday() {
  const today = new Date().toISOString().slice(0, 10);
  const usage = readJsonStorage(USAGE_STORAGE, { date: today, calls: 0, cacheHits: 0 });
  return usage.date === today ? usage : { date: today, calls: 0, cacheHits: 0 };
}

export function getAIProfiles() {
  return readJsonStorage(PROFILES_STORAGE, []);
}

export function getActiveAIProfileId() {
  return lsGet(ACTIVE_PROFILE_STORAGE, "");
}

export function saveAIProfile(profile) {
  const profiles = getAIProfiles();
  const id = profile.id || `profile_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const row = { ...profile, id, name: String(profile.name || "Hồ sơ AI").trim(), updatedAt: new Date().toISOString() };
  const next = [...profiles.filter((item) => item.id !== id), row].slice(-10);
  lsSet(PROFILES_STORAGE, JSON.stringify(next));
  return row;
}

export function activateAIProfile(id) {
  const profile = getAIProfiles().find((item) => item.id === id);
  if (!profile) throw new Error("Không tìm thấy hồ sơ AI.");
  setAIProvider(profile.provider);
  if (profile.provider === "custom") setCustomProviderConfig(profile.custom || {});
  else { setCustomKey(profile.key || ""); setCustomModel(profile.model || DEFAULT_MODEL); }
  lsSet(ACTIVE_PROFILE_STORAGE, id);
  return profile;
}

export function deleteAIProfile(id) {
  lsSet(PROFILES_STORAGE, JSON.stringify(getAIProfiles().filter((item) => item.id !== id)));
  if (getActiveAIProfileId() === id) lsSet(ACTIVE_PROFILE_STORAGE, "");
}

// ---------- Gemini (mặc định) ----------
export function getCustomKey() {
  return lsGet(KEY_STORAGE);
}
export function setCustomKey(key) {
  lsSet(KEY_STORAGE, key);
}
export function getCustomModel() {
  return lsGet(MODEL_STORAGE, DEFAULT_MODEL);
}
export function setCustomModel(model) {
  lsSet(MODEL_STORAGE, model || DEFAULT_MODEL);
}

// ---------- Nhà cung cấp đang chọn ----------
export function getAIProvider() {
  const p = lsGet(PROVIDER_STORAGE, "gemini");
  return p === "custom" ? "custom" : "gemini";
}
export function setAIProvider(provider) {
  lsSet(PROVIDER_STORAGE, provider === "custom" ? "custom" : "gemini");
}

// Suy luận providerId cho cấu hình LƯU TỪ TRƯỚC khi có lựa chọn Stali/EcoAPI
// (chỉ có Base URL tự gõ) — nếu không suy luận, cấu hình cũ sẽ bị hiểu nhầm
// thành "other" và tiếp tục gọi thẳng (lỗi CORS) dù người dùng không đổi gì.
function inferProviderId(baseUrl) {
  if (!baseUrl) return "stali";
  if (baseUrl.includes("api.stali.vn")) return "stali";
  if (baseUrl.includes("ecoapi.net")) return "ecoapi";
  return "other";
}

// ---------- Cổng API tuỳ chỉnh (OpenAI-compatible) ----------
// providerId: "stali" | "ecoapi" (đi qua relay) hoặc "other" (URL tự do, gọi thẳng).
export function getCustomProviderConfig() {
  const baseUrl = lsGet(CUSTOM_BASEURL_STORAGE);
  const rawProviderId = lsGet(CUSTOM_PROVIDER_ID_STORAGE, "");
  return {
    providerId: rawProviderId || inferProviderId(baseUrl),
    baseUrl,
    key: lsGet(CUSTOM_KEY_STORAGE),
    model: lsGet(CUSTOM_MODEL_STORAGE),
  };
}
export function setCustomProviderConfig({ providerId, baseUrl, key, model }) {
  lsSet(CUSTOM_PROVIDER_ID_STORAGE, providerId || "other");
  lsSet(CUSTOM_BASEURL_STORAGE, (baseUrl || "").trim().replace(/\/+$/, ""));
  lsSet(CUSTOM_KEY_STORAGE, (key || "").trim());
  lsSet(CUSTOM_MODEL_STORAGE, (model || "").trim());
}

export function hasCustomKey() {
  if (getAIProvider() === "custom") {
    const { providerId, baseUrl, key, model } = getCustomProviderConfig();
    if (!key || !model) return false;
    return providerId === "other" ? !!baseUrl : !!KNOWN_RELAY_PROVIDERS[providerId];
  }
  return !!getCustomKey();
}

function safeJsonParse(text) {
  if (!text) throw new Error("Phản hồi AI rỗng.");
  try {
    return JSON.parse(text);
  } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {}
  }
  throw new Error("Không phân tích được JSON từ AI: " + text.slice(0, 200));
}

function jsonInstructionSuffix(jsonSchema, compact) {
  if (!jsonSchema) return "";
  return `\n\nTrả JSON đúng schema sau (KHÔNG kèm giải thích):\n${JSON.stringify(jsonSchema)}${
    compact
      ? "\n\nLẦN TRƯỚC PHẢN HỒI ĐÃ BỊ CẮT. Hãy trả lại TOÀN BỘ JSON, viết súc tích, mỗi trường tối đa 1-2 câu và tuyệt đối không bỏ dở chuỗi JSON."
      : ""
  }`;
}

async function callGeminiNative(prompt, jsonSchema, { compact = false, onRequest = () => {} } = {}) {
  const key = getCustomKey();
  const model = getCustomModel();
  const finalPrompt = prompt + jsonInstructionSuffix(jsonSchema, compact);
  const body = {
    contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
  };
  if (jsonSchema) {
    // Mặc định của một số model khá thấp và có thể cắt JSON giữa chuỗi.
    // 8192 đủ cho các schema lớn (concept/architecture/scene cards) nhưng vẫn
    // giữ phản hồi trong giới hạn hợp lý của các model Gemini phổ biến.
    body.generationConfig = {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;
  onRequest();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json().catch(() => ({}));
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("");
  return {
    text,
    finishReason: data?.candidates?.[0]?.finishReason || "",
  };
}

// Cổng API tuỳ chỉnh, chuẩn OpenAI Chat Completions — dùng cho các dịch vụ
// như Stali, EcoAPI (chỉ cần chọn nhà cung cấp + API Key + tên model), hoặc
// một Base URL tự nhập khác (gọi thẳng, best-effort).
async function callOpenAICompatible(prompt, jsonSchema, { compact = false, onRequest = () => {} } = {}) {
  const { providerId, baseUrl, key, model } = getCustomProviderConfig();
  if (!key || !model || (providerId === "other" && !baseUrl)) {
    throw new Error(
      "Chưa cấu hình đủ Cổng API tuỳ chỉnh (Nhà cung cấp/Base URL / API Key / Model). Vào Cài đặt AI để nhập đầy đủ."
    );
  }
  const finalPrompt = prompt + jsonInstructionSuffix(jsonSchema, compact);
  const body = {
    model,
    messages: [{ role: "user", content: finalPrompt }],
    max_tokens: 8192,
  };
  if (jsonSchema) body.response_format = { type: "json_object" };

  const isKnownRelay = KNOWN_RELAY_PROVIDERS[providerId];
  const url = isKnownRelay ? `/api/ai-relay?provider=${providerId}` : `${baseUrl}/chat/completions`;
  onRequest();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Cổng API HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json().catch(() => ({}));
  const text = data?.choices?.[0]?.message?.content || "";
  return {
    text,
    finishReason: data?.choices?.[0]?.finish_reason || "",
  };
}

async function callProvider(prompt, jsonSchema, opts) {
  return getAIProvider() === "custom"
    ? callOpenAICompatible(prompt, jsonSchema, opts)
    : callGeminiNative(prompt, jsonSchema, opts);
}

// Test kết nối với thông số NHÁP (chưa lưu) từ màn hình Cài đặt AI.
export async function testAIConnection({ provider, key, model, baseUrl, providerId }) {
  if (provider === "custom") {
    if (!key || !model || (providerId === "other" && !baseUrl)) throw new Error("Chưa nhập đủ Nhà cung cấp/Base URL / API Key / Model.");
    const isKnownRelay = KNOWN_RELAY_PROVIDERS[providerId];
    const url = isKnownRelay ? `/api/ai-relay?provider=${providerId}` : `${baseUrl.trim().replace(/\/+$/, "")}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "ping, hãy trả: ok" }], max_tokens: 32 }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Lỗi ${res.status}: ${t.slice(0, 240)}`);
    }
    const data = await res.json().catch(() => ({}));
    const text = data?.choices?.[0]?.message?.content || "";
    if (!text) throw new Error("Phản hồi rỗng — kiểm tra lại Base URL/API Key/Model.");
    return true;
  }
  // Gemini
  if (!key) throw new Error("Chưa nhập API Key.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ping, hãy trả: ok" }] }] }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Lỗi ${res.status}: ${t.slice(0, 240)}`);
  }
  const data = await res.json().catch(() => ({}));
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  if (!text) throw new Error("Phản hồi rỗng — API Key có thể không hợp lệ.");
  return true;
}

// Giữ lại tên cũ (tương thích ngược) — mặc định test Gemini.
export async function testGeminiConnection(key, model) {
  return testAIConnection({ provider: "gemini", key, model, baseUrl: "", providerId: "gemini" });
}

// Gọi AI — bắt buộc phải có cấu hình (Gemini key, hoặc Cổng API tuỳ chỉnh đầy đủ).
/**
 * @param {string} prompt
 * @param {{ jsonSchema?: Record<string, any>, useCache?: boolean, forceRefresh?: boolean, maxAttempts?: number, onRequest?: () => void }} [options]
 */
async function executeAICall(prompt, { jsonSchema, useCache = true, forceRefresh = false, maxAttempts = 2, onRequest = () => {} } = {}) {
  if (![1, 2].includes(maxAttempts)) throw new Error('Số lần thử AI phải là 1 hoặc 2.');
  if (!hasCustomKey()) {
    throw new Error(
      getAIProvider() === "custom"
        ? "Chưa cấu hình đủ Cổng API tuỳ chỉnh. Vào Cài đặt AI để nhập Base URL/API Key/Model."
        : "Chưa có Gemini API Key. Vào Cài đặt AI để nhập key riêng (miễn phí) trước khi dùng tính năng này."
    );
  }
  const cacheKey = cacheKeyFor(prompt, jsonSchema);
  if (useCache && !forceRefresh) {
    const cached = readCache(cacheKey);
    if (cached !== undefined) { recordCacheHit(); return cached; }
  }
  let first;
  try { first = await callProvider(prompt, jsonSchema, { onRequest }); recordUsage(1); }
  catch (error) {
    if (/429|quota|rate.?limit|resource_exhausted/i.test(error?.message || "")) throw new Error(`${error.message} · Tiến độ đã lưu; hãy dùng “Tiếp tục phần còn thiếu” sau khi quota được mở lại.`);
    throw error;
  }
  if (!jsonSchema) { if (useCache) writeCache(cacheKey, first.text); return first.text; }

  try {
    const parsed = safeJsonParse(first.text); if (useCache) writeCache(cacheKey, parsed); return parsed;
  } catch (firstError) {
    if (maxAttempts === 1) throw new Error(`${firstError.message}. Đã dừng sau 1 lượt theo ngân sách; chưa tự gọi lại AI. Hãy giảm số ô hoặc độ dài yêu cầu nếu phản hồi bị cắt.`);
    // JSON có thể bị cắt vì MAX_TOKENS hoặc đôi khi model tạo ký tự JSON lỗi.
    // Thử lại một lần với yêu cầu súc tích sẽ an toàn hơn việc cố "vá" một
    // chuỗi đang dở, vì vá có thể âm thầm tạo dữ liệu sai/thiếu.
    const retry = await callProvider(prompt, jsonSchema, { compact: true, onRequest }); recordUsage(1);
    try {
      const parsed = safeJsonParse(retry.text); if (useCache) writeCache(cacheKey, parsed); return parsed;
    } catch {
      const reason = retry.finishReason || first.finishReason;
      const suffix = reason ? ` (Kết thúc: ${reason})` : "";
      throw new Error(`${firstError.message}${suffix}. AI đã thử trả lại JSON lần hai nhưng vẫn chưa hoàn chỉnh.`);
    }
  }
}

export async function aiCall(prompt, options = {}) {
  const { jsonSchema, useCache = true, maxAttempts = 2 } = options;
  const key = `${cacheKeyFor(prompt, jsonSchema)}|${useCache}|${maxAttempts}`;
  if (inFlightRequests.has(key)) return inFlightRequests.get(key);
  const request = executeAICall(prompt, options).finally(() => inFlightRequests.delete(key));
  inFlightRequests.set(key, request);
  return request;
}
