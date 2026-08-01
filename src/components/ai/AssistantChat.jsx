import React, { useEffect, useRef, useState } from "react";
import { aiCall } from "@/lib/aiCall";
import { Sparkles, X, Send, Loader2, Trash2, CornerDownRight } from "lucide-react";

const TAB_LABEL = {
  idea: "Cấp độ 1 · Ý tưởng",
  plot: "Cấp độ 2 · Dàn Ý",
  write: "Cấp độ 3-4 · Nối Mạch & Viết",
};

function buildChatPrompt({
  directionBlock,
  profilesBlock,
  relationsBlock,
  glossaryBlock,
  foreshadowBlock,
  idea,
  outline,
  content,
  activeTab,
  history,
  question,
}) {
  const historyBlock = history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Tác giả" : "Trợ lý"}: ${m.text}`)
    .join("\n\n");
  const contentTail = (content || "").split(/\s+/).filter(Boolean).slice(-300).join(" ");
  return `Bạn là trợ lý sáng tác TOÀN DIỆN cho tiểu thuyết mạng Bách Hợp Cổ Đại. Tác giả có thể hỏi/yêu cầu TỰ DO bất cứ điều gì — gợi ý thêm nhân vật, đào sâu cốt truyện, kiểm tra logic, viết thử đoạn văn, brainstorm không giới hạn số lượng phương án — không bị bó buộc vào khuôn có sẵn của các form. Luôn trả lời bằng tiếng Việt; khi viết văn mẫu trong bối cảnh truyện, dùng văn phong cổ kính, điền nhã, KHÔNG dùng từ hiện đại.

# Tác giả đang ở: ${TAB_LABEL[activeTab] || ""}

${directionBlock || ""}

# Hồ sơ nhân vật đã chọn (nếu có)
${profilesBlock || "(chưa chọn nhân vật)"}

# Quan hệ & xưng hô
${relationsBlock || "(chưa có)"}

# Glossary cổ phong
${glossaryBlock || "(chưa có)"}

# Phục bút chưa giải quyết
${foreshadowBlock || "(chưa có)"}

# Ý tưởng / bối cảnh hiện tại
${idea || "(chưa có)"}

# Dàn ý phân cảnh hiện tại
${outline || "(chưa có)"}

# Đoạn bản thảo gần nhất (rút gọn)
${contentTail || "(chưa có)"}

# Lịch sử hội thoại gần đây
${historyBlock || "(chưa có)"}

# Câu hỏi / yêu cầu mới của tác giả
${question}

Hãy trả lời trực tiếp, cụ thể, hữu ích — không lặp lại toàn bộ ngữ cảnh trên.`;
}

const HISTORY_CAP = 40;

// Trợ lý chat tự do — có mặt xuyên suốt 3 tab, full ngữ cảnh Story Bible.
export default function AssistantChat({
  currentStoryId,
  activeTab,
  directionBlock,
  profilesBlock,
  relationsBlock,
  glossaryBlock,
  foreshadowBlock,
  idea,
  outline,
  content,
  onInsertToIdea,
  onInsertToOutline,
  onInsertToContent,
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  const STORAGE_KEY = `fw_assistant_chat_${currentStoryId}`;

  useEffect(() => {
    try {
      setMessages(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
    } catch {
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [STORAGE_KEY]);

  const persist = (msgs) => {
    const capped = msgs.slice(-HISTORY_CAP);
    setMessages(capped);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
    } catch {}
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setError("");
    setInput("");
    const withUser = [...messages, { role: "user", text: question, ts: Date.now() }];
    persist(withUser);
    setLoading(true);
    try {
      const prompt = buildChatPrompt({
        directionBlock,
        profilesBlock,
        relationsBlock,
        glossaryBlock,
        foreshadowBlock,
        idea,
        outline,
        content,
        activeTab,
        history: withUser,
        question,
      });
      const res = await aiCall(prompt);
      persist([...withUser, { role: "assistant", text: String(res || ""), ts: Date.now() }]);
    } catch (e) {
      setError("Lỗi: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => persist([]);

  const insertButtons = (text) => {
    if (activeTab === "plot" && onInsertToIdea) {
      return [{ label: "Chèn vào Bối cảnh/Ý tưởng", onClick: () => onInsertToIdea(text) }];
    }
    if (activeTab === "write") {
      const btns = [];
      if (onInsertToOutline) btns.push({ label: "Chèn vào Dàn ý phân cảnh", onClick: () => onInsertToOutline(text) });
      if (onInsertToContent) btns.push({ label: "Chèn vào Bản thảo", onClick: () => onInsertToContent(text) });
      return btns;
    }
    return [];
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition ${
          open ? "hidden" : ""
        }`}
      >
        <Sparkles className="w-4 h-4" /> Trợ lý AI
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md h-full bg-card border-l border-border flex flex-col shadow-2xl">
            <div className="flex items-center justify-between gap-2 p-3 border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="font-display font-semibold text-sm truncate">Trợ lý AI toàn diện</div>
                  <div className="text-[10px] text-muted-foreground truncate">{TAB_LABEL[activeTab] || ""}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={clearHistory}
                  title="Xoá lịch sử chat"
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Hỏi hoặc yêu cầu bất cứ điều gì — đào sâu ý tưởng, thêm nhân vật, kiểm tra logic, viết thử đoạn văn...
                  Trợ lý luôn đọc full Story Bible + trạng thái hiện tại của cấp độ bạn đang làm.
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={`max-w-[90%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.text}
                    {m.role === "assistant" && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {insertButtons(m.text).map((b, j) => (
                          <button
                            key={j}
                            onClick={b.onClick}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-primary/40 text-primary bg-card text-[10px] hover:bg-primary/10"
                          >
                            <CornerDownRight className="w-3 h-3" /> {b.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Trợ lý đang suy nghĩ...
                </div>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="p-3 border-t border-border">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={2}
                  placeholder="Hỏi trợ lý bất cứ điều gì..."
                  className="flex-1 rounded-md border border-input bg-transparent px-2.5 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="inline-flex items-center justify-center p-2.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
