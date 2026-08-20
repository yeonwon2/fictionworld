import React, { useEffect, useState } from "react";
import { BarChart3, Loader2, TrendingUp, PenLine, BookOpen } from "lucide-react";
import { listChapters, getChapter } from "@/lib/worldcrud";

// Thống kê viết — dashboard động lực: tổng từ, từ/ngày, số chương/tuần, biểu đồ tiến độ.
// Nhằm giúp tác giả giữ thói quen viết và thấy rõ tiến độ bộ truyện.
export default function WritingStats({ currentStoryId, storyName }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentStoryId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = (await listChapters(currentStoryId)) || [];
        list.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
        // Lấy content từng chương để đếm từ.
        const full = [];
        for (const c of list) {
          try {
            const row = await getChapter(c.id);
            if (row) full.push(row);
          } catch {
            full.push(c);
          }
        }
        if (cancelled) return;

        let totalWords = 0;
        const byDate = {};
        const wordCounts = [];
        for (const c of full) {
          const words = (c.content || "").split(/\s+/).filter(Boolean).length;
          totalWords += words;
          wordCounts.push({ title: c.title, chapter_number: c.chapter_number, words });
          const day = c.created_at ? new Date(c.created_at).toLocaleDateString("vi-VN") : "không rõ";
          byDate[day] = (byDate[day] || 0) + words;
        }

        const chapters = full.length;
        const days = Object.keys(byDate).length || 1;
        const avgWordsPerDay = Math.round(totalWords / days);
        const avgWordsPerChapter = chapters ? Math.round(totalWords / chapters) : 0;

        // Từ dài nhất / ngắn nhất
        const sorted = [...wordCounts].sort((a, b) => b.words - a.words);
        const longest = sorted[0] || null;
        const shortest = sorted[sorted.length - 1] || null;

        // Viết liên tục (số ngày viết liên tiếp tính từ ngày cuối cùng về trước)
        const dates = Object.keys(byDate)
          .map((d) => {
            const m = d.split("/");
            return m.length === 3 ? new Date(+m[2], +m[1] - 1, +m[0]).getTime() : 0;
          })
          .filter(Boolean)
          .sort((a, b) => b - a);
        let streak = 0;
        if (dates.length) {
          streak = 1;
          for (let i = 0; i < dates.length - 1; i++) {
            const diff = dates[i] - dates[i + 1];
            if (diff <= 86400000 * 1.5) streak++;
            else break;
          }
        }

        setStats({
          totalWords,
          chapters,
          days,
          avgWordsPerDay,
          avgWordsPerChapter,
          longest,
          shortest,
          wordCounts,
          streak,
        });
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentStoryId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Đang thống kê...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Không có dữ liệu thống kê.
      </div>
    );
  }

  const maxWords = Math.max(...stats.wordCounts.map((c) => c.words), 1);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold">Thống Kê Viết</h2>
          {storyName && <span className="text-xs text-muted-foreground">— {storyName}</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Theo dõi tiến độ viết, giữ thói quen, và biết rõ bộ truyện đang ở đâu.
        </p>
      </div>

      {/* Cards tổng */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<BookOpen className="w-4 h-4 text-primary" />} label="Tổng chương" value={stats.chapters} />
        <StatCard icon={<PenLine className="w-4 h-4 text-primary" />} label="Tổng từ" value={stats.totalWords.toLocaleString("vi-VN")} />
        <StatCard icon={<TrendingUp className="w-4 h-4 text-primary" />} label="Từ/ngày (TB)" value={stats.avgWordsPerDay.toLocaleString("vi-VN")} />
        <StatCard
          icon={<BarChart3 className="w-4 h-4 text-primary" />}
          label="Viết liên tục"
          value={`${stats.streak} ngày`}
          highlight={stats.streak >= 3}
        />
      </div>

      {/* Chương dài nhất / ngắn nhất */}
      <div className="grid sm:grid-cols-2 gap-3">
        {stats.longest && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
            <span className="text-[10px] text-emerald-600 font-semibold uppercase">Chương dài nhất</span>
            <div className="text-sm font-medium mt-0.5">
              {stats.longest.chapter_number != null ? `Ch.${stats.longest.chapter_number} ` : ""}{stats.longest.title}
            </div>
            <div className="text-xs text-muted-foreground">{stats.longest.words.toLocaleString("vi-VN")} từ</div>
          </div>
        )}
        {stats.shortest && stats.chapters > 1 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <span className="text-[10px] text-amber-600 font-semibold uppercase">Chương ngắn nhất</span>
            <div className="text-sm font-medium mt-0.5">
              {stats.shortest.chapter_number != null ? `Ch.${stats.shortest.chapter_number} ` : ""}{stats.shortest.title}
            </div>
            <div className="text-xs text-muted-foreground">{stats.shortest.words.toLocaleString("vi-VN")} từ</div>
          </div>
        )}
      </div>

      {/* Biểu đồ cột đơn giản */}
      {stats.wordCounts.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="text-xs font-semibold mb-3">Số từ theo chương</h3>
          <div className="flex items-end gap-1" style={{ height: 120 }}>
            {stats.wordCounts.map((c, i) => {
              const h = Math.max(4, (c.words / maxWords) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                  <div
                    className="w-full rounded-t-sm bg-primary/80 transition-all"
                    style={{ height: `${h}%` }}
                    title={`Ch.${c.chapter_number ?? "?"} — ${c.title}: ${c.words} từ`}
                  />
                  <span className="text-[8px] text-muted-foreground leading-none truncate w-full text-center">
                    {c.chapter_number ?? i + 1}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Trung bình {stats.avgWordsPerChapter.toLocaleString("vi-VN")} từ/chương
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, highlight }) {
  return (
    <div className={`rounded-xl border bg-card p-3 ${highlight ? "border-emerald-500/40" : "border-border"}`}>
      <div className="flex items-center gap-1.5">{icon}<span className="text-[10px] text-muted-foreground">{label}</span></div>
      <div className={`text-lg font-semibold mt-0.5 ${highlight ? "text-emerald-600" : ""}`}>{value}</div>
    </div>
  );
}