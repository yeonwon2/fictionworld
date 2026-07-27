import { useStory } from "@/lib/StoryContext";

// Hook quản lý cấu hình trường theo bộ truyện:
// - label(key, default): nhãn hiệu dụng (sau khi đổi tên)
// - renameField(key)(newLabel): đổi tên một trường dựng sẵn
// - customFields: danh sách trường tùy chỉnh [{ id, label }]
// - addCustomField(label) / removeCustomField(id) / renameCustomField(id)(newLabel)
export function useFieldSchema(formType) {
  const { currentStory, updateStorySchema } = useStory();
  const cfg = currentStory?.form_schema?.[formType] || { labelOverrides: {}, customFields: [] };
  const labelOverrides = cfg.labelOverrides || {};
  const customFields = cfg.customFields || [];

  const label = (key, def) => labelOverrides[key] ?? def;

  const renameField = (key) => (newLabel) => {
    const v = (newLabel || "").trim();
    updateStorySchema(formType, (f) => {
      const lo = { ...(f.labelOverrides || {}) };
      if (v) lo[key] = v;
      else delete lo[key];
      return { ...f, labelOverrides: lo };
    });
  };

  const addCustomField = (lbl) => {
    const v = (lbl || "").trim();
    if (!v) return null;
    const id = "cf_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
    updateStorySchema(formType, (f) => ({
      ...f,
      customFields: [...(f.customFields || []), { id, label: v }],
    }));
    return id;
  };

  const removeCustomField = (id) => {
    updateStorySchema(formType, (f) => ({
      ...f,
      customFields: (f.customFields || []).filter((c) => c.id !== id),
    }));
  };

  const renameCustomField = (id) => (newLabel) => {
    const v = (newLabel || "").trim();
    if (!v) return;
    updateStorySchema(formType, (f) => ({
      ...f,
      customFields: (f.customFields || []).map((c) => (c.id === id ? { ...c, label: v } : c)),
    }));
  };

  return { label, renameField, customFields, addCustomField, removeCustomField, renameCustomField };
}