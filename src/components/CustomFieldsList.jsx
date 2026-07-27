import React from "react";
import { useFieldSchema } from "@/lib/useFieldSchema";

// Hiển thị các trường tùy chỉnh của một bản ghi theo schema của bộ truyện.
export default function CustomFieldsList({ formType, data, className = "" }) {
  const { customFields } = useFieldSchema(formType);
  const vals = data?.custom_fields || {};
  const items = customFields.filter(
    (cf) => vals[cf.id] !== undefined && vals[cf.id] !== null && String(vals[cf.id]).trim() !== ""
  );
  if (!items.length) return null;
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 mt-1.5 ${className}`}>
      {items.map((cf) => (
        <div key={cf.id} className="text-xs">
          <span className="text-muted-foreground">{cf.label}: </span>
          <span className="font-medium">{String(vals[cf.id])}</span>
        </div>
      ))}
    </div>
  );
}