import React, { useEffect, useState } from "react";
import { Clock, Loader2, MapPin, Users, Flag, Pencil, GitBranch } from "lucide-react";
import { listGameRoutes, listGameScenes, getGameScene } from "@/lib/worldcrud";

const STATUS_COLOR = {
  "đã viết": "bg-emerald-500",
  "đã sửa": "bg-emerald-500",
  dàn: "bg-amber-500",
  nháp: "bg-muted",
};

// Timeline theo TỪNG TUYẾN KỊCH BẢN — vẽ thẳng đứng theo thứ tự phân cảnh, mỗi
// mốc hiện đầy đủ: thứ tự, loại phân cảnh, địa điểm, nhân vật, phục bút, tóm
// tắt nội dung, trạng thái. Bấm "Mở kịch bản" để nhảy sang tab Viết Kịch Bản.
export default function RouteTimeline({ currentStoryId, onEditScene }) {
  const [routes, setRoutes] = useState([]);
  const [routeKey, setRouteKey] = useState("");
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentStoryId) return;
    listGameRoutes(currentStoryId)
      .then((rs) => {
        setRoutes(rs || []);
        if (rs?.length) setRouteKey((cur) => (rs.some((r) => r.route_key === cur) ? cur : rs[0].route_key));
      })
      .catch((e) => setError("Không tải được tuyến: " + (e?.message || "lỗi")));
  }, [currentStoryId]);

  useEffect(() => {
    if (!currentStoryId || !routeKey) {
      setScenes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    (async () => {
      try {
        const lite = (await listGameScenes(currentStoryId, routeKey)) || [];
        const full = [];
        for (const s of lite) {
          try {
            full.push(await getGameScene(s.id));
          } catch {
            full.push(s);
          }
        }
        setScenes(full);
      } catch (e) {
        setError("Không tải được timeline: " + (e?.message || "lỗi"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoryId, routeKey]);

  const route = routes.find((r) => r.route_key === routeKey);
  const color = route?.color || "#8b5cf6";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
        <Clock className="w-4 h-4 text-primary shrink-0" />
        <h3 className="font-display font-semibold text-sm">Timeline Tuyến Kịch Bản</h3>
        <span className="text-xs text-muted-foreground">— dòng kịch bản từng tuyến, theo dõi + mở để sửa</span>
        <div className="ml-auto flex items-center gap-1.5">
          <select
            value={routeKey}
            onChange={(e) => setRouteKey(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          >
            {routes.length === 0 && <option value="">(chưa có tuyến)</option>}
            {routes.map((r) => (
              <option key={r.route_key} value={r.route_key}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-destructive px-4 py-2">{error}</p>}

      <div className="p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải timeline...
          </div>
        ) : !route ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Chưa có tuyến kịch bản nào. Vào tab <b>Tuyến Kịch Bản</b> để tạo tuyến trước.
          </p>
        ) : scenes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Tuyến <b>{route.name}</b> chưa có phân cảnh. Vào tab <b>Viết Kịch Bản</b> để lên dàn.
          </p>
        ) : (
          <div className="max-w-3xl mx-auto">
            {/* Đầu tuyến */}
            <div className="flex items-center gap-2 mb-6">
              <span className="w-4 h-4 rounded-full shrink-0" style={{ background: color }} />
              <div>
                <div className="text-sm font-semibold">{route.name}</div>
                {route.description && <div className="text-xs text-muted-foreground">{route.description}</div>}
              </div>
              <span className="ml-auto text-[11px] text-muted-foreground">{scenes.length} phân cảnh</span>
            </div>

            {/* Các mốc */}
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5" style={{ background: color, opacity: 0.3 }} />
              <div className="space-y-3">
                {scenes.map((s, i) => (
                  <div key={s.id} className="relative pl-8">
                    <span
                      className={`absolute left-0 top-1 w-[15px] h-[15px] rounded-full border-2 border-background ${STATUS_COLOR[s.status] || "bg-muted"}`}
                      style={{ boxShadow: `0 0 0 2px ${color}` }}
                    />
                    <div className="rounded-xl border border-border bg-muted/20 p-3 hover:bg-muted/40 transition">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-muted-foreground">{s.scene_order}</span>
                        <span className="text-sm font-semibold">{s.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{s.scene_type || "?"}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          s.status === "đã viết" || s.status === "đã sửa"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : s.status === "dàn"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                        }`}>{s.status}</span>
                        <button
                          onClick={() => onEditScene?.(s.id)}
                          className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-primary/40 text-primary text-[11px] hover:bg-primary/10"
                        >
                          <Pencil className="w-3 h-3" /> Mở kịch bản
                        </button>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground mt-1.5">
                        {s.location && (
                          <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.location}</span>
                        )}
                        {s.characters && (
                          <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {s.characters}</span>
                        )}
                        {s.foreshadow && (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><Flag className="w-3 h-3" /> {s.foreshadow}</span>
                        )}
                        {s.choices && (
                          <span className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400"><GitBranch className="w-3 h-3" /> Có điểm rẽ</span>
                        )}
                      </div>

                      {s.content?.trim() && (
                        <p className="text-xs text-foreground/80 mt-1.5 line-clamp-3 whitespace-pre-wrap">{s.content}</p>
                      )}
                      {i === scenes.length - 1 && (
                        <p className="text-[10px] text-muted-foreground italic mt-2">— cuối tuyến hiện tại —</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}