import React, { useState, useCallback } from "react";
import { Link, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { BookOpen, Users, Network, MapPin, Clock, Search, Sparkles, LayoutGrid, LogOut, Library, ChevronDown, Settings as SettingsIcon, BookMarked, Gamepad2 } from "lucide-react";
import QuickReferenceDrawer from "@/components/QuickReferenceDrawer";
import { StoryProvider } from "@/lib/StoryContext";
import { useAuth } from "@/lib/AuthContext";
import StorySwitcher from "@/components/StorySwitcher";
import AISettingsModal from "@/components/AISettingsModal";
import { cn } from "@/lib/utils";

// Điều hướng chính — 4 tab
const MAIN_NAV = [
  { label: "Tổng quan", short: "Tổng quan", path: "/", icon: BookOpen },
  {
    label: "Sổ Tay Thế Giới",
    short: "Sổ Tay",
    path: "/so-tay-the-gioi",
    icon: Library,
    children: [
      { label: "Hồ Sơ Truyện", tab: "bible", icon: BookMarked },
      { label: "Nhân vật", tab: "characters", icon: Users },
      { label: "Sơ đồ quan hệ", tab: "relationships", icon: Network },
      { label: "Địa danh", tab: "locations", icon: MapPin },
      { label: "Niên biểu", tab: "timeline", icon: Clock },
      { label: "Cốt truyện", tab: "matrix", icon: LayoutGrid },
    ],
  },
  { label: "Sáng Tác AI", short: "Sáng Tác", path: "/sang-tac-ai", icon: Sparkles },
  { label: "Xưởng Game", short: "Game", path: "/xuong-game", icon: Gamepad2 },
];

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { logout } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab");
  const [groupOpen, setGroupOpen] = useState(location.pathname === "/so-tay-the-gioi");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const worldItem = MAIN_NAV[1];

  return (
    <StoryProvider>
    <div className="min-h-screen flex bg-background parchment-texture">
      {/* Thanh bên điều hướng (desktop) */}
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar-background sticky top-0 h-screen">
        <div className="px-6 py-7 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-semibold text-sidebar-foreground">Fiction World</div>
              <div className="text-[11px] text-muted-foreground tracking-wide">Sổ tay thế giới</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {/* Tổng quan */}
          <NavLink item={MAIN_NAV[0]} active={location.pathname === "/"} />

          {/* Sổ Tay Thế Giới — nhóm mở rộng */}
          <div>
            <button
              onClick={() => setGroupOpen((o) => !o)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                location.pathname === worldItem.path
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <worldItem.icon className="w-4 h-4 shrink-0" />
              {worldItem.label}
              <ChevronDown className={cn("w-4 h-4 ml-auto transition-transform", groupOpen && "rotate-180")} />
            </button>
            {groupOpen && (
              <div className="ml-3 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                {worldItem.children.map((child) => {
                  const Icon = child.icon;
                  const to = `${worldItem.path}?tab=${child.tab}`;
                  const active = location.pathname === worldItem.path && activeTab === child.tab;
                  return (
                    <Link
                      key={child.tab}
                      to={to}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sáng Tác AI */}
          <NavLink item={MAIN_NAV[2]} active={location.pathname === "/sang-tac-ai"} />

          {/* Xưởng Game */}
          <NavLink item={MAIN_NAV[3]} active={location.pathname === "/xuong-game"} />
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <button
            onClick={openDrawer}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-sidebar-accent text-sidebar-accent-foreground hover:opacity-80 transition"
          >
            <Search className="w-4 h-4" />
            Tra cứu nhanh
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition"
          >
            <SettingsIcon className="w-4 h-4" />
            Cài đặt AI
          </button>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-destructive transition"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Khu vực nội dung chính */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Thanh trên (mobile) */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold">Fiction World</span>
          </Link>
          <div className="flex items-center gap-1">
            <button onClick={() => setSettingsOpen(true)} className="p-2 rounded-lg hover:bg-muted" title="Cài đặt AI">
              <SettingsIcon className="w-5 h-5" />
            </button>
            <button onClick={() => logout()} className="p-2 rounded-lg hover:bg-muted" title="Đăng xuất">
              <LogOut className="w-5 h-5" />
            </button>
            <button onClick={openDrawer} className="p-2 rounded-lg hover:bg-muted">
              <Search className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Điều hướng dưới (mobile) — 3 tab chính */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-border bg-card/90 backdrop-blur px-1 py-1.5">
          {MAIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 rounded-md text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.short}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {/* Thanh tiêu đề — chuyển đổi / quản lý bộ truyện */}
          <div className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur px-4 py-2 flex items-center justify-end gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">Bộ truyện hiện tại</span>
            <StorySwitcher />
            <button
              onClick={() => setSettingsOpen(true)}
              title="Cài đặt AI"
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => logout()}
              title="Đăng xuất"
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <Outlet context={{ openDrawer }} />
        </main>
      </div>

      {/* Bảng tra cứu nhanh toàn cục */}
      <QuickReferenceDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      {/* Cài đặt AI API Key cá nhân */}
      <AISettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
    </StoryProvider>
  );
}

function NavLink({ item, active }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {item.label}
    </Link>
  );
}