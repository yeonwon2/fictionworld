// Xưởng Game Pro — PRO 3: RULE EDITOR — biên tập ĐIỀU KIỆN hoặc HỆ QUẢ của 1
// lựa chọn (hoặc 1 nhánh conditionalOutcomes) bằng lời tự nhiên, KHÔNG hiện
// JSON/field kỹ thuật (mục 8/32). Có 2 đường tạo luật độc lập, AI không phải
// đường duy nhất (mục 9): (1) gõ câu -> "Phân tích" -> xem trước -> Áp dụng;
// (2) ô tự thêm thủ công (chọn chỉ số/cờ/vật phẩm có sẵn bằng dropdown).
import React, { useState } from "react";
import { Sparkles, Loader2, X, Plus, HelpCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseConditionText, parseEffectText } from "@/lib/gameStudioPro/ruleParser.js";
import { explainCondition, explainEffect, statCompare, flagPresent, flagAbsent, itemPresent, statChange, grantFlag, grantItem, removeItem, showPopup, OPERATORS } from "@/lib/gameStudioPro/ruleModel.js";
import { listEntities, findEntityByIdAnyKind, addStatEntity, addFlagEntity, addItemEntity, ENTITY_KINDS } from "@/lib/gameStudioPro/entityRegistry.js";

function entityLabelFor(registry, entityId) {
  const e = findEntityByIdAnyKind(registry, entityId);
  return e ? e.displayName : "(?)";
}

// ---------- Chip hiện 1 luật đã có (điều kiện hoặc hệ quả) ----------
function RuleChip({ registry, kind, item, onRemove }) {
  const label = kind === "condition" ? explainCondition(item, entityLabelFor(registry, item.entityId)) : explainEffect(item, entityLabelFor(registry, item.entityId));
  const isProblem = item.type === "unsupported";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${isProblem ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
      {label}
      <button type="button" onClick={onRemove} className="opacity-60 hover:opacity-100"><X className="w-3 h-3" /></button>
    </span>
  );
}

// ---------- 1 dòng preview sau khi "Phân tích" — có thể cần người dùng quyết định ----------
function ParsePreviewRow({ registry, onRegistryChange, kind, parseItem, onResolved }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState(parseItem.text || "");

  if (parseItem.status === "ok") {
    const finalItem = kind === "condition" ? parseItem.condition : parseItem.effect;
    const label = kind === "condition" ? explainCondition(finalItem, parseItem.entityLabel) : explainEffect(finalItem, parseItem.entityLabel);
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5 text-xs">
        <span>✓ {label}</span>
      </div>
    );
  }

  if (parseItem.status === "unsupported") {
    return (
      <div className="flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>Chưa hỗ trợ: "{parseItem.raw}"{parseItem.reason ? ` — ${parseItem.reason}` : ""}</span>
      </div>
    );
  }

  const entityKind = parseItem.entityKind;
  const collectionKind = entityKind === "quantity" ? ENTITY_KINDS.STAT : entityKind; // quantity chỉ dùng để resolve, tạo mới thì phải chọn rõ loại
  const kindLabel = { [ENTITY_KINDS.STAT]: "chỉ số", [ENTITY_KINDS.RELATIONSHIP]: "quan hệ", [ENTITY_KINDS.FLAG]: "cờ", [ENTITY_KINDS.ITEM]: "vật phẩm" }[collectionKind] || "mục";

  function pickCandidate(entity) {
    onResolved({ status: "ok", entity });
  }

  function createNew() {
    const name = newName.trim();
    if (!name) return;
    let nextRegistry = registry;
    let entity;
    if (collectionKind === ENTITY_KINDS.FLAG) { nextRegistry = addFlagEntity(registry, name); entity = nextRegistry.flags[nextRegistry.flags.length - 1]; }
    else if (collectionKind === ENTITY_KINDS.ITEM) { nextRegistry = addItemEntity(registry, name); entity = nextRegistry.items[nextRegistry.items.length - 1]; }
    else { nextRegistry = addStatEntity(registry, { displayName: name }); entity = nextRegistry.stats[nextRegistry.stats.length - 1]; }
    onRegistryChange(nextRegistry);
    onResolved({ status: "ok", entity });
  }

  if (parseItem.status === "ambiguous") {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs space-y-1.5">
        <p className="flex items-center gap-1.5"><HelpCircle className="w-3.5 h-3.5 shrink-0" />"{parseItem.text}" giống nhiều mục đã có — chọn đúng cái nào:</p>
        <div className="flex flex-wrap gap-1.5 pl-5">
          {parseItem.candidates.map((c) => (
            <button key={c.id} type="button" onClick={() => pickCandidate(c)} className="rounded-full border border-border px-2 py-0.5 hover:bg-accent">{c.displayName}</button>
          ))}
        </div>
      </div>
    );
  }

  // not_found
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs space-y-1.5">
      <p className="flex items-center gap-1.5"><HelpCircle className="w-3.5 h-3.5 shrink-0" />Không tìm thấy "{parseItem.text}" trong danh mục ({kindLabel}).</p>
      <div className="flex flex-wrap items-center gap-1.5 pl-5">
        {listEntities(registry, collectionKind).length > 0 && (
          <Select onValueChange={(id) => pickCandidate(listEntities(registry, collectionKind).find((e) => e.id === id))}>
            <SelectTrigger className="h-7 text-xs w-44"><SelectValue placeholder="Dùng mục có sẵn..." /></SelectTrigger>
            <SelectContent>{listEntities(registry, collectionKind).map((e) => <SelectItem key={e.id} value={e.id}>{e.displayName}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {!creating ? (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreating(true)}>
            <Plus className="w-3 h-3 mr-1" /> Tạo {kindLabel} mới "{parseItem.text}"
          </Button>
        ) : (
          <div className="flex items-center gap-1.5">
            <Input className="h-7 text-xs w-40" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button type="button" size="sm" className="h-7 text-xs" onClick={createNew}>Tạo</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Ô tự thêm thủ công (không cần AI) ----------
function ManualAddRow({ registry, kind, onAdd }) {
  const conditionTypes = [
    { value: "stat_compare", label: "Chỉ số/quan hệ so sánh" },
    { value: "flag_present", label: "Đã có cờ" },
    { value: "flag_absent", label: "Chưa có cờ" },
    { value: "item_present", label: "Có vật phẩm" },
  ];
  const effectTypes = [
    { value: "stat_change", label: "Cộng/trừ chỉ số hoặc quan hệ" },
    { value: "grant_flag", label: "Nhận cờ" },
    { value: "grant_item", label: "Nhận vật phẩm" },
    { value: "remove_item", label: "Mất vật phẩm" },
    // PRO 6: KHÔNG tham chiếu entity — xem ruleModel.js#SHOW_POPUP.
    { value: "show_popup", label: "Hiện thông báo (Cơ chế Hệ thống)" },
  ];
  const types = kind === "condition" ? conditionTypes : effectTypes;
  const [type, setType] = useState(types[0].value);
  const [entityId, setEntityId] = useState("");
  const [operator, setOperator] = useState(">=");
  const [value, setValue] = useState("");
  const [popupTitle, setPopupTitle] = useState("");
  const [popupText, setPopupText] = useState("");

  const needsQuantity = type === "stat_compare" || type === "stat_change";
  const needsFlag = type === "flag_present" || type === "flag_absent" || type === "grant_flag";
  const isPopup = type === "show_popup";
  const pool = isPopup ? [] : needsQuantity ? listEntities(registry, "quantity") : needsFlag ? listEntities(registry, ENTITY_KINDS.FLAG) : listEntities(registry, ENTITY_KINDS.ITEM);

  function reset() { setEntityId(""); setValue(""); setPopupTitle(""); setPopupText(""); }

  function submit() {
    if (isPopup) {
      if (!popupTitle.trim() && !popupText.trim()) return;
      onAdd(showPopup(popupTitle, popupText));
      reset();
      return;
    }
    if (!entityId) return;
    const num = Number(value);
    if ((type === "stat_compare" || type === "stat_change") && !Number.isFinite(num)) return;
    let item;
    if (type === "stat_compare") item = statCompare(entityId, operator, num);
    else if (type === "flag_present") item = flagPresent(entityId);
    else if (type === "flag_absent") item = flagAbsent(entityId);
    else if (type === "item_present") item = itemPresent(entityId);
    else if (type === "stat_change") item = statChange(entityId, num);
    else if (type === "grant_flag") item = grantFlag(entityId);
    else if (type === "grant_item") item = grantItem(entityId);
    else if (type === "remove_item") item = removeItem(entityId);
    onAdd(item);
    reset();
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select value={type} onValueChange={(v) => { setType(v); reset(); }}>
        <SelectTrigger className="h-7 text-xs w-48"><SelectValue /></SelectTrigger>
        <SelectContent>{types.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
      </Select>
      {isPopup ? (
        <>
          <Input className="h-7 text-xs w-32" placeholder="Tiêu đề" value={popupTitle} onChange={(e) => setPopupTitle(e.target.value)} />
          <Input className="h-7 text-xs w-40" placeholder="Nội dung" value={popupText} onChange={(e) => setPopupText(e.target.value)} />
        </>
      ) : pool.length > 0 ? (
        <Select value={entityId} onValueChange={setEntityId}>
          <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Chọn..." /></SelectTrigger>
          <SelectContent>{pool.map((e) => <SelectItem key={e.id} value={e.id}>{e.displayName}{e.kind === ENTITY_KINDS.RELATIONSHIP ? " (quan hệ)" : ""}</SelectItem>)}</SelectContent>
        </Select>
      ) : (
        <span className="text-[11px] text-muted-foreground italic">(chưa có mục nào trong danh mục — thêm ở "Danh mục" trước)</span>
      )}
      {type === "stat_compare" && (
        <Select value={operator} onValueChange={setOperator}>
          <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
          <SelectContent>{OPERATORS.map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {(type === "stat_compare" || type === "stat_change") && (
        <Input className="h-7 text-xs w-20" type="number" placeholder="số" value={value} onChange={(e) => setValue(e.target.value)} />
      )}
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={submit} disabled={isPopup ? !popupTitle.trim() && !popupText.trim() : !entityId}>
        <Plus className="w-3 h-3 mr-1" /> Thêm
      </Button>
    </div>
  );
}

export default function RuleEditor({ registry, onRegistryChange, kind, items, onItemsChange }) {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null); // ParseItem[] | null
  const [error, setError] = useState("");

  async function handleParse() {
    if (!text.trim()) return;
    setError("");
    setParsing(true);
    try {
      const parseFn = kind === "condition" ? parseConditionText : parseEffectText;
      const result = await parseFn(text, registry);
      setPreview(result.items);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setParsing(false);
    }
  }

  function resolvePreviewIndex(index, resolution) {
    setPreview((prev) => {
      const next = [...prev];
      if (kind === "condition") {
        const pending = next[index].pending;
        let condition;
        if (pending.type === "stat_compare") condition = statCompare(resolution.entity.id, pending.operator, pending.value);
        else if (pending.type === "flag_present") condition = flagPresent(resolution.entity.id);
        else if (pending.type === "flag_absent") condition = flagAbsent(resolution.entity.id);
        else condition = itemPresent(resolution.entity.id);
        next[index] = { status: "ok", condition, entityLabel: resolution.entity.displayName };
      } else {
        const pending = next[index].pending;
        let effect;
        if (pending.type === "stat_change") effect = statChange(resolution.entity.id, pending.amount);
        else if (pending.type === "grant_flag") effect = grantFlag(resolution.entity.id);
        else if (pending.type === "grant_item") effect = grantItem(resolution.entity.id);
        else effect = removeItem(resolution.entity.id);
        next[index] = { status: "ok", effect, entityLabel: resolution.entity.displayName };
      }
      return next;
    });
  }

  function applyPreview() {
    const okItems = (preview || []).filter((p) => p.status === "ok").map((p) => (kind === "condition" ? p.condition : p.effect));
    if (okItems.length) onItemsChange([...items, ...okItems]);
    setPreview(null);
    setText("");
  }

  function removeAt(index) {
    onItemsChange(items.filter((_, i) => i !== index));
  }

  const hasUnresolvedInPreview = (preview || []).some((p) => p.status !== "ok" && p.status !== "unsupported");

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => <RuleChip key={i} registry={registry} kind={kind} item={item} onRemove={() => removeAt(i)} />)}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <Input
          className="h-8 text-xs flex-1"
          placeholder={kind === "condition" ? 'Viết bằng lời — vd: "Uy tín từ 20 trở lên và đã cứu Tiểu Lan"' : 'Viết bằng lời — vd: "Uy tín -5, tăng 8 Sủng ái Lệ Phi"'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleParse())}
        />
        <Button type="button" size="sm" className="h-8 text-xs shrink-0" onClick={handleParse} disabled={parsing || !text.trim()}>
          {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        </Button>
      </div>
      {error && <p role="alert" className="text-[11px] text-destructive">{error}</p>}

      {preview && (
        <div className="space-y-1.5 rounded-lg border border-dashed border-border p-2">
          {preview.length === 0 ? (
            <p className="text-xs text-muted-foreground">Không nhận diện được câu này — hãy thử viết lại hoặc dùng ô tự thêm thủ công bên dưới.</p>
          ) : (
            preview.map((p, i) => (
              <ParsePreviewRow key={i} registry={registry} onRegistryChange={onRegistryChange} kind={kind} parseItem={p} onResolved={(res) => resolvePreviewIndex(i, res)} />
            ))
          )}
          <div className="flex justify-end gap-1.5 pt-1">
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPreview(null)}>Huỷ</Button>
            <Button type="button" size="sm" className="h-7 text-xs" onClick={applyPreview} disabled={hasUnresolvedInPreview || preview.every((p) => p.status !== "ok")}>Áp dụng</Button>
          </div>
        </div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground select-none">Tự thêm thủ công (không cần AI)</summary>
        <div className="pt-1.5"><ManualAddRow registry={registry} kind={kind} onAdd={(item) => onItemsChange([...items, item])} /></div>
      </details>
    </div>
  );
}
