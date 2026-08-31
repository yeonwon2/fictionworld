import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { aiCall } from '@/lib/aiCall';
import { sceneLabel } from '@/lib/gameStudio/mindMap';
import { SCORE_BALANCE_SCHEMA, scoreCandidates, balancePrompt, readScoreProposals, applyScoreProposals } from '@/lib/gameStudio/scoreBalance';

export default function ScoreBalanceDialog({ game, selectedKeys = [], onApply, onClose }) {
  const [stat, setStat] = useState(game.meta.statsConfig?.[0]?.key || '');
  const [scope, setScope] = useState(selectedKeys.length ? 'selected' : 'all');
  const [instruction, setInstruction] = useState('Giữ nguyên nội dung và đường nối. Cộng điểm khi hành động phù hợp tính cách nhân vật; trừ khi gây tổn thương hoặc mất lòng tin; trung lập thì 0. Cân nhắc các ngưỡng kết thúc hiện có.');
  const [rows, setRows] = useState([]), [approved, setApproved] = useState([]);
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState('');
  const latest = useRef(game), mounted = useRef(true); latest.current = game;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const reset = () => { setRows([]); setApproved([]); setStatus(''); setError(''); setSnapshot(''); };
  async function propose() {
    reset(); setBusy(true);
    const original = latest.current, stamp = JSON.stringify(original);
    setSnapshot(stamp);
    let collected = [], missing = 0, unchanged = 0;
    try {
      const candidates = scoreCandidates(original, stat, scope === 'selected' ? selectedKeys : scope === 'all' ? null : [`scene:${scope}`]);
      if (!candidates.length) throw new Error('Không có đáp án đã viết phù hợp. Ô xét ending và nút Tiếp tục hệ quả được giữ nguyên.');
      // Validate context size before any request. Small batches prevent oversized responses.
      balancePrompt(original, candidates.slice(0, 20), stat, instruction);
      for (let i = 0; i < candidates.length; i += 20) {
        if (!mounted.current) return;
        if (JSON.stringify(latest.current) !== stamp) throw new Error('Game đã thay đổi. Hãy lấy đề xuất mới.');
        setStatus(`AI đang rà soát nhóm ${Math.floor(i / 20) + 1}/${Math.ceil(candidates.length / 20)}… Chưa áp dụng điểm.`);
        const batch = candidates.slice(i, i + 20);
        const response = await aiCall(balancePrompt(original, batch, stat, instruction), { jsonSchema: SCORE_BALANCE_SCHEMA, useCache: false });
        if (!mounted.current) return;
        const parsed = readScoreProposals(response, batch);
        collected = [...collected, ...parsed.rows]; missing += parsed.missing; unchanged += parsed.unchanged;
      }
      setStatus(`${collected.length} thay đổi đề xuất · ${unchanged} giữ nguyên · ${missing} chưa được AI trả về. Mọi dòng đều chưa chọn duyệt.`);
    } catch (e) { if (mounted.current) { setError(e.message); setStatus(`Đã nhận ${collected.length} đề xuất từ các nhóm hoàn thành. Có thể duyệt riêng các dòng này nếu game chưa thay đổi.`); } }
    finally { if (mounted.current) { setRows(collected); setBusy(false); } }
  }
  const stale = !!snapshot && snapshot !== JSON.stringify(game);
  return <Dialog open onOpenChange={v => !v && !busy && onClose()}><DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
    <DialogHeader><DialogTitle>Cân bằng điểm bằng AI</DialogTitle><DialogDescription>AI chỉ đề xuất điểm cộng/trừ. Chỉ dòng bạn tích duyệt mới được lưu; nội dung, đường nối và ngưỡng kết thúc giữ nguyên.</DialogDescription></DialogHeader>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block">Chỉ số cần cân bằng<select className="block w-full border rounded p-2 bg-background" value={stat} onChange={e => { setStat(e.target.value); reset(); }}><option value="" disabled>Chọn chỉ số</option>{(game.meta.statsConfig || []).map(s => <option key={s.key} value={s.key}>{s.label || s.key}</option>)}</select></label>
      <label className="block">Phạm vi<select className="block w-full border rounded p-2 bg-background" value={scope} onChange={e => { setScope(e.target.value); reset(); }}><option value="all">Toàn bộ kịch bản</option>{selectedKeys.length > 0 && <option value="selected">Các ô đã chọn trên sơ đồ</option>}{Object.entries(game.nodes).filter(([, n]) => !n.isEnding && !n.automaticEnding).map(([id,n]) => <option key={id} value={id}>{sceneLabel(id,n)}</option>)}</select></label>
      <label className="block">Yêu cầu cân bằng<textarea rows={3} className="block w-full border rounded p-2 bg-background" value={instruction} onChange={e => { setInstruction(e.target.value); reset(); }}/></label>
      <p className="text-xs text-muted-foreground">Gửi toàn bộ bối cảnh và luật game qua cấu hình AI hiện có; xử lý tối đa 20 kết quả đáp án/lượt. Game lớn có thể cần nhiều lượt AI. Không sửa điểm chiến đấu/sự kiện, ô xét ending hoặc nút Tiếp tục hệ quả.</p>
      <Button disabled={!stat || !instruction.trim()} onClick={propose}>AI đề xuất cân bằng điểm</Button>
    </fieldset>
    {status && <p role="status" className="text-sm">{status}</p>}{error && <p role="alert" className="text-red-600">{error}</p>}{stale && <p role="alert" className="text-red-600">Game đã thay đổi; cần lấy đề xuất mới trước khi áp dụng.</p>}
    {rows.length > 0 && <><div className="overflow-auto max-h-96 border rounded"><table className="w-full text-sm"><thead><tr className="text-left"><th className="p-2">Duyệt</th><th>Cảnh / Đáp án</th><th>Điểm cũ</th><th>Đề xuất</th><th>Lý do</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t align-top"><td className="p-2"><input type="checkbox" aria-label={`Duyệt ${row.sceneId} đáp án ${row.index + 1} ${row.outcome}`} disabled={busy || stale} checked={approved.includes(row.id)} onChange={e => setApproved(ids => e.target.checked ? [...ids, row.id] : ids.filter(id => id !== row.id))}/></td><td className="p-2 min-w-48"><strong>{sceneLabel(row.sceneId, game.nodes[row.sceneId])} · {row.index + 1} {row.outcome}</strong><p>{row.text}</p></td><td className="p-2">{row.oldValue > 0 ? '+' : ''}{row.oldValue}</td><td className="p-2 font-semibold">{row.value > 0 ? '+' : ''}{row.value}</td><td className="p-2 min-w-48">{row.reason}</td></tr>)}</tbody></table></div>
      <p className="text-xs">Sau khi áp dụng, chạy QA và chơi thử để kiểm tra khả năng đạt HE/BE. AI không đảm bảo mọi ending đều đạt được khi bạn chỉ duyệt một phần.</p>
      <Button disabled={busy || stale || !approved.length} onClick={() => { try { const next = applyScoreProposals(latest.current, snapshot, rows, approved); onApply(next); onClose(); } catch(e) { setError(e.message); } }}>Áp dụng {approved.length} dòng đã duyệt</Button></>}
  </DialogContent></Dialog>;
}
