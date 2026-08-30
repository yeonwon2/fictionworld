import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PastePatternDialog from './PastePatternDialog';
import { copyMapPattern } from '@/lib/gameStudio/mapPatterns';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import MapConnectDialog from './MapConnectDialog';
import MindMapTab from './MindMapTab';
import { aiCall } from '@/lib/aiCall';
import { WORKSHOP_TYPES, makeWorkshopTemplate, addSceneChain, removeWorkshopScene, selectedScopes, orderedWritingKeys, SETUP_SCHEMA, WRITE_SCHEMA, applySetup, setupReviewError, applyWriting, workshopPrompt, touchWorkshop, unfinishedWorkshop } from '@/lib/gameStudio/aiMindMap';

const selectClass = 'rounded-md border bg-background px-3 py-2 text-sm max-w-full';
const caption = (id, node) => `${id === 'start_node' ? 'Lời dẫn' : id}${node?.workshopHint ? ` · ${node.workshopHint.slice(0, 65)}` : ''}`;

function StructureEditor({ id, gameData, onChange, onClose }) {
  const original = useRef(JSON.stringify(gameData.nodes[id]));
  const [draft, setDraft] = useState(() => JSON.parse(original.current));
  const [error, setError] = useState('');
  const targets = <><option value="">Chưa nối</option>{Object.entries(gameData.nodes).map(([key, node]) => <option key={key} value={key}>{caption(key, node)}</option>)}</>;
  const choicePatch = (index, patch) => setDraft({ ...draft, choices: draft.choices.map((c, i) => i === index ? { ...c, ...patch } : c) });
  const save = () => {
    if (JSON.stringify(gameData.nodes[id]) !== original.current) { setError('Cảnh đã thay đổi. Đóng và mở lại để tránh ghi đè.'); return; }
    onChange(touchWorkshop({ ...gameData, nodes: { ...gameData.nodes, [id]: draft } })); onClose();
  };
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Thiết kế cảnh · {id}</DialogTitle></DialogHeader>
    <label className="text-sm">Ý chính để AI bám theo<Textarea aria-label="Ý chính của cảnh" value={draft.workshopHint || ''} onChange={(e) => setDraft({ ...draft, workshopHint: e.target.value })} placeholder="Chuyện gì phải xảy ra? Điều gì không được tiết lộ?" /></label>
    {id !== 'start_node' && <label className="text-sm">Loại ô<select className={`${selectClass} block w-full mt-1`} value={draft.isEnding ? 'ending' : 'scene'} onChange={(e) => {
      const ending = e.target.value === 'ending';
      if (ending && (draft.choices?.length || draft.combat) && !window.confirm('Đổi thành kết thúc sẽ bỏ lựa chọn và trận đấu của cảnh này khi lưu. Tiếp tục?')) return;
      const next = { ...draft, isEnding: ending, ...(ending ? { choices: [], endingType: draft.endingType || 'NORMAL_END' } : {}) };
      if (ending) delete next.combat;
      setDraft(next);
    }}><option value="scene">Cảnh thường</option><option value="ending">Kết thúc</option></select></label>}
    {draft.isEnding ? <label className="text-sm">Loại kết thúc<select className={`${selectClass} block w-full`} value={draft.endingType || 'NORMAL_END'} onChange={(e) => setDraft({ ...draft, endingType: e.target.value })}>{['GOOD_END', 'NORMAL_END', 'BAD_END', 'TRUE_END'].map((v) => <option key={v}>{v}</option>)}</select></label> : <>
      <p className="text-xs text-muted-foreground">Mỗi lựa chọn nối tới bất kỳ cảnh nào, kể cả cảnh này hoặc cảnh trước. Nhiều lựa chọn có thể cùng về một cảnh.</p>
      {(draft.choices || []).map((choice, index) => <div key={index} className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center justify-between"><strong className="text-sm">Lựa chọn {index + 1}</strong><Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, choices: draft.choices.filter((_, i) => i !== index) })}>Xóa lựa chọn</Button></div>
        <Input aria-label={`Nội dung lựa chọn ${index + 1}`} placeholder="Để trống cho AI viết, hoặc nhập ý định của lựa chọn" value={choice.text || ''} onChange={(e) => choicePatch(index, { text: e.target.value })} />
        {choice.diceRoll ? <div className="grid gap-2">{[['successTarget', 'Thành công'], ['failTarget', 'Thất bại']].map(([field, label]) => <label key={field} className="text-xs">{label}<select aria-label={`${label} lựa chọn ${index + 1}`} className={`${selectClass} block w-full`} value={choice.diceRoll[field] || ''} onChange={(e) => choicePatch(index, { diceRoll: { ...choice.diceRoll, [field]: e.target.value } })}>{targets}</select></label>)}</div> : <label className="block text-xs">Dẫn tới<select aria-label={`Đích lựa chọn ${index + 1}`} className={`${selectClass} block w-full mt-1`} value={choice.targetNodeId || ''} onChange={(e) => choicePatch(index, { targetNodeId: e.target.value })}>{targets}</select></label>}
      </div>)}
      <Button variant="outline" onClick={() => setDraft({ ...draft, choices: [...(draft.choices || []), { text: '', targetNodeId: '', statModifiers: {} }] })}>+ Thêm lựa chọn</Button>
      {draft.combat && <p className="text-xs text-muted-foreground">Cảnh có trận đấu. Dùng nút Sửa trên ô để chỉnh các đích chiến đấu.</p>}
    </>}
    {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
    <div className="flex gap-2 justify-between"><Button onClick={save}>Lưu thiết kế cảnh</Button>{id !== 'start_node' && <Button variant="destructive" onClick={() => {
      if (!window.confirm('Xóa cảnh này? Các đường đang dẫn đến nó sẽ được giữ để QA đánh dấu lỗi; bạn cần nối lại chúng.')) return;
      onChange(removeWorkshopScene(gameData, id)); onClose();
    }}>Xóa cảnh</Button>}<Button variant="outline" onClick={onClose}>Hủy</Button></div>
  </DialogContent></Dialog>;
}

function Proposal({ proposal, setProposal, gameData, onApply, onClose, error }) {
  const setup = proposal.kind === 'setup';
  let validationError = error;
  if (setup) { try { validationError = setupReviewError(gameData, proposal.result); } catch (e) { validationError = e.message; } }
  const patch = (values) => setProposal({ ...proposal, result: { ...proposal.result, ...values } });
  const patchEntry = (index, values) => patch({ entries: proposal.result.entries.map((entry, i) => i === index ? { ...entry, ...values } : entry) });
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{setup ? 'Duyệt bối cảnh và bộ điểm AI đề xuất' : 'Duyệt nội dung AI viết'}</DialogTitle></DialogHeader>
    <p className="text-xs text-muted-foreground">Chưa thay đổi game. Bạn có thể sửa bản đề xuất rồi áp dụng. Số ô, lựa chọn và đường nối được giữ nguyên.</p>
    {setup ? <>
      <label className="text-sm">Tên game<Input value={proposal.result.title} onChange={(e) => patch({ title: e.target.value })} /></label>
      <label className="text-sm">Nhân vật nhập vai<Input value={proposal.result.playerName} onChange={(e) => patch({ playerName: e.target.value })} /></label>
      <label className="text-sm">Bối cảnh thống nhất<Textarea rows={8} value={proposal.result.bible} onChange={(e) => patch({ bible: e.target.value })} /></label>
      <div className="space-y-2">{proposal.result.stats.map((stat, index) => <div key={stat.key} className="border rounded-lg p-3 flex flex-wrap items-center gap-3 text-sm"><strong>{stat.label}</strong><span className="text-xs text-muted-foreground">{stat.key}</span><label>Ban đầu <Input className="w-24 inline-block" type="number" value={stat.initial ?? ''} onChange={(e) => patch({ stats: proposal.result.stats.map((s, i) => i === index ? { ...s, initial: Number(e.target.value) } : s) })} /></label><label className="flex items-center gap-2"><input type="checkbox" disabled={gameData.meta.outcomeMode === 'accumulation'} checked={gameData.meta.outcomeMode === 'accumulation' ? false : stat.isVital} onChange={(e) => patch({ stats: proposal.result.stats.map((s, i) => i === index ? { ...s, isVital: e.target.checked } : s) })} />Chỉ số sinh tồn (chạm ngưỡng là thua)</label>{gameData.meta.outcomeMode !== 'accumulation' && stat.isVital && <label>Thua khi ≤ <Input className="w-24 inline-block" type="number" value={stat.deathThreshold ?? ''} onChange={(e) => patch({ stats: proposal.result.stats.map((s, i) => i === index ? { ...s, deathThreshold: Number(e.target.value) } : s) })} /></label>}</div>)}</div>
      {gameData.meta.aiWorkshop.type === 'palace' && <p className="text-sm">Phẩm cấp: {proposal.result.ranks.join(' → ')} · Ân sủng: {proposal.result.primaryStat}</p>}
      {gameData.meta.aiWorkshop.type === 'rebirth' && <div className="text-sm">Vốn: {proposal.result.primaryStat}{proposal.result.eras.map((era, i) => <p key={i}>Từ cảnh {era.at}: {era.label} · Thưởng {era.bonus}</p>)}</div>}
    </> : proposal.result.entries.map((entry, index) => {
      const scope = selectedScopes(gameData, [entry.key])[0];
      if (!scope) return <p key={entry.key}>Ô {entry.key} không còn tồn tại. Hãy bỏ đề xuất và viết lại.</p>;
      return <div key={entry.key} className="border rounded-xl p-4 space-y-3"><h3 className="font-semibold text-sm">{caption(scope.id, gameData.nodes[scope.id])}{scope.choiceIndex !== null ? ` · Lựa chọn ${scope.choiceIndex + 1}` : ''}</h3>
        {scope.choiceIndex === null && <><details className="text-xs"><summary>Bản hiện tại</summary><p className="whitespace-pre-wrap">{gameData.nodes[scope.id].text || '(Chưa viết)'}</p></details><label className="text-xs">Nội dung đề xuất<Textarea rows={6} value={entry.text} onChange={(e) => patchEntry(index, { text: e.target.value })} /></label>{entry.speaker && <Input aria-label="Người nói" value={entry.speaker} onChange={(e) => patchEntry(index, { speaker: e.target.value })} />}</>}
        {entry.systemText && <label className="text-xs">Thông báo hệ thống: {entry.systemTitle}<Textarea value={entry.systemText} onChange={(e) => patchEntry(index, { systemText: e.target.value })} /></label>}
        {entry.choices.map((choice, ci) => <div key={choice.index} className="bg-muted/50 rounded-lg p-2 space-y-1"><label className="text-xs">Lựa chọn {choice.index + 1}<Textarea rows={2} value={choice.text} onChange={(e) => patchEntry(index, { choices: entry.choices.map((c, i) => i === ci ? { ...c, text: e.target.value } : c) })} /></label>{gameData.nodes[scope.id]?.choices?.[choice.index]?.npcCard && <label className="text-xs">Tên nhân vật<Input value={choice.npcName || ''} onChange={(e) => patchEntry(index, { choices: entry.choices.map((c, i) => i === ci ? { ...c, npcName: e.target.value } : c) })} /></label>}<div className="flex flex-wrap gap-2">{choice.modifiers.map((m, mi) => <label key={m.key} className="text-xs">{gameData.meta.statsConfig.find((s) => s.key === m.key)?.label || m.key}<Input className="w-24" type="number" value={m.value} onChange={(e) => patchEntry(index, { choices: entry.choices.map((c, i) => i === ci ? { ...c, modifiers: c.modifiers.map((v, j) => j === mi ? { ...v, value: Number(e.target.value) } : v) } : c) })} /></label>)}</div></div>)}
      </div>;
    })}
    {proposal.result.suggestions && <div className="rounded-lg bg-amber-500/10 p-3 text-sm whitespace-pre-wrap"><strong>AI đề xuất thêm — không tự áp dụng</strong><p>{proposal.result.suggestions}</p></div>}
    {validationError && <p role="alert" className="text-sm text-red-600">{validationError}</p>}
    <div className="flex gap-2"><Button disabled={setup && !!validationError} onClick={onApply}>Áp dụng bản đã duyệt</Button><Button variant="outline" onClick={onClose}>Bỏ đề xuất</Button></div>
  </DialogContent></Dialog>;
}

export default function AIMapWorkshop({ gameData, setGameData, onGenerated, requestAI = aiCall }) {
  const workspace = gameData.meta.aiWorkshop;
  const [type, setType] = useState(workspace?.type || 'studio');
  const [keys, setKeys] = useState([]);
  const [copiedPattern, setCopiedPattern] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [copyNotice, setCopyNotice] = useState('');
  const [connectRequest, setConnectRequest] = useState(null);
  const [mapFocus, setMapFocus] = useState(null);
  const [structureId, setStructureId] = useState(null);
  const [count, setCount] = useState(1), [choiceCount, setChoiceCount] = useState(4);
  const [afterId, setAfterId] = useState('');
  const [ending, setEnding] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState(null);
  const [undo, setUndo] = useState(null);
  const [resetKind, setResetKind] = useState(null);
  const latest = useRef(gameData), mounted = useRef(true);
  const contextPanel = useRef(null);
  const [aiFailure, setAiFailure] = useState('');
  latest.current = gameData;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const scopes = selectedScopes(gameData, keys);
  const updateContext = (patch) => setGameData(touchWorkshop({ ...gameData, meta: { ...gameData.meta, aiWorkshop: { ...workspace, ...patch } } }));
  function change(data) { setUndo(gameData); setGameData(data); }
  function removeCard(card) {
    const game = latest.current;
    const node = game.nodes[card.sceneId];
    if (!node) return;
    if (card.kind === 'choice') {
      if (!node.choices?.[card.choiceIndex]) return;
      if (!window.confirm(`Xóa ${card.title}? Chỉ xóa đáp án và đường nối của nó, không xóa cảnh đích. Có thể hoàn tác ngay sau đó.`)) return;
      change(touchWorkshop({ ...game, nodes: { ...game.nodes, [card.sceneId]: { ...node, choices: node.choices.filter((_, index) => index !== card.choiceIndex) } } }));
      setMapFocus({ id: card.sceneId, token: Date.now() });
    } else {
      if (card.sceneId === 'start_node') return;
      if (!window.confirm(`Xóa ${card.title} cùng các đáp án của cảnh này? Không xóa các cảnh phía sau. Đường đang dẫn tới cảnh bị xóa sẽ được QA đánh dấu để bạn nối lại. Có thể hoàn tác ngay sau đó.`)) return;
      change(removeWorkshopScene(game, card.sceneId));
    }
    // Choice indexes shift after deletion, so old AI selections must not target siblings.
    setKeys([]); setStructureId(null); setConnectRequest(null); setError('');
  }
  function copyScenes(ids = scopes.map((scope) => scope.id)) {
    try { const pattern = copyMapPattern(gameData, ids); setCopiedPattern(pattern); setCopyNotice(`Đã sao chép ${pattern.ids.length} cảnh và các đáp án. Chọn Sao chép / Dán → Dán nhóm để nhân bản.`); setError(''); } catch (e) { setError(e.message); }
  }
  function initialize(blank) {
    change(makeWorkshopTemplate(gameData, type, blank)); setKeys([]); setResetKind(null); setError('');
  }
  async function ask(kind, requestedKeys = keys) {
    if (busy) return;
    setError(''); setAiFailure('');
    const snapshot = latest.current;
    try {
      if (!snapshot.meta.aiWorkshop?.idea?.trim()) throw new Error('Hãy nhập ý tưởng và bối cảnh trước.');
      if (kind === 'write' && !snapshot.meta.aiWorkshop?.setupApproved) throw new Error('Hãy để AI đề xuất bối cảnh và bộ điểm, rồi duyệt trước khi viết cảnh.');
      const chosen = orderedWritingKeys(snapshot, requestedKeys);
      if (kind === 'write' && !chosen.length) throw new Error('Chọn ít nhất một ô để AI viết.');
      setBusy(kind === 'setup' ? 'AI đang dựng bối cảnh và bộ điểm…' : 'AI đang viết các ô đã chọn…');
      const fingerprint = JSON.stringify(snapshot);
      let result, reviewError = '';
      if (kind === 'setup') {
        result = await requestAI(workshopPrompt(snapshot, null, instruction), { jsonSchema: SETUP_SCHEMA, useCache: false });
        reviewError = setupReviewError(snapshot, result);
      } else {
        result = { entries: [], suggestions: '' };
        let working = snapshot;
        // Small batches retain full context and include the previous staged batch.
        for (let i = 0; i < chosen.length; i += 4) {
          if (!mounted.current) return;
          setBusy(`AI đang viết nhóm ${Math.floor(i / 4) + 1}/${Math.ceil(chosen.length / 4)}…`);
          const batch = chosen.slice(i, i + 4);
          const part = await requestAI(workshopPrompt(working, batch, instruction), { jsonSchema: WRITE_SCHEMA, useCache: false });
          working = applyWriting(working, batch, part);
          result.entries.push(...part.entries);
          if (part.suggestions) result.suggestions += `${part.suggestions}\n`;
        }
        applyWriting(snapshot, chosen, result);
      }
      if (!mounted.current) return;
      if (JSON.stringify(latest.current) !== fingerprint) throw new Error('Sơ đồ đã thay đổi trong lúc AI viết. Không áp dụng kết quả cũ; hãy thử lại từ bản hiện tại.');
      setProposal({ kind, keys: chosen, fingerprint, result });
      setError(reviewError);
    } catch (e) { if (mounted.current) { setError(e.message); setAiFailure(e.message); } } finally { if (mounted.current) setBusy(''); }
  }
  function approve() {
    try {
      if (JSON.stringify(latest.current) !== proposal.fingerprint) throw new Error('Sơ đồ hoặc bối cảnh đã thay đổi trong lúc AI viết. Bỏ đề xuất và viết lại để không ghi đè bản mới.');
      change(proposal.kind === 'setup' ? applySetup(gameData, proposal.result) : applyWriting(gameData, proposal.keys, proposal.result)); setProposal(null); setError('');
    } catch (e) { setError(e.message); }
  }
  const unfinished = unfinishedWorkshop(gameData);
  return <fieldset disabled={!!busy} className="space-y-4 min-w-0">
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <h2 className="text-lg font-semibold">Xưởng Kịch Bản Sơ Đồ AI</h2>
      <p className="text-sm text-muted-foreground">Bạn dựng khung và đường đi; AI viết theo từng nhóm ô. Duyệt nội dung trên sơ đồ, kiểm tra QA, rồi tạo game trực tiếp.</p>
      <div className="flex flex-wrap items-center gap-2"><select aria-label="Loại sơ đồ mẫu" className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(WORKSHOP_TYPES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select><Button variant="outline" onClick={() => setResetKind('template')}>Dùng sơ đồ mẫu</Button><Button variant="outline" onClick={() => setResetKind('blank')}>Làm mới từ ô lời dẫn</Button>{!workspace && <Button onClick={() => updateContext({ type: gameData.meta.archetype === 'romance' ? 'npc' : ['palace', 'rebirth'].includes(gameData.meta.archetype) ? gameData.meta.archetype : type === 'system' ? 'system' : 'studio', idea: '', bible: '', setupApproved: false })}>Tiếp tục từ sơ đồ hiện có</Button>}</div>
      <p className="text-xs text-muted-foreground">Mẫu: 5 cảnh xương sống, mỗi cảnh 4 lựa chọn cùng về cảnh kế → cảnh 6 tách 4 nhánh → 4 kết thúc. Chọn loại xưởng rồi bấm Dùng sơ đồ mẫu để áp dụng.</p>
      {workspace && <p className="text-xs">Đang viết theo: <strong>{WORKSHOP_TYPES[workspace.type]?.label}</strong></p>}
    </div>
    {workspace && <>
      <div ref={contextPanel} tabIndex={-1} className="rounded-2xl border-2 border-cyan-400/50 bg-cyan-500/5 p-4 space-y-3">
        <h3 className="font-semibold">Ô ý tưởng · Bối cảnh chung</h3>
        {!workspace.setupApproved && <p className="rounded-lg border border-amber-400 bg-amber-500/10 p-3 text-sm"><strong>Chưa sẵn sàng viết cảnh.</strong> Sau khi nhập ý tưởng, bấm “AI đề xuất bối cảnh và bộ điểm”, xem kết quả rồi bấm “Áp dụng bản đã duyệt”. Nhập API key chưa hoàn tất bước này.</p>}
        <Textarea aria-label="Ý tưởng và bối cảnh game" rows={4} value={workspace.idea || ''} onChange={(e) => updateContext({ idea: e.target.value })} placeholder="Ví dụ: Nữ chính trọng sinh về năm 1995, dùng kiến thức tương lai để gây dựng sự nghiệp. Giọng văn… Nhân vật… Mục tiêu…" />
        <div className="flex gap-2 flex-wrap"><Button onClick={() => ask('setup')}>{workspace.setupApproved ? 'AI cập nhật bối cảnh và bộ điểm' : 'AI đề xuất bối cảnh và bộ điểm'}</Button><Button variant="outline" onClick={() => ask('write', ['scene:start_node'])}>AI viết lời dẫn</Button></div>
        <p className="text-xs text-muted-foreground">Dùng Cài đặt AI hiện có. Mỗi lần viết gửi toàn bộ sơ đồ, bối cảnh và nội dung đã duyệt; nhiều ô được chia nhóm 4. AI không tự đổi đường nối.</p>
        {workspace.setupApproved && <details><summary className="cursor-pointer text-sm">Bối cảnh đã duyệt và bộ điểm ({gameData.meta.statsConfig?.length || 0})</summary><Textarea className="mt-2" rows={8} aria-label="Bối cảnh đã duyệt" value={workspace.bible || ''} onChange={(e) => updateContext({ bible: e.target.value })} /><p className="text-sm mt-2">{gameData.meta.statsConfig?.map((s) => `${s.label}: ${gameData.meta.initialStats?.[s.key] ?? s.default}${s.isVital ? ` (thua khi ≤ ${s.deathThreshold})` : ''}`).join(' · ')}</p></details>}
      </div>
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h3 className="font-semibold">Thiết kế ngay trên từng ô</h3><p className="text-sm text-muted-foreground">Bấm Thêm trên ô để tạo cảnh, chèn hệ quả hoặc nối nhánh. Muốn gom nhiều đáp án vào một cảnh, tại cảnh đích chọn Thêm → Nối nhiều đáp án vào ô này.</p><details><summary className="text-xs cursor-pointer">Công cụ thêm hàng loạt (nâng cao)</summary>
        <div className="flex flex-wrap items-end gap-3"><label className="text-xs">Số ô<Input aria-label="Số ô thêm" className="w-20" type="number" min={1} max={30} value={count} onChange={(e) => setCount(Number(e.target.value))} /></label><label className="text-xs">Lựa chọn / cảnh<Input aria-label="Số lựa chọn mỗi cảnh" className="w-24" type="number" min={0} max={12} disabled={ending} value={choiceCount} onChange={(e) => setChoiceCount(Number(e.target.value))} /></label><label className="text-xs">Nối thêm từ<select aria-label="Nối thêm từ cảnh" className={`${selectClass} block max-w-64`} value={afterId} onChange={(e) => setAfterId(e.target.value)}><option value="">Đặt riêng, tự nối sau</option>{Object.entries(gameData.nodes).filter(([, n]) => !n.isEnding).map(([id, n]) => <option key={id} value={id}>{caption(id, n)}</option>)}</select></label><label className="text-sm flex gap-2 items-center pb-2"><input type="checkbox" checked={ending} onChange={(e) => setEnding(e.target.checked)} />Ô kết thúc</label><Button onClick={() => {
          try { const result = addSceneChain(gameData, afterId, ending ? 1 : count, choiceCount, ending); change(result.game); setKeys([]); setStructureId(result.firstId); setError(''); } catch (e) { setError(e.message); }
        }}>+ Thêm {ending ? 'kết thúc' : 'chuỗi cảnh'}</Button></div>
        <p className="text-xs text-muted-foreground">Chuỗi mới cùng đi tới cảnh kế; cảnh cuối để trống đích cho bạn nối. “Nối thêm từ” thêm một lựa chọn ở cảnh nguồn, giữ nguyên các lựa chọn cũ. Bấm “Thiết kế” trên ô để thêm, xóa lựa chọn hoặc đổi đích.</p></details>
        <div className="flex gap-2 flex-wrap"><Button size="sm" variant="outline" onClick={() => setKeys(Object.keys(gameData.nodes).map((id) => `scene:${id}`))}>Chọn tất cả cảnh</Button><Button size="sm" variant="outline" onClick={() => setKeys(Object.entries(gameData.nodes).filter(([, n]) => !n.text?.trim()).map(([id]) => `scene:${id}`))}>Chọn cảnh chưa viết</Button><Button size="sm" variant="outline" onClick={() => setKeys([])}>Bỏ chọn</Button><Button size="sm" variant="outline" disabled={!undo} onClick={() => { setGameData(undo); setUndo(null); setKeys([]); }}>Hoàn tác thao tác gần nhất</Button></div>
        <Textarea aria-label="Yêu cầu viết nhóm ô" rows={2} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Yêu cầu cho lượt viết này: nhịp chậm, chưa tiết lộ thân phận, lựa chọn B tăng uy tín…" />
        <Button disabled={!scopes.length} onClick={() => ask('write')}>AI viết {scopes.length} ô đã chọn</Button><p className="text-xs text-muted-foreground">Chọn ô cảnh sẽ viết cả nội dung và các lựa chọn của cảnh. Chọn riêng ô lựa chọn chỉ viết lựa chọn đó. Các ô đã có nội dung chỉ bị thay khi bạn duyệt.</p>
        {!!scopes.length && <details><summary className="text-xs cursor-pointer">Xem phạm vi đã chọn</summary><p className="text-xs mt-1">{scopes.map((s) => `${s.id}${s.choiceIndex !== null ? ` / lựa chọn ${s.choiceIndex + 1}` : ' (cả cảnh)'}`).join(' · ')}</p></details>}
      </div>
      {!!unfinished.length && <details className="rounded-lg border border-amber-400 p-3 text-sm"><summary className="cursor-pointer">Còn {unfinished.length} ô chưa có nội dung — cần viết trước khi tạo game</summary><ul className="max-h-40 overflow-auto list-disc pl-5">{unfinished.map((v) => <li key={v}>{v}</li>)}</ul></details>}
      <MindMapTab gameData={gameData} setGameData={change} onGenerated={onGenerated} authoring={{ copy: (id) => copyScenes([id]), paste: copiedPattern ? () => setPasteOpen(true) : null, remove: removeCard, focus: mapFocus, connect: setConnectRequest, toolbar: <div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{scopes.length} ô đã chọn</strong><Button size="sm" disabled={!scopes.length} onClick={() => ask('write')}>AI viết các ô đã chọn</Button><Button size="sm" variant="outline" onClick={() => setKeys(Object.keys(gameData.nodes).map((id) => `scene:${id}`))}>Chọn tất cả cảnh</Button><Button size="sm" variant="outline" onClick={() => setKeys([])}>Bỏ chọn</Button><Button size="sm" variant="outline" disabled={!undo} onClick={() => { setGameData(undo); setUndo(null); setKeys([]); }}>Hoàn tác</Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline">Sao chép / Dán</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem disabled={!scopes.length} onSelect={() => copyScenes()}>Sao chép nhóm đã chọn</DropdownMenuItem><DropdownMenuItem disabled={!copiedPattern} onSelect={() => setPasteOpen(true)}>Dán nhóm đã sao chép</DropdownMenuItem></DropdownMenuContent></DropdownMenu><span className="text-xs text-muted-foreground">AI đọc bối cảnh và toàn bộ sơ đồ; không đổi đường nối.</span></div>, keys, toggle: (key) => setKeys((prev) => prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]), write: (key) => ask('write', [key]), structure: setStructureId }} />
    </>}
    {aiFailure && <Dialog open onOpenChange={(open) => !open && setAiFailure('')}><DialogContent onCloseAutoFocus={(event) => event.preventDefault()}><DialogHeader><DialogTitle>Chưa thể viết bằng AI</DialogTitle></DialogHeader><p role="alert" className="text-sm whitespace-pre-wrap">{aiFailure}</p>{(!workspace?.idea?.trim() || !workspace?.setupApproved) && <Button onClick={() => { setAiFailure(''); contextPanel.current?.scrollIntoView({ block: 'center' }); contextPanel.current?.focus({ preventScroll: true }); }}>Đến bước bối cảnh và bộ điểm</Button>}<Button variant="outline" onClick={() => setAiFailure('')}>Đóng</Button></DialogContent></Dialog>}
    {busy && <p role="status" className="sticky bottom-4 rounded-xl bg-primary p-4 text-primary-foreground shadow-lg">{busy} Chưa thay đổi game; vui lòng giữ tab này mở.</p>}
    {error && !proposal && <p role="alert" className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>}
    {copyNotice && <p role="status" className="sticky bottom-2 rounded-lg border bg-background p-3 text-sm shadow">{copyNotice}<button className="ml-3 underline text-primary" onClick={() => setCopyNotice('')}>Đóng</button></p>}
    {pasteOpen && copiedPattern && <PastePatternDialog pattern={copiedPattern} gameData={gameData} onClose={() => setPasteOpen(false)} onApply={({ game, addedIds, firstId }) => { change(game); setKeys(addedIds.map((id) => `scene:${id}`)); setMapFocus({ id: firstId, token: Date.now() }); setCopyNotice(`Đã dán ${addedIds.length} cảnh. Các cảnh mới đang được chọn để bạn yêu cầu AI viết.`); }} />}
    {connectRequest && gameData.nodes[connectRequest.sourceId] && <MapConnectDialog gameData={gameData} request={connectRequest} onClose={() => setConnectRequest(null)} onApply={({ game, targetId }) => { change(game); setMapFocus({ id: targetId, token: Date.now() }); }} />}
    {structureId && gameData.nodes[structureId] && <StructureEditor key={structureId} id={structureId} gameData={gameData} onChange={(data) => { change(data); setKeys([]); }} onClose={() => setStructureId(null)} />}
    {proposal && <Proposal proposal={proposal} setProposal={setProposal} gameData={gameData} onApply={approve} onClose={() => { setProposal(null); setError(''); }} error={error} />}
    {resetKind && <Dialog open onOpenChange={(open) => !open && setResetKind(null)}><DialogContent><DialogHeader><DialogTitle>Thay sơ đồ hiện tại?</DialogTitle></DialogHeader><p className="text-sm">Thao tác này thay toàn bộ cảnh và bộ điểm bằng {resetKind === 'blank' ? 'một ô lời dẫn trống' : `mẫu ${WORKSHOP_TYPES[type].label}`}. Game sẽ tự lưu. Bạn có thể hoàn tác ngay trong xưởng, nhưng không có lịch sử sau khi tải lại trang.</p><div className="flex gap-2"><Button onClick={() => initialize(resetKind === 'blank')}>Thay sơ đồ</Button><Button variant="outline" onClick={() => setResetKind(null)}>Giữ sơ đồ hiện tại</Button></div></DialogContent></Dialog>}
  </fieldset>;
}
