import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import EditableLabel from "@/components/EditableLabel";
import { useFieldSchema } from "@/lib/useFieldSchema";

// Khối thêm/xóa/đổi tên trường tùy chỉnh cho một form (theo schema của bộ truyện).
// values: object { [fieldId]: "value" }  (form.custom_fields)
export default function CustomFieldsEditor({ formType, values, onChange }) {
  const { customFields, addCustomField, removeCustomField, renameCustomField } = useFieldSchema(formType);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  function setVal(id, v) {
    onChange({ ...(values || {}), [id]: v });
  }
  function commitAdd() {
    const v = newLabel.trim();
    if (v) addCustomField(v);
    setNewLabel("");
    setAdding(false);
  }

  return (
    <div className="space-y-3 pt-2 border-t border-border mt-1">
      <p className="text-xs text-muted-foreground">Trường thông tin tùy chỉnh (theo bộ truyện)</p>

      {customFields.map((cf) => (
        <div key={cf.id} className="space-y-1.5 group">
          <div className="flex items-center justify-between">
            <EditableLabel label={cf.label} onRename={renameCustomField(cf.id)} />
            <button
              type="button"
              onClick={() => {
                removeCustomField(cf.id);
                const nv = { ...(values || {}) };
                delete nv[cf.id];
                onChange(nv);
              }}
              className="text-muted-foreground hover:text-destructive transition"
              title="Xóa trường này"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <Input
            value={values?.[cf.id] || ""}
            onChange={(e) => setVal(cf.id, e.target.value)}
            placeholder={cf.label}
          />
        </div>
      ))}

      {adding ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Tên trường mới</Label>
          <div className="flex gap-2">
            <Input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitAdd();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewLabel("");
                }
              }}
              placeholder="VD: Gia thế, Công ty, Bối cảnh..."
            />
            <Button size="sm" type="button" onClick={commitAdd}>
              Thêm
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Plus className="w-4 h-4" /> Thêm trường thông tin
        </button>
      )}
    </div>
  );
}