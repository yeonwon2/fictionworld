import React from "react";
import { BookMarked, Flag, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import GlossaryPanel from "@/components/storybible/GlossaryPanel";
import ForeshadowPanel from "@/components/storybible/ForeshadowPanel";
import CharacterBiblePanel from "@/components/storybible/CharacterBiblePanel";

// Hồ Sơ Truyện (Story Bible) — bảng dữ liệu trung tâm cho AI sáng tác.
export default function StoryBible() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <header className="mb-5">
        <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <BookMarked className="w-6 h-6 text-primary" /> Hồ Sơ Truyện
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Bảng dữ liệu trung tâm — nhân vật, phục bút, thuật ngữ cổ phong. Mọi lệnh gọi AI ở tab
          "Nối Mạch & Viết" tự nạp dữ liệu này làm bối cảnh.
        </p>
      </header>

      <Tabs defaultValue="glossary">
        <TabsList className="mb-4">
          <TabsTrigger value="glossary" className="gap-1.5">
            <BookMarked className="w-3.5 h-3.5" /> Thuật ngữ
          </TabsTrigger>
          <TabsTrigger value="characters" className="gap-1.5">
            <Users className="w-3.5 h-3.5" /> Nhân vật
          </TabsTrigger>
          <TabsTrigger value="foreshadow" className="gap-1.5">
            <Flag className="w-3.5 h-3.5" /> Phục bút
          </TabsTrigger>
        </TabsList>
        <TabsContent value="glossary"><GlossaryPanel /></TabsContent>
        <TabsContent value="characters"><CharacterBiblePanel /></TabsContent>
        <TabsContent value="foreshadow"><ForeshadowPanel /></TabsContent>
      </Tabs>
    </div>
  );
}