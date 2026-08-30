import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { connectionPorts, insertConsequence } from '@/lib/gameStudio/mapConnections';
import { sceneLabel } from '@/lib/gameStudio/mindMap';

export default function InsertConsequenceDialog({ card, gameData, onApply, onClose }) {
  const source = gameData.nodes[card.sceneId];
  const ports = connectionPorts(source, card.choiceIndex);
  const [snapshot] = useState(() => JSON.stringify(source));
  const [portKey, setPortKey] = useState(ports[0]?.key || '');
  const [title, setTitle] = useState(`Hệ quả · ${card.title}`);
  const [text, setText] = useState(''), [hint, setHint] = useState('');
  const [target, setTarget] = useState(''), [error, setError] = useState('');
  const port = ports.find((p) => p.key === portKey);
  const oldDestination = gameData.nodes[port?.target] ? port.target : '';
  const destination = oldDestination || target;
  function save() {
    try {
      if (JSON.stringify(gameData.nodes[card.sceneId]) !== snapshot) throw new Error('Đáp án nguồn đã thay đổi. Đóng và mở lại để tránh thay nhầm đường đi.');
      onApply(insertConsequence(gameData, { sourceId: card.sceneId, choiceIndex: card.choiceIndex, portKey, targetId: target, title, text, hint }));
      onClose();
    } catch (e) { setError(e.message); }
  }
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-xl max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>Chèn cảnh hệ quả</DialogTitle><DialogDescription>Thêm một cảnh chơi thật giữa đáp án này và cảnh tiếp theo. Giữ nguyên điểm, điều kiện và các nhánh khác.</DialogDescription></DialogHeader>
    {ports.length > 1 && <label className="text-sm">Chèn vào kết quả<select className="block w-full rounded border bg-background p-2" value={portKey} onChange={(e) => setPortKey(e.target.value)}>{ports.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>}
    {!oldDestination && <label className="text-sm">Sau hệ quả sẽ đến cảnh nào?<select className="block w-full rounded border bg-background p-2" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Chưa nối — tôi sẽ nối sau</option>{Object.entries(gameData.nodes).map(([id,n]) => <option key={id} value={id}>{sceneLabel(id,n)}</option>)}</select></label>}
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"><strong>Đường đi sau khi chèn</strong><p className="mt-1">{card.title} → {title || 'Cảnh hệ quả'} → Tiếp tục → {destination ? sceneLabel(destination, gameData.nodes[destination]) : '(Chưa chọn cảnh tiếp theo)'}</p></div>
    <label className="text-sm">Tên cảnh phụ<input className="block w-full rounded border bg-background p-2" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
    <label className="text-sm">Nội dung hệ quả<textarea className="block w-full rounded border bg-background p-2" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ví dụ: Sau khi bạn chọn giúp cô ấy, cô mỉm cười và kể thêm về bức tranh… Có thể để trống cho AI viết sau." /></label>
    <label className="text-sm">Yêu cầu cho AI (không bắt buộc)<textarea className="block w-full rounded border bg-background p-2" rows={2} value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Cảnh này cần thể hiện điều gì?" /></label>
    <p className="text-xs text-muted-foreground">Chỉ tạo đúng một cảnh phụ, không tạo cảnh phía sau. Nút Tiếp tục giữ đích cũ nếu có, nếu không sẽ để chưa nối. Bạn có thể sửa cảnh này, thêm lựa chọn để rẽ nhánh hoặc chèn tiếp cảnh phụ. Trong xưởng AI, chọn ô hệ quả rồi yêu cầu AI viết như các cảnh khác.</p>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <div className="flex gap-2"><Button onClick={save}>Tạo một cảnh hệ quả</Button><Button variant="outline" onClick={onClose}>Hủy</Button></div>
  </DialogContent></Dialog>;
}
