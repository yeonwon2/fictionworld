import React, { Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Library, Users, Network, MapPin, Clock, LayoutGrid, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import chậm các trang con để chỉ tải trang đang chọn
const Characters = React.lazy(() => import("@/pages/Characters"));
const Relationships = React.lazy(() => import("@/pages/Relationships"));
const Locations = React.lazy(() => import("@/pages/Locations"));
const Timeline = React.lazy(() => import("@/pages/Timeline"));
const StoryMatrix = React.lazy(() => import("@/pages/StoryMatrix"));

const TABS = [
  { value: "characters", label: "Nhân vật", icon: Users, Comp: Characters },
  { value: "relationships", label: "Sơ đồ quan hệ", icon: Network, Comp: Relationships },
  { value: "locations", label: "Địa danh", icon: MapPin, Comp: Locations },
  { value: "timeline", label: "Niên biểu", icon: Clock, Comp: Timeline },
  { value: "matrix", label: "Cốt truyện", icon: LayoutGrid, Comp: StoryMatrix },
];

// Sổ Tay Thế Giới — gom 5 mục world-building thành sub-tabs
export default function Worldbook() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "characters";

  return (
    <div className="min-h-full">
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        {/* Thanh sub-tab dính đầu trang (dưới story bar) */}
        <div className="sticky top-[41px] z-[5] bg-card/90 backdrop-blur border-b border-border">
          <div className="max-w-7xl mx-auto px-3 py-2 flex items-center gap-2">
            <Library className="w-4 h-4 text-primary hidden sm:block" />
            <span className="font-display font-semibold text-sm hidden sm:block">Sổ Tay Thế Giới</span>
            <div className="flex-1 overflow-x-auto -mx-1 px-1">
              <TabsList className="inline-flex h-9 p-1 bg-muted/60">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <TabsTrigger key={t.value} value={t.value} className="gap-1.5 px-3 text-xs whitespace-nowrap">
                      <Icon className="w-3.5 h-3.5" />
                      {t.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>
          </div>
        </div>

        {/* Nội dung sub-tab */}
        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-0 focus-visible:outline-none">
            <Suspense
              fallback={
                <div className="p-10 max-w-7xl mx-auto flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang tải {t.label.toLowerCase()}...
                </div>
              }
            >
              <t.Comp />
            </Suspense>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}