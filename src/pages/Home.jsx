import React, { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { listCharacters, listLocations, listRelationships, listEvents } from "@/lib/worldcrud";
import { useStory } from "@/lib/StoryContext";
import { Users, Network, MapPin, Clock, ArrowRight, Search, Sparkles } from "lucide-react";

// Trang tổng quan — bảng điều khiển với thống kê nhanh
export default function Home() {
  const { openDrawer } = useOutletContext() || {};
  const { currentStory, currentStoryId, ready } = useStory();
  const [stats, setStats] = useState({ characters: 0, locations: 0, relationships: 0, events: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    Promise.all([
      listCharacters(currentStoryId),
      listLocations(currentStoryId),
      listRelationships(currentStoryId),
      listEvents(currentStoryId),
    ])
      .then(([c, l, r, e]) => {
        setStats({ characters: c.length, locations: l.length, relationships: r.length, events: e.length });
      })
      .finally(() => setLoading(false));
  }, [ready, currentStoryId]);

  const cards = [
    { label: "Nhân vật", value: stats.characters, path: "/so-tay-the-gioi?tab=characters", icon: Users, color: "from-violet-500/20 to-violet-500/5", iconColor: "text-violet-500" },
    { label: "Mối quan hệ", value: stats.relationships, path: "/so-tay-the-gioi?tab=relationships", icon: Network, color: "from-emerald-500/20 to-emerald-500/5", iconColor: "text-emerald-500" },
    { label: "Địa danh", value: stats.locations, path: "/so-tay-the-gioi?tab=locations", icon: MapPin, color: "from-amber-500/20 to-amber-500/5", iconColor: "text-amber-500" },
    { label: "Sự kiện", value: stats.events, path: "/so-tay-the-gioi?tab=timeline", icon: Clock, color: "from-sky-500/20 to-sky-500/5", iconColor: "text-sky-500" },
  ];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-accent/10 p-8 md:p-12 mb-8">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Sổ tay thế giới Fiction
          </div>
          {currentStory && (
            <div className="text-xs text-muted-foreground mb-4">
              Đang xem: <span className="font-medium text-foreground">{currentStory.name}</span>
              {currentStory.genre && <span> · {currentStory.genre}</span>}
            </div>
          )}
          <h1 className="font-display text-3xl md:text-5xl font-semibold leading-tight">
            Quản lý thế giới,
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">nhân vật & cốt truyện</span>
          </h1>
          <p className="text-muted-foreground mt-4 text-sm md:text-base leading-relaxed max-w-lg">
            Hệ thống hóa toàn bộ nhân vật, địa danh, sơ đồ mối quan hệ và dòng thời gian trong tác phẩm của bạn — trực quan, dễ tra cứu, không bỏ sót chi tiết.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link
              to="/so-tay-the-gioi?tab=characters"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
            >
              Xem nhân vật <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/sang-tac-ai"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 transition"
            >
              <Sparkles className="w-4 h-4" /> Sáng tác AI
            </Link>
            <button
              onClick={openDrawer}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card/60 text-sm font-medium hover:bg-muted transition"
            >
              <Search className="w-4 h-4" /> Tra cứu nhanh
            </button>
          </div>
        </div>
      </div>

      {/* Thẻ thống kê */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.path}
              to={c.path}
              className={`group rounded-2xl border border-border bg-gradient-to-br ${c.color} p-5 hover:shadow-md transition-all`}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className={`w-6 h-6 ${c.iconColor}`} />
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
              </div>
              <div className="text-3xl font-display font-semibold">{loading ? "—" : c.value}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{c.label}</div>
            </Link>
          );
        })}
      </div>

      {/* Phím tắt */}
      <div className="mt-8 grid md:grid-cols-2 gap-4">
        <FeatureLink
          to="/so-tay-the-gioi?tab=relationships"
          icon={Network}
          title="Sơ đồ mối quan hệ"
          desc="Trực quan hóa mạng lưới nhân vật — sư đồ, đồng minh, kẻ thù."
        />
        <FeatureLink
          to="/sang-tac-ai"
          icon={Sparkles}
          title="Sáng tác AI"
          desc="Viết phân cảnh cổ phong tự động với sự trợ giúp của Gemini."
        />
      </div>
    </div>
  );
}

function FeatureLink({ to, icon: Icon, title, desc }) {
  return (
    <Link to={to} className="group flex items-start gap-4 p-5 rounded-2xl border border-border bg-card hover:shadow-md transition">
      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0">
        <h3 className="font-display font-semibold flex items-center gap-1.5">
          {title}
          <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition" />
        </h3>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
      </div>
    </Link>
  );
}