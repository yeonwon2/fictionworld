import React, { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { Upload, Loader2 } from "lucide-react";
import { uploadFile } from "@/lib/worldcrud";

// Ô nhập URL ảnh + nút tải lên từ máy. Có thể bật xem trước.
export default function FileUrlInput({ value, onChange, accept = "image/*", preview = false }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      onChange(url);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      {preview && value && (
        <div className="w-24 h-24 rounded-xl overflow-hidden border border-border bg-muted">
          <Image src={value} alt="preview" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Dán URL ảnh..."
        />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          <span className="hidden sm:inline">Tải lên</span>
        </Button>
        <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}