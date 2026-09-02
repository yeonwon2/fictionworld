import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function MindMapSystemPopup({ node, choiceIndex, onSave }) {
  const choice = choiceIndex != null;
  const popup = (choice ? node.choices[choiceIndex] : node)?.systemPopup;
  const [draft, setDraft] = useState(null);
  const [snapshot, setSnapshot] = useState('');
  const [error, setError] = useState('');
  if (!popup && !draft) return null;
  return <>
    <div className="mt-2 rounded-lg border border-cyan-500/50 bg-cyan-500/10 p-2 whitespace-normal" aria-label="Thông báo nổi">
      <strong className="block text-xs">✦ {popup?.title || 'Thông báo'}</strong>
      <span className="block text-[10px] text-muted-foreground">{choice ? 'Hiện khi chọn lựa chọn này' : 'Hiện khi vào cảnh này'}</span>
      <p className="whitespace-pre-wrap mt-1">{popup?.text || '(Chưa có nội dung)'}</p>
      <button className="text-primary underline mt-1 text-xs" onClick={(e) => { e.stopPropagation(); setDraft({ title: popup?.title || '', text: popup?.text || '' }); setSnapshot(JSON.stringify(popup)); setError(''); }}>Sửa thông báo</button>
    </div>
    {draft && <Dialog open onOpenChange={(open) => !open && setDraft(null)}><DialogContent className="max-w-xl" onClick={(e) => e.stopPropagation()}><DialogHeader><DialogTitle>Sửa bảng thông báo</DialogTitle><DialogDescription>{choice ? 'Thông báo gắn với lựa chọn này.' : 'Thông báo gắn với cảnh này.'} Có thể là hệ thống, thánh chỉ, chiếu thư, nhiệm vụ hoặc loại khác. Không thêm cảnh hoặc thay đường nối.</DialogDescription></DialogHeader>
      <label className="text-sm">Tiêu đề<input className="block w-full rounded border bg-background p-2 mt-1" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
      <label className="text-sm">Nội dung thông báo<textarea className="block w-full rounded border bg-background p-2 mt-1" rows={7} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} /></label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2"><Button onClick={() => { if (snapshot !== JSON.stringify(popup)) { setError('Thông báo đã thay đổi. Đóng và mở lại để tránh ghi đè.'); return; } if (!draft.title.trim()) { setError('Cần tiêu đề để game kích hoạt thông báo.'); return; } onSave({ ...popup, ...draft }); setDraft(null); }}>Lưu thông báo</Button><Button variant="outline" onClick={() => setDraft(null)}>Hủy</Button></div>
    </DialogContent></Dialog>}
  </>;
}
