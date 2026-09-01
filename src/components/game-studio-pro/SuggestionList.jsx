// Xưởng Game Pro — PRO 1: danh sách "đề xuất" (Chỉ số / Quan hệ / Cờ truyện /
// Vật phẩm) có thể sửa. Mỗi mục gắn nhãn "AI đề xuất" nếu origin="ai" — đây
// là gợi ý của AI, không phải yêu cầu bắt buộc của người dùng; người dùng có
// thể bỏ (✕) bất kỳ mục nào, kể cả mục do chính họ nhập.
import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export default function SuggestionList({ label, items, onChange }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function removeAt(index) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    if (!name.trim()) return;
    onChange([...items, { name: name.trim(), description: description.trim(), origin: "user" }]);
    setName("");
    setDescription("");
    setAdding(false);
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {items.length === 0 && !adding && <p className="text-xs text-muted-foreground">Chưa có mục nào.</p>}
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium">{item.name}</span>
                {item.origin === "ai" && (
                  <Badge variant="secondary" className="text-[10px] py-0">AI đề xuất</Badge>
                )}
              </div>
              {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition shrink-0"
              title="Bỏ mục này"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="flex flex-wrap gap-2 items-center">
          <Input className="w-40" placeholder="Tên" value={name} onChange={(e) => setName(e.target.value)} />
          <Input className="flex-1 min-w-[10rem]" placeholder="Mô tả (không bắt buộc)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button type="button" size="sm" onClick={addItem}>Thêm</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>Huỷ</Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Thêm mục
        </Button>
      )}
    </div>
  );
}
