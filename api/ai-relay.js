// Trạm trung chuyển cho các cổng AI bên thứ 3 KHÔNG bật CORS cho trình duyệt
// (vd api.stali.vn, ecoapi.net — đã xác minh bằng preflight request thật:
// không có access-control-allow-origin, khác với Gemini/OpenAI/Claude chính
// chủ vốn cho phép gọi thẳng từ web). Đây là hàm Vercel Serverless — server
// gọi server thì không bị CORS chặn, sau đó relay này thêm header CORS cho
// đúng origin của app để trình duyệt đọc được kết quả.
//
// Chỉ relay tới danh sách nhà cung cấp đã biết (KHÔNG nhận baseUrl tuỳ ý từ
// client) — nếu không, ai cũng có thể lợi dụng route này làm proxy mở tới bất
// kỳ đâu. API Key của người dùng đi qua nguyên vẹn theo từng request, KHÔNG
// lưu trữ ở server.

const PROVIDERS = {
  stali: "https://api.stali.vn/v1/chat/completions",
  ecoapi: "https://ecoapi.net/v1/chat/completions",
};

const ALLOWED_ORIGINS = new Set([
  "https://fictionworld.vercel.app",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: { message: "Chỉ hỗ trợ POST." } });

  try {
    const provider = req.query?.provider;
    const endpoint = PROVIDERS[provider];
    if (!endpoint) return res.status(400).json({ error: { message: "Nhà cung cấp không được hỗ trợ: " + provider } });

    const authorization = String(req.headers.authorization || "");
    if (!authorization.startsWith("Bearer ")) return res.status(401).json({ error: { message: "Thiếu API Key." } });

    const payload = req.body;
    if (!payload?.model || !Array.isArray(payload.messages)) {
      return res.status(400).json({ error: { message: "Yêu cầu không hợp lệ (thiếu model/messages)." } });
    }

    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authorization },
      body: JSON.stringify(payload),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (error) {
    return res.status(400).json({ error: { message: error.message || "Không gọi được nhà cung cấp." } });
  }
}
