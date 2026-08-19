import React, { useEffect, useMemo, useRef, useState } from "react";
import { Send, Loader2, Trash2, Bot } from "lucide-react";
import { aiCall } from "@/lib/aiCall";
import { buildBibleBlock, buildTeamChatPrompt, TEAM_ROLES } from "@/lib/writingFactory/prompts";

const HISTORY_CAP = 40;

// Team AI theo vai — mỗi thành viên trong xưởng có một hội thoại riêng,
// cùng đọc bộ tài liệu bible làm ngữ cảnh.
export default function TeamChat({ currentStoryId, genre, docsByKey }) {
  const [roleKey, setRoleKey] = useState(TEAM_ROLES[0].key);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  const role = TEAM_ROLES.find((r) => r.key === roleKey) || TEAM_ROLES[0];
  const storageKey = `fw_team_chat_${currentStoryId}_${roleKey}`;

  useEffect(() => {
    try {
      setMessages(JSON.parse(localStorage.getItem(storageKey) || "[]"));
    } catch {
      setMessages([]);
    }
  }, [storageKey]);

  const persist = (msgs) => {
    const capped = msgs.slice(-HISTORY_CAP);
    setMessages(capped);
    try {
      localStorage.setItem(storageKey, JSON.stringify(capped));
    } catch {}
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, roleKey]);

  const bibleText = useMemo(() => buildBibleBlock(docsByKey), [docsByKey]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setError("");
    setInput("");
    const withUser = [...messages, { role: "user", text: question, ts: Date.now() }];
    persist(withUser);
    setLoading(true);
    try {
      const prompt = buildTeamChatPrompt({ role, genre, bibleText, history: withUser, question });
      const res = await aiCall(prompt);
      persist([...withUser, { role: "assistant", text: String(res || ""), ts: Date.now() }]);
    } catch (e) {
      setError("Lỗi: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => persist([]);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col h-[calc(100vh-240px)] min-h-[480px]">
      <div className="px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary shrink-0" />
          <span className="font-display font-semibold text-sm">Team AI · Xưởng Viết Truyện</span>
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <button
              onClick={clearHistory}
              title="Xoá hội thoại của thành viên này"
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto pb-0.5">
          {TEAM_ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRoleKey(r.key)}
              className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition ${
                r.key === roleKey ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <span>{r.emoji}</span> {r.name}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">{role.emoji} {role.name}:</span> {role.desc}
        </div>
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Hỏi thành viên này bất cứ điều gì — họ luôn đọc full bộ tài liệu bible hiện tại của xưởng.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[88%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {role.name} đang suy nghĩ...
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
            placeholder={`Hỏi ${role.name}...`}
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
  );
}