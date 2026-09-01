import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Sparkles, LogOut, Settings as SettingsIcon, Gamepad2, Factory, Clapperboard, Rocket } from "lucide-react";
import { StoryProvider } from "@/lib/StoryContext";
import { useAuth } from "@/lib/AuthContext";
import StorySwitcher from "@/components/StorySwitcher";
import AISettingsModal from "@/components/AISettingsModal";
import { cn } from "@/lib/utils";

// FictionWorld hiện tập trung vào đúng bốn dây chuyền sản xuất.
const MAIN_NAV = [
  { label: "Xưởng Viết Truyện", short: "Xưởng Viết", path: "/xuong-viet-truyen", icon: Factory },
  { label: "Xưởng Kịch Bản Game", short: "Kịch Bản", path: "/xuong-kich-ban-game", icon: Clapperboard },
  { label: "Xưởng Game", short: "Game", path: "/xuong-game", icon: Gamepad2 },
  { label: "Xưởng Game Pro", short: "Game Pro", path: "/xuong-game-pro", icon: Rocket },
];

export default function Layout() {
  const location = useLocation();
  const { logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <StoryProvider>
    <div className="app-shell flex bg-background parchment-texture">
      {/* Thanh bên điều hướng (desktop) */}
      <aside className="app-sidebar hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar-background sticky top-0">
        <div className="px-6 py-7 border-b border-sidebar-border">
          <Link to="/xuong-viet-truyen" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-semibold text-sidebar-foreground">Fiction World</div>
              <div className="text-[11px] text-muted-foreground tracking-wide">Xưởng sáng tác & game</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {MAIN_NAV.map((item) => <NavLink key={item.path} item={item} active={location.pathname === item.path} />)}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
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
        <header className="app-mobile-header md:hidden flex items-center justify-between px-4 pb-3 border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
          <Link to="/xuong-viet-truyen" className="flex items-center gap-2">
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
          </div>
        </header>

        {/* Điều hướng dưới (mobile) — 3 tab chính */}
        <nav className="app-mobile-nav md:hidden fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-border bg-card/90 backdrop-blur px-1 pt-1.5">
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

        <main className="app-main flex-1 overflow-y-auto">
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
          <Outlet />
        </main>
      </div>

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
