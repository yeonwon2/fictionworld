// =============================================================================
// AI Call — gọi thẳng Google AI Studio bằng Gemini API Key riêng của người
// dùng (lưu ở localStorage). Không còn backend trung gian nào giữ key hộ —
// mỗi người dùng phải tự nhập key riêng (miễn phí) ở phần Cài đặt AI.
// =============================================================================

const KEY_STORAGE = "fiction_ai_gemini_key";
const MODEL_STORAGE = "fiction_ai_gemini_model";
const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export function getCustomKey() {
  try {
    return localStorage.getItem(KEY_STORAGE) || "";
  } catch {
    return "";
  }
}
export function setCustomKey(key) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {}
}
export function getCustomModel() {
  try {
    return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}
export function setCustomModel(model) {
  try {
    localStorage.setItem(MODEL_STORAGE, model || DEFAULT_MODEL);
  } catch {}
}
export function hasCustomKey() {
  return !!getCustomKey();
}

// Test kết nối tới Google AI Studio với key + model cụ thể
export async function testGeminiConnection(key, model) {
  if (!key) throw new Error("Chưa nhập API Key.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "ping, hãy trả: ok" }] }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Lỗi ${res.status}: ${t.slice(0, 240)}`);
  }
  const data = await res.json().catch(() => ({}));
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("");
  if (!text) throw new Error("Phản hồi rỗng — API Key có thể không hợp lệ.");
  return true;
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

async function callGemini(prompt, jsonSchema) {
  const key = getCustomKey();
  const model = getCustomModel();
  let finalPrompt = prompt;
  if (jsonSchema) {
    finalPrompt = `${prompt}\n\nTrả JSON đúng schema sau (KHÔNG kèm giải thích):\n${JSON.stringify(jsonSchema)}`;
  }
  const body = {
    contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
  };
  if (jsonSchema) {
    body.generationConfig = { responseMimeType: "application/json" };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;
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
  return text;
}

// Gọi AI — bắt buộc phải có Gemini API Key riêng (không còn fallback qua backend).
export async function aiCall(prompt, { jsonSchema } = {}) {
  if (!getCustomKey()) {
    throw new Error(
      "Chưa có Gemini API Key. Vào Cài đặt AI để nhập key riêng (miễn phí) trước khi dùng tính năng này."
    );
  }
  const text = await callGemini(prompt, jsonSchema);
  return jsonSchema ? safeJsonParse(text) : text;
}