import React, { useState, useCallback } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { BookOpen, Users, Network, MapPin, Clock, Search, Sparkles, PenTool } from "lucide-react";
import QuickReferenceDrawer from "@/components/QuickReferenceDrawer";
import { StoryProvider } from "@/lib/StoryContext";
import StorySwitcher from "@/components/StorySwitcher";
import { cn } from "@/lib/utils";

// Các mục điều hướng thanh bên
const NAV_ITEMS = [
  { label: "Tổng quan", path: "/", icon: BookOpen },
  { label: "Soạn thảo", path: "/soan-thao", icon: PenTool },
  { label: "Nhân vật", path: "/nhan-vat", icon: Users },
  { label: "Sơ đồ quan hệ", path: "/so-do", icon: Network },
  { label: "Địa danh", path: "/dia-danh", icon: MapPin },
  { label: "Niên biểu", path: "/nien-bieu", icon: Clock },
];

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const openDrawer = useCallback(() => setDrawerOpen(true), []);

  return (
    <StoryProvider>
    <div className="min-h-screen flex bg-background parchment-texture">
      {/* Thanh bên điều hướng */}
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
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
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
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={openDrawer}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-sidebar-accent text-sidebar-accent-foreground hover:opacity-80 transition"
          >
            <Search className="w-4 h-4" />
            Tra cứu nhanh
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
          <button onClick={openDrawer} className="p-2 rounded-lg hover:bg-muted">
            <Search className="w-5 h-5" />
          </button>
        </header>

        {/* Điều hướng dưới (mobile) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-border bg-card/90 backdrop-blur px-1 py-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {/* Thanh tiêu đề — chuyển đổi / quản lý bộ truyện */}
          <div className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur px-4 py-2 flex items-center justify-end gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">Bộ truyện hiện tại</span>
            <StorySwitcher />
          </div>
          <Outlet context={{ openDrawer }} />
        </main>
      </div>

      {/* Bảng tra cứu nhanh toàn cục */}
      <QuickReferenceDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
    </StoryProvider>
  );
}