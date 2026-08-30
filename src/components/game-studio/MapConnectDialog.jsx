import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { connectionPorts, connectFromCard } from '@/lib/gameStudio/mapConnections';
import { sceneLabel } from '@/lib/gameStudio/mindMap';

export default function MapConnectDialog({ gameData, request, onApply, onClose }) {
  const { sourceId, choiceIndex = null, create } = request;
  const source = gameData.nodes[sourceId];
  const ports = connectionPorts(source, choiceIndex);
  const [snapshot] = useState(() => JSON.stringify(source));
  const [selected, setSelected] = useState(() => ports.filter((p) => choiceIndex !== null || ports.length === 1 || !p.target || !gameData.nodes[p.target]).map((p) => p.key));
  const [role, setRole] = useState(request.role || 'main');
  const [count, setCount] = useState(request.role === 'side' ? 1 : 4), [ending, setEnding] = useState(false);
  const [target, setTarget] = useState(''), [hint, setHint] = useState(''), [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const replaced = ports.filter((p) => selected.includes(p.key) && p.target && (create || p.target !== target));
  function apply() {
    try {
      if (JSON.stringify(gameData.nodes[sourceId]) !== snapshot) throw new Error('Ô nguồn đã thay đổi. Đóng và mở lại để xem liên kết mới.');
      const result = connectFromCard(gameData, { sourceId, choiceIndex, create, portKeys: selected, targetId: target, choiceCount: ending ? 0 : count, ending, hint, role });
      onApply(result); onClose();
    } catch (e) { setError(e.message); }
  }
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-xl max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>{create ? 'Thêm cảnh ngay từ ô này' : 'Nối vào cảnh có sẵn'}</DialogTitle><DialogDescription>{sceneLabel(sourceId, source)}{choiceIndex !== null ? ` · Lựa chọn ${choiceIndex + 1}` : ''}. Chỉ các đường được chọn bên dưới mới thay đổi.</DialogDescription></DialogHeader>
    {create ? <div className="space-y-3"><label className="block text-sm">Loại cảnh mới<select className="block w-full rounded border bg-background p-2" value={role} onChange={(e) => setRole(e.target.value)}><option value="main">Cảnh chính — tiếp tục cốt truyện</option><option value="side">Cảnh phụ — mở rộng câu chuyện</option></select></label><p className="text-xs text-muted-foreground">Chỉ tạo một cảnh với số đáp án bạn chọn. Không kế thừa vai trò hệ quả của cảnh nguồn, không tạo cảnh phía sau.</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={ending} onChange={(e) => setEnding(e.target.checked)} />Đây là ô kết thúc</label>{!ending && <label className="block text-sm">Số lựa chọn của cảnh mới<input className="border rounded p-2 bg-background block mt-1 w-24" type="number" min={0} max={12} value={count} onChange={(e) => setCount(Number(e.target.value))} /></label>}<label className="block text-sm">Ý chính cho AI (không bắt buộc)<textarea className="border rounded p-2 bg-background w-full mt-1" rows={2} value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Để trống rồi viết sau cũng được" /></label></div> : <div className="space-y-2"><input aria-label="Tìm cảnh để nối" className="border rounded p-2 bg-background w-full" placeholder="Tìm theo tên hoặc nội dung…" value={query} onChange={(e) => setQuery(e.target.value)} /><label className="block text-sm">Cảnh đích<select className="border rounded p-2 bg-background w-full mt-1" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Chọn cảnh…</option>{Object.entries(gameData.nodes).filter(([id, n]) => id === target || `${sceneLabel(id,n)} ${n.workshopHint || ''} ${n.text || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(([id,n]) => <option key={id} value={id}>{sceneLabel(id,n)}{n.workshopHint ? ` · ${n.workshopHint.slice(0,50)}` : ''}</option>)}</select></label><p className="text-xs text-muted-foreground">Có thể nhập nhánh về cảnh chung hoặc quay lại cảnh trước, kể cả chính cảnh này.</p></div>}
    {ports.length ? <div className="space-y-2"><strong className="text-sm">Những đáp án nào dẫn tới cảnh này?</strong><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setSelected(ports.map((p) => p.key))}>Chọn tất cả ({ports.length})</Button><Button size="sm" variant="outline" onClick={() => setSelected([])}>Bỏ chọn hết</Button></div><div className="max-h-56 overflow-auto space-y-2">{ports.map((p) => <label key={p.key} className="flex items-start gap-2 border rounded p-2 text-sm"><input className="mt-1" type="checkbox" checked={selected.includes(p.key)} onChange={() => setSelected((s) => s.includes(p.key) ? s.filter((k) => k !== p.key) : [...s,p.key])} /><span>{p.label}<small className="block text-muted-foreground">Hiện tại: {p.target ? sceneLabel(p.target, gameData.nodes[p.target]) : 'Chưa nối'}</small></span></label>)}</div></div> : <p className="text-sm">Ô này chưa có đáp án. Sẽ thêm một đáp án trống dẫn tới cảnh đích; AI có thể viết lời đáp án sau.</p>}
    {!!replaced.length && <p className="rounded border border-amber-400 p-2 text-sm">Sẽ thay đích của {replaced.length} đường đã nối. Các đáp án không được chọn giữ nguyên.</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <div className="flex gap-2"><Button onClick={apply} disabled={ports.length > 0 && !selected.length}>{create ? `Tạo ${ending ? 'kết thúc' : `cảnh · ${count} lựa chọn`} và nối` : 'Nối các đáp án đã chọn'}</Button><Button variant="outline" onClick={onClose}>Hủy</Button></div>
  </DialogContent></Dialog>;
}
