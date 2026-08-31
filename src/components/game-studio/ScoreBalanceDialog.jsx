import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { aiCall } from '@/lib/aiCall';
import { sceneLabel } from '@/lib/gameStudio/mindMap';
import { SCORE_BALANCE_SCHEMA, scoreCandidates, balancePrompt, collectScoreProposals, applyScoreProposals } from '@/lib/gameStudio/scoreBalance';

export default function ScoreBalanceDialog({ game, selectedKeys = [], onApply, onClose }) {
  const [stat, setStat] = useState(game.meta.statsConfig?.[0]?.key || '');
  const [scope, setScope] = useState(selectedKeys.length ? 'selected' : 'all');
  const [instruction, setInstruction] = useState('Giữ nguyên nội dung và đường nối. Cộng điểm khi hành động phù hợp tính cách nhân vật; trừ khi gây tổn thương hoặc mất lòng tin; trung lập thì 0. Cân nhắc các ngưỡng kết thúc hiện có.');
  const [rows, setRows] = useState([]), [approved, setApproved] = useState([]);
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState('');
  const session = useRef(null);
  const [remaining, setRemaining] = useState(0);
  const [maxCalls, setMaxCalls] = useState(1), [calls, setCalls] = useState(0);
  const batchSize = 40;
  const latest = useRef(game), mounted = useRef(true); latest.current = game;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const reset = () => { setRows([]); setApproved([]); setStatus(''); setError(''); setSnapshot(''); setRemaining(0); session.current = null; };
  async function propose(resume = false) {
    if (busy) return;
    if (!resume) reset();
    setBusy(true); setError(''); setCalls(0);
    let used = 0;
    try {
      if (!resume) {
        const original = latest.current, stamp = JSON.stringify(original);
        const candidates = scoreCandidates(original, stat, scope === 'selected' ? selectedKeys : scope === 'all' ? null : [`scene:${scope}`]);
        if (!candidates.length) throw new Error('Không có đáp án đã viết phù hợp. Ô xét ending và nút Tiếp tục hệ quả được giữ nguyên.');
        balancePrompt(original, candidates.slice(0, batchSize), stat, instruction);
        session.current = { original, stamp, candidates, accepted: [] };
        setSnapshot(stamp);
      }
      const current = session.current;
      if (!current || JSON.stringify(latest.current) !== current.stamp) throw new Error('Game đã thay đổi. Hãy lấy đề xuất mới.');
      const { original, stamp, candidates } = current;
      const publish = accepted => {
        current.accepted = accepted;
        const changed = accepted.filter(r => r.value !== r.oldValue);
        const scenes = new Set(candidates.map(c => c.sceneId));
        const completed = [...scenes].filter(id => candidates.filter(c => c.sceneId === id).every(c => accepted.some(r => r.id === c.id))).length;
        setRows(changed); setRemaining(candidates.length - accepted.length);
        setStatus(`Đã kiểm tra ${accepted.length}/${candidates.length} kết quả đáp án · hoàn tất ${completed}/${scenes.size} cảnh. ${changed.length} đề xuất đổi điểm · ${accepted.length - changed.length} giữ nguyên · ${candidates.length - accepted.length} còn thiếu. Chưa áp dụng điểm.`);
      };
      publish(current.accepted);
      const result = await collectScoreProposals(candidates, current.accepted,
        batch => aiCall(balancePrompt(original, batch, stat, instruction), {
          jsonSchema: SCORE_BALANCE_SCHEMA, useCache: true, maxAttempts: 1,
          onRequest: () => {
            if (!mounted.current || JSON.stringify(latest.current) !== stamp || used >= maxCalls) throw new Error('Đã dừng theo ngân sách hoặc game đã đổi.');
            used++; setCalls(used);
          },
        }),
        publish, () => mounted.current && JSON.stringify(latest.current) === stamp, { maxCalls, batchSize });
      if (!mounted.current) return;
      publish(result.accepted);
      if (result.error) setError(result.error);
      if (JSON.stringify(latest.current) !== stamp) setError('Game đã thay đổi. Hãy lấy đề xuất mới.');
    } catch (e) { if (mounted.current) setError(e.message); }
    finally { if (mounted.current) setBusy(false); }
  }
  const stale = !!snapshot && snapshot !== JSON.stringify(game);
  const total = stat && game.meta.statsConfig?.some(s => s.key === stat)
    ? scoreCandidates(game, stat, scope === 'selected' ? selectedKeys : scope === 'all' ? null : [`scene:${scope}`]).length : 0;
  const pendingCount = snapshot && !stale ? remaining : total;
  return <Dialog open onOpenChange={v => !v && !busy && onClose()}><DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
    <DialogHeader><DialogTitle>Cân bằng điểm bằng AI</DialogTitle><DialogDescription>AI chỉ đề xuất điểm cộng/trừ. Chỉ dòng bạn tích duyệt mới được lưu; nội dung, đường nối và ngưỡng kết thúc giữ nguyên.</DialogDescription></DialogHeader>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block">Chỉ số cần cân bằng<select className="block w-full border rounded p-2 bg-background" value={stat} onChange={e => { setStat(e.target.value); reset(); }}><option value="" disabled>Chọn chỉ số</option>{(game.meta.statsConfig || []).map(s => <option key={s.key} value={s.key}>{s.label || s.key}</option>)}</select></label>
      <label className="block">Phạm vi<select className="block w-full border rounded p-2 bg-background" value={scope} onChange={e => { setScope(e.target.value); reset(); }}><option value="all">Toàn bộ kịch bản</option>{selectedKeys.length > 0 && <option value="selected">Các ô đã chọn trên sơ đồ</option>}{Object.entries(game.nodes).filter(([, n]) => !n.isEnding && !n.automaticEnding).map(([id,n]) => <option key={id} value={id}>{sceneLabel(id,n)}</option>)}</select></label>
      <label className="block">Yêu cầu cân bằng<textarea rows={3} className="block w-full border rounded p-2 bg-background" value={instruction} onChange={e => { setInstruction(e.target.value); reset(); }}/></label>
      <label className="block">Ngân sách mỗi lần bấm<select aria-label="Ngân sách cân bằng AI" className="block w-full border rounded p-2 bg-background" value={maxCalls} onChange={e => setMaxCalls(Number(e.target.value))}><option value={1}>Tối đa 1 lượt</option><option value={2}>Tối đa 2 lượt</option></select></label>
      <p className="text-sm">{total} kết quả đáp án · {pendingCount} chưa kiểm tra · dự kiến {Math.ceil(pendingCount / batchSize)} lượt cho phần còn lại nếu AI trả đủ. Mỗi lần bấm tối đa {maxCalls} lượt, khoảng {Math.min(pendingCount, maxCalls * batchSize)} dòng.</p>
      <p className="text-xs text-muted-foreground">Chỉ gửi lời truyện của nhóm hiện tại và cảnh đích liền kề, cùng bối cảnh chung và luật toàn sơ đồ; không gửi ảnh hay bản kịch bản lặp. Tối đa 40 kết quả/lượt, không tự thử lại JSON ngoài ngân sách. Cache phản hồi giống hệt để tránh gọi lại. Số lượt ít không đồng nghĩa ít token; nội dung dài hoặc phản hồi thiếu có thể cần bấm tiếp tục.</p>
      <p className="text-xs text-muted-foreground">Tiến độ giữ trong cửa sổ này; đóng cửa sổ sẽ mất phiên duyệt. Không sửa điểm chiến đấu/sự kiện, ô xét ending hoặc nút Tiếp tục hệ quả.</p>
      <Button disabled={!stat || !instruction.trim()} onClick={() => propose(false)}>AI đề xuất cân bằng điểm</Button>
    </fieldset>
    <p role="status" className="text-sm">Đã gọi thực tế {calls}/{maxCalls} lượt trong lần bấm vừa rồi (cache không tính lượt).</p>
    {busy && <p className="text-sm">AI đang kiểm tra trong ngân sách đã chọn…</p>}
    {!busy && remaining > 0 && !stale && <Button variant="outline" onClick={() => propose(true)}>Tiếp tục {remaining} dòng còn thiếu</Button>}
    {status && <p role="status" className="text-sm">{status}</p>}{error && <p role="alert" className="text-red-600">{error}</p>}{stale && <p role="alert" className="text-red-600">Game đã thay đổi; cần lấy đề xuất mới trước khi áp dụng.</p>}
    {rows.length > 0 && <><div className="overflow-auto max-h-96 border rounded"><table className="w-full text-sm"><thead><tr className="text-left"><th className="p-2">Duyệt</th><th>Cảnh / Đáp án</th><th>Điểm cũ</th><th>Đề xuất</th><th>Lý do</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t align-top"><td className="p-2"><input type="checkbox" aria-label={`Duyệt ${row.sceneId} đáp án ${row.index + 1} ${row.outcome}`} disabled={busy || stale} checked={approved.includes(row.id)} onChange={e => setApproved(ids => e.target.checked ? [...ids, row.id] : ids.filter(id => id !== row.id))}/></td><td className="p-2 min-w-48"><strong>{sceneLabel(row.sceneId, game.nodes[row.sceneId])} · {row.index + 1} {row.outcome}</strong><p>{row.text}</p></td><td className="p-2">{row.oldValue > 0 ? '+' : ''}{row.oldValue}</td><td className="p-2 font-semibold">{row.value > 0 ? '+' : ''}{row.value}</td><td className="p-2 min-w-48">{row.reason}</td></tr>)}</tbody></table></div>
      <p className="text-xs">Sau khi áp dụng, chạy QA và chơi thử để kiểm tra khả năng đạt HE/BE. AI không đảm bảo mọi ending đều đạt được khi bạn chỉ duyệt một phần.</p>
      <Button disabled={busy || stale || !approved.length} onClick={() => { try { const next = applyScoreProposals(latest.current, snapshot, rows, approved); onApply(next); onClose(); } catch(e) { setError(e.message); } }}>Áp dụng {approved.length} dòng đã duyệt</Button></>}
  </DialogContent></Dialog>;
}
