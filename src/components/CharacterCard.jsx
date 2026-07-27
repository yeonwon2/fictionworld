import React from "react";
import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { User } from "lucide-react";

// Thẻ nhân vật dạng lưới
export default function CharacterCard({ character }) {
  const c = character;
  return (
    <Link
      to={`/nhan-vat/${c.id}`}
      className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
    >
      {/* Ảnh đại diện */}
      <div className="aspect-[4/5] relative bg-muted overflow-hidden">
        {c.avatar_url ? (
          <Image
            src={c.avatar_url}
            alt={c.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <User className="w-10 h-10" />
          </div>
        )}
        {/* Lớp phủ gradient + vai trò */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          {c.role && (
            <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground">
              {c.role}
            </span>
          )}
        </div>
      </div>

      {/* Thông tin */}
      <div className="p-3.5">
        <h3 className="font-display font-semibold text-base leading-tight truncate">{c.name}</h3>
        {c.aliases && <p className="text-xs text-muted-foreground truncate mt-0.5">{c.aliases}</p>}
        {c.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {c.tags.slice(0, 3).map((t, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}