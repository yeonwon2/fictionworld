import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { ArrowLeft, User, Heart, Sword, Sparkles, Package, BookOpen, Users as UsersIcon } from "lucide-react";

// Trang chi tiết nhân vật
export default function CharacterDetail() {
  const { id } = useParams();
  const [character, setCharacter] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [allChars, setAllChars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      base44.entities.Character.get(id),
      base44.entities.Relationship.list("-updated_date", 200),
      base44.entities.Character.list("-updated_date", 200),
    ])
      .then(([c, rels, chars]) => {
        setCharacter(c);
        setRelationships(rels || []);
        setAllChars(chars || []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Lọc các mối quan hệ liên quan đến nhân vật này
  const relatedRels = useMemo(
    () => relationships.filter((r) => r.source_character_id === id || r.target_character_id === id),
    [relationships, id]
  );

  const charById = useMemo(() => Object.fromEntries(allChars.map((c) => [c.id, c])), [allChars]);

  if (loading) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto animate-pulse space-y-4">
        <div className="h-6 bg-muted rounded w-32" />
        <div className="flex gap-6">
          <div className="w-48 h-64 bg-muted rounded-2xl" />
          <div className="flex-1 space-y-3">
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        <p>Không tìm thấy nhân vật.</p>
        <Link to="/nhan-vat" className="text-primary underline mt-2 inline-block">Quay lại danh sách</Link>
      </div>
    );
  }

  const c = character;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <Link to="/nhan-vat" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Danh sách nhân vật
      </Link>

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Ảnh + thông tin cơ bản */}
        <div className="md:w-64 shrink-0">
          <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-border bg-muted shadow-sm">
            {c.avatar_url ? (
              <Image src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <User className="w-12 h-12" />
              </div>
            )}
          </div>
          {c.role && (
            <span className="block text-center mt-3 text-sm font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary">
              {c.role}
            </span>
          )}
          {c.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center mt-3">
              {c.tags.map((t, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Chi tiết */}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-3xl font-semibold">{c.name}</h1>
          {c.aliases && <p className="text-muted-foreground mt-1">{c.aliases}</p>}

          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            {c.first_appeared_chapter != null && (
              <InfoRow icon={BookOpen} label="Xuất hiện từ chương" value={`Chương ${c.first_appeared_chapter}`} />
            )}
            {c.power_level && <InfoRow icon={Sparkles} label="Cấp độ năng lực" value={c.power_level} />}
          </div>

          {c.description && (
            <Section title="Giới thiệu">
              <p className="text-sm leading-relaxed text-foreground/90">{c.description}</p>
            </Section>
          )}

          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 mt-6">
            {c.appearance && <Section title="Ngoại hình" icon={User}><p className="text-sm leading-relaxed text-muted-foreground">{c.appearance}</p></Section>}
            {c.personality && <Section title="Tính cách" icon={Heart}><p className="text-sm leading-relaxed text-muted-foreground">{c.personality}</p></Section>}
            {c.skills && <Section title="Kỹ năng" icon={Sword}><p className="text-sm leading-relaxed text-muted-foreground">{c.skills}</p></Section>}
            {c.items && <Section title="Vật phẩm / Pháp bảo" icon={Package}><p className="text-sm leading-relaxed text-muted-foreground">{c.items}</p></Section>}
          </div>

          {/* Mối quan hệ */}
          <Section title={`Mối quan hệ (${relatedRels.length})`} icon={UsersIcon}>
            {relatedRels.length ? (
              <div className="space-y-2">
                {relatedRels.map((r) => {
                  const otherId = r.source_character_id === id ? r.target_character_id : r.source_character_id;
                  const other = charById[otherId];
                  return (
                    <Link
                      key={r.id}
                      to={`/nhan-vat/${otherId}`}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card hover:bg-muted transition"
                    >
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-muted shrink-0">
                        {other?.avatar_url && <Image src={other.avatar_url} alt={other?.name} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{other?.name || "—"}</div>
                        {r.description && <div className="text-xs text-muted-foreground truncate">{r.description}</div>}
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary whitespace-nowrap">
                        {r.relation_type}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có mối quan hệ nào được ghi nhận.</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/60">
      <Icon className="w-4 h-4 text-primary shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="mt-6">
      <h2 className="font-display font-semibold text-sm flex items-center gap-1.5 mb-2">
        {Icon && <Icon className="w-4 h-4 text-primary" />} {title}
      </h2>
      {children}
    </div>
  );
}