// Curated from the user's own aistudio.google.com/rate-limit page
// (2026-07-28, copied from the edittruyenqt project's same curated list —
// same Google account/free-tier quotas apply). Per established practice
// across this user's projects, model IDs and quotas are NOT trustworthy
// from web search/training data, only from the user's actual account page.
// Re-paste an updated table here if Google changes limits again.
//
// `id` follows the "gemini-{version}-flash[-lite]" pattern confirmed
// working for the current default (gemini-3.1-flash-lite) — the newer
// versions are inferred from that same pattern and NOT independently
// confirmed; if picking one throws a connection error on "Kiểm tra kết
// nối", that's why — fall back to a confirmed-working id.
export const GEMINI_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", perMinute: 5, perDay: 20 },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", perMinute: 10, perDay: 20 },
  { id: "gemini-3-flash", label: "Gemini 3 Flash", perMinute: 5, perDay: 20 },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", perMinute: 15, perDay: 500 },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", perMinute: 5, perDay: 20 },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite", perMinute: 15, perDay: 500 },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", perMinute: 5, perDay: 20 },
];
