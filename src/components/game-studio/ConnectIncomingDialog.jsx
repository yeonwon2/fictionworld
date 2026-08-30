import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { connectionPorts, connectIncoming, createMergeScene } from '@/lib/gameStudio/mapConnections';
import { sceneLabel } from '@/lib/gameStudio/mindMap';

export default function ConnectIncomingDialog({ gameData, targetId = null, onSave, onClose, create = false, initialIds = [] }) {
  const [snapshot] = useState(() => JSON.stringify(gameData.nodes));
  const [count, setCount] = useState(4);
  const [selected, setSelected] = useState(() => initialIds.flatMap((id) => connectionPorts(gameData.nodes[id] || {}).map((p) => JSON.stringify([id, p.key])))), [query, setQuery] = useState(''), [error, setError] = useState('');
  const keyFor = (sourceId, portKey) => JSON.stringify([sourceId, portKey]);
  const groups = Object.entries(gameData.nodes).filter(([, node]) => !node.isEnding).map(([id, node]) => ({ id, node, ports: connectionPorts(node) })).filter((g) => g.ports.length);
  const search = query.trim().toLocaleLowerCase();
  const shown = groups.filter((g) => `${sceneLabel(g.id,g.node)} ${g.id} ${g.node.text || ''} ${g.ports.map((p) => p.label).join(' ')}`.toLocaleLowerCase().includes(search));
  const chosen = groups.flatMap((g) => g.ports.filter((p) => selected.includes(keyFor(g.id,p.key))).map((p) => ({sourceId:g.id,portKey:p.key,old:p.target})));
  const overwritten = chosen.filter((p) => p.old && p.old !== targetId).length;
  const toggle = (keys) => setSelected((prev) => keys.every((k) => prev.includes(k)) ? prev.filter((k) => !keys.includes(k)) : [...new Set([...prev,...keys])]);
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-2xl max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>{create ? 'Tạo cảnh chung để nhập các nhánh' : `Nối đáp án vào ${sceneLabel(targetId,gameData.nodes[targetId])}`}</DialogTitle><DialogDescription>Chọn đáp án từ bất kỳ cảnh trước hoặc sau, kể cả chính cảnh này. Chọn cả nhóm để nối A, B, C, D trong một lần.</DialogDescription></DialogHeader>
    {create && <><label className="block text-sm">Số đáp án của cảnh chung mới<input className="block w-24 rounded border bg-background p-2 mt-1" type="number" min={0} max={12} value={count} onChange={(e) => setCount(Number(e.target.value))} /></label><p className="text-sm">Chọn các cảnh hệ quả bên dưới. Một lần bấm sẽ tạo đúng một cảnh chính mới và nối các đáp án đã chọn vào đó.</p></>}
    <input aria-label="Tìm cảnh nguồn" className="rounded border p-2 bg-background w-full" placeholder="Tìm Cảnh 1, Cảnh 2 hoặc nội dung đáp án…" value={query} onChange={(e) => setQuery(e.target.value)} />
    <div className="flex items-center justify-between"><strong className="text-sm">Đã chọn {chosen.length} đường nối</strong><Button size="sm" variant="outline" onClick={() => setSelected([])}>Bỏ chọn hết</Button></div>
    <div className="max-h-[45vh] overflow-auto space-y-2">{shown.map((g) => {
      const keys = g.ports.map((p) => keyFor(g.id,p.key));
      const count = keys.filter((k) => selected.includes(k)).length;
      return <div key={g.id} className="rounded-lg border p-3"><label className="flex gap-2 items-center text-sm font-semibold"><input type="checkbox" checked={count === keys.length} onChange={() => toggle(keys)} />Tất cả đáp án · {sceneLabel(g.id,g.node)} <span className="text-muted-foreground">({count}/{keys.length})</span></label><details open={!!search ? true : undefined} className="mt-2"><summary className="cursor-pointer text-xs text-primary">Chọn riêng từng đáp án</summary><div className="space-y-2 mt-2">{g.ports.map((p) => <label key={p.key} className="flex gap-2 items-start text-sm"><input type="checkbox" className="mt-1" checked={selected.includes(keyFor(g.id,p.key))} onChange={() => toggle([keyFor(g.id,p.key)])} /><span>{p.label}<small className="block text-muted-foreground">{p.target === targetId ? 'Đã nối vào cảnh này' : `Đích hiện tại: ${p.target ? sceneLabel(p.target,gameData.nodes[p.target]) : 'Chưa nối'}`}</small></span></label>)}</div></details></div>;
    })}{!shown.length && <p className="text-sm text-muted-foreground">Không có đáp án phù hợp.</p>}</div>
    {overwritten > 0 && <p className="text-sm rounded border border-amber-400 p-2">Sẽ đổi đích của {overwritten} đáp án đang dẫn sang cảnh khác. Những đáp án không chọn giữ nguyên.</p>}
    <p className="text-xs text-muted-foreground">Bỏ dấu chọn chỉ loại khỏi thao tác lần này, không gỡ đường đã nối trước đó.</p>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <div className="flex gap-2"><Button disabled={!chosen.length} onClick={() => { try { if (snapshot !== JSON.stringify(gameData.nodes)) throw new Error('Sơ đồ đã thay đổi. Hãy đóng và mở lại để không nối nhầm.'); if (create) { const result = createMergeScene(gameData,chosen,count); onSave(result.game,result.targetId); } else onSave(connectIncoming(gameData,targetId,chosen),targetId); onClose(); } catch(e) { setError(e.message); } }}>{create ? `Tạo 1 cảnh và nhập ${chosen.length} đường vào` : `Nối ${chosen.length} đáp án vào đây`}</Button><Button variant="outline" onClick={onClose}>Hủy</Button></div>
  </DialogContent></Dialog>;
}
