import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import FileUrlInput from '@/components/FileUrlInput';
import { choiceLabel, sceneLabel } from '@/lib/gameStudio/mindMap';
import { ENDING_TYPES } from '@/lib/gameStudio/rpgThemes';

const labels = {
  workshopTitle: 'Tên cảnh phụ', workshopHint: 'Ý chính cho AI',
  text: 'Nội dung', speaker: 'Người nói', npcAvatar: 'Ảnh nhân vật', bgImage: 'Ảnh nền',
  targetNodeId: 'Sau lựa chọn này, đi đến', endingType: 'Loại kết thúc', endingLabel: 'Tên kết thúc',
  statRequirements: 'Chỉ được chọn khi chỉ số đạt ít nhất', statRequirementsMax: 'Chỉ được chọn khi chỉ số không vượt quá',
  statModifiers: 'Thay đổi chỉ số', requiresFlag: 'Cần sự kiện đã xảy ra', requiresFlagAbsent: 'Cần sự kiện chưa xảy ra',
  grantFlag: 'Ghi nhận sự kiện', grantFlags: 'Ghi nhận các sự kiện', setFlags: 'Sự kiện xảy ra khi vào cảnh',
  requiresItem: 'Cần có vật phẩm', grantItem: 'Nhận vật phẩm', removeItem: 'Mất vật phẩm', npcAffinity: 'Thay đổi tình cảm',
  systemPopup: 'Thông báo trong game', title: 'Tiêu đề', quest: 'Nhiệm vụ', desc: 'Mô tả', reward: 'Phần thưởng',
  diceRoll: 'Thử vận may', stat: 'Chỉ số dùng để thử', difficulty: 'Độ khó', successTarget: 'Nếu thành công, đi đến',
  failTarget: 'Nếu thất bại, đi đến', successMods: 'Thay đổi chỉ số khi thành công', failMods: 'Thay đổi chỉ số khi thất bại',
  combat: 'Trận đấu', enemy: 'Đối thủ', name: 'Tên', hp: 'Sức khỏe', attack: 'Tấn công', defense: 'Phòng thủ',
  avatar: 'Ảnh', intro: 'Giới thiệu', winTarget: 'Nếu thắng, đi đến', loseTarget: 'Nếu thua, đi đến',
  fleeTarget: 'Nếu chạy thoát, đi đến', fleeChance: 'Khả năng chạy thoát (0–1)', loot: 'Phần thưởng khi thắng',
  randomEvents: 'Sự kiện ngẫu nhiên', chance: 'Khả năng xảy ra (0–1)', exp: 'Kinh nghiệm', systemPoints: 'Điểm hệ thống',
  unlockSkill: 'Kỹ năng nhận được', completeQuestId: 'Nhiệm vụ hoàn thành', label: 'Nhãn lựa chọn',
};
const destinations = new Set(['workshopRole', 'workshopContinuation','targetNodeId', 'successTarget', 'failTarget', 'winTarget', 'loseTarget', 'fleeTarget']);
const hidden = new Set(['id', 'choices', 'isEnding']);
const controlClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
const hasContent = (value) => value !== null && value !== undefined && value !== '' && value !== false &&
  (Array.isArray(value) ? value.some(hasContent) : typeof value === 'object' ? Object.values(value).some(hasContent) : true);

// Keep the initial field shape while editing, so clearing a value never hides its input.
function ExistingField({ field, value, initial, onChange, allNodes, statsConfig, path }) {
  const title = labels[field] || statsConfig.find((stat) => stat.key === field)?.label || field;
  const inputId = `map-edit-${path}`;
  const nestedProps = { allNodes, statsConfig };
  if (Array.isArray(initial)) return <fieldset className="space-y-2 rounded-xl border p-3">
    <legend className="px-1 text-sm font-medium">{title}</legend>
    {initial.map((item, index) => <ExistingField key={index} {...nestedProps} field={typeof item === 'object' ? `Sự kiện ${index + 1}` : `${title} ${index + 1}`} path={`${path}-${index}`} initial={item} value={value?.[index]} onChange={(next) => { const items = [...(value || [])]; items[index] = next; onChange(items); }} />)}
  </fieldset>;
  if (initial && typeof initial === 'object') return <fieldset className="space-y-3 rounded-xl border p-3">
    <legend className="px-1 text-sm font-medium">{title}</legend>
    {Object.entries(initial).filter(([key, item]) => !hidden.has(key) && hasContent(item)).map(([key, item]) => <ExistingField key={key} {...nestedProps} field={key} path={`${path}-${key}`} initial={item} value={value?.[key]} onChange={(next) => onChange({ ...value, [key]: next })} />)}
  </fieldset>;
  let input;
  if (destinations.has(field)) input = <select id={inputId} className={controlClass} value={value || ''} onChange={(event) => onChange(event.target.value)}>
    <option value="">Chọn cảnh…</option>
    {value && !allNodes[value] && <option value={value}>Không tìm thấy cảnh: {value}</option>}
    {Object.entries(allNodes).map(([id, node]) => <option key={id} value={id}>{sceneLabel(id, node)}</option>)}
  </select>;
  else if (field === 'endingType') input = <select id={inputId} className={controlClass} value={value || 'NORMAL_END'} onChange={(event) => onChange(event.target.value)}>{Object.entries(ENDING_TYPES).map(([key, ending]) => <option key={key} value={key}>{ending.label}</option>)}</select>;
  else if (['npcAvatar', 'bgImage', 'avatar'].includes(field)) input = <FileUrlInput value={value || ''} onChange={onChange} preview />;
  else if (typeof initial === 'boolean') input = <input id={inputId} type="checkbox" checked={!!value} onChange={(event) => onChange(event.target.checked)} />;
  else if (['text', 'desc', 'intro'].includes(field)) input = <textarea id={inputId} className={controlClass} rows={field === 'text' ? 6 : 3} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />;
  else input = <input id={inputId} className={controlClass} type={typeof initial === 'number' ? 'number' : 'text'} step="any" value={value ?? ''} onChange={(event) => onChange(typeof initial === 'number' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value)} />;
  return <div className="space-y-1.5"><label htmlFor={inputId} className="block text-sm font-medium">{title}</label>{input}</div>;
}

export default function MindMapEditor({ node, choiceIndex, allNodes, statsConfig, onChange, onClose }) {
  const isChoice = choiceIndex != null;
  const source = isChoice ? node.choices[choiceIndex] : node;
  const [original] = useState(() => JSON.stringify(source));
  const [draft, setDraft] = useState(() => structuredClone(source));
  const [shape, setShape] = useState(() => {
    const fields = Object.fromEntries(Object.entries(source).filter(([key, value]) => !hidden.has(key) && hasContent(value)));
    fields.text = source.text || '';
    if (isChoice && !source.diceRoll) fields.targetNodeId = source.targetNodeId || '';
    if (source.isEnding) fields.endingType = source.endingType || 'NORMAL_END';
    // A dice choice uses its two outcomes; its legacy nominal target is not played.
    if (source.diceRoll) delete fields.targetNodeId;
    return fields;
  });
  const [extra, setExtra] = useState('');
  const [error, setError] = useState('');
  const additions = isChoice
    ? { requiresItem: '', grantItem: '', removeItem: '', requiresFlag: '', requiresFlagAbsent: '', grantFlag: '' }
    : { speaker: '', npcAvatar: '', bgImage: '', grantItem: '', systemPopup: { title: 'Thông báo', text: 'Nội dung thông báo' } };
  const available = Object.keys(additions).filter((key) => !(key in shape));
  const title = isChoice ? `${sceneLabel(node.id, node)} · Lựa chọn ${choiceLabel(choiceIndex)}` : sceneLabel(node.id, node);
  function save() {
    if (JSON.stringify(source) !== original) { setError('Ô này vừa được thay đổi ở nơi khác. Hãy đóng và mở lại để xem bản mới nhất.'); return; }
    // Clear optional numeric values by removing them, not by changing their type to string.
    function clean(value, originalValue) {
      if (typeof originalValue === 'number' && value === '') return undefined;
      if (Array.isArray(value)) return value.map((item, index) => clean(item, originalValue?.[index]));
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item, originalValue?.[key])]).filter(([, item]) => item !== undefined));
      return value;
    }
    const edited = clean(draft, source);
    if (isChoice) onChange({ choices: node.choices.map((choice, index) => index === choiceIndex ? edited : choice) });
    else onChange({ ...edited, ...Object.fromEntries(Object.keys(source).filter((key) => !(key in edited)).map((key) => [key, undefined])) });
    onClose();
  }
  const order = ['text', 'speaker', 'targetNodeId', 'endingType'];
  const fields = [...new Set([...order.filter((key) => key in shape), ...Object.keys(shape)])];
  return <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Sửa {title}</DialogTitle><DialogDescription>Chỉ hiển thị thông tin ô này đang dùng. Bấm Lưu thay đổi khi sửa xong; đóng cửa sổ để bỏ bản sửa.</DialogDescription></DialogHeader>
      <div className="space-y-4">{fields.map((field) => <ExistingField key={field} field={field} path={field} initial={shape[field]} value={draft[field]} allNodes={allNodes} statsConfig={statsConfig} onChange={(value) => setDraft((current) => ({ ...current, [field]: value }))} />)}</div>
      {!isChoice && node.choices?.length > 0 && <p className="text-xs text-muted-foreground">Cảnh này có {node.choices.length} lựa chọn. Để sửa một lựa chọn, bấm Sửa ngay trên ô lựa chọn đó trong sơ đồ.</p>}
      {!!available.length && <details className="rounded-lg border px-3 py-2"><summary className="cursor-pointer text-sm text-muted-foreground">Thêm thông tin (không bắt buộc)</summary><div className="flex gap-2 mt-3"><select aria-label="Thông tin muốn thêm" className={controlClass} value={extra} onChange={(event) => setExtra(event.target.value)}><option value="">Chọn thông tin…</option>{available.map((key) => <option key={key} value={key}>{labels[key]}</option>)}</select><Button variant="outline" disabled={!extra} onClick={() => { setShape({ ...shape, [extra]: additions[extra] }); setDraft({ ...draft, [extra]: additions[extra] }); setExtra(''); }}>Thêm</Button></div></details>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 border-t pt-3"><Button variant="outline" onClick={onClose}>Hủy</Button><Button onClick={save}>Lưu thay đổi</Button></div>
    </DialogContent>
  </Dialog>;
}
