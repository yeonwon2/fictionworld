import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ENDING_LABELS, endingEntries, hasGate, saveOutcomeGate, saveOutcomeMode, outcomeWarnings } from '@/lib/gameStudio/outcomeControls';
import { addSceneChain } from '@/lib/gameStudio/aiMindMap';
import { sceneLabel } from '@/lib/gameStudio/mindMap';
const inputClass = 'border rounded bg-background p-2 w-full';

function ModeDialog({ game, onSave, onClose }) {
  const [snapshot] = useState(() => JSON.stringify(game.meta));
  const [mode,setMode] = useState(game.meta.outcomeMode || ((game.meta.statsConfig || []).some(s=>s.isVital) ? 'survival':'accumulation'));
  const [stats,setStats] = useState(()=>structuredClone(game.meta.statsConfig || []));
  const [title,setTitle] = useState(game.meta.gameOverTitle || 'Lượt chơi kết thúc');
  const [text,setText] = useState(game.meta.gameOverText || 'Bạn chưa đạt được mục tiêu trong lượt chơi này. Hãy thử một hướng đi khác.');
  const [error,setError] = useState('');
  return <Dialog open onOpenChange={v=>!v&&onClose()}><DialogContent className="max-w-xl max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>Chế độ điểm và thông báo thua</DialogTitle></DialogHeader>
    <label>Chế độ điểm<select className={inputClass} value={mode} onChange={e=>setMode(e.target.value)}><option value="accumulation">Chỉ tích lũy điểm — không tự thua vì điểm thấp</option><option value="survival">Có chỉ số sinh tồn — chạm ngưỡng dưới sẽ thua</option></select></label>
    {mode==='accumulation' ? <p className="text-sm">Tắt sinh tồn cho toàn bộ chỉ số. HE/BE được quyết định bằng đường đi và điều kiện trên đáp án vào kết thúc. Tai tiếng cao không tự kết thúc game: cần một nhánh BE tại cảnh chốt bạn thiết kế. Chiến đấu, nếu có, vẫn giữ luật thua trận.</p> : <div className="space-y-2">{stats.map((s,i)=><div key={s.key} className="border rounded p-2"><label className="flex gap-2"><input type="checkbox" checked={!!s.isVital} onChange={e=>setStats(stats.map((v,j)=>j===i?{...v,isVital:e.target.checked}:v))}/>{s.label || s.key}: dùng ngưỡng thua</label>{s.isVital&&<label className="text-sm">Thua khi điểm ≤<input type="number" className={inputClass} value={s.deathThreshold??0} onChange={e=>setStats(stats.map((v,j)=>j===i?{...v,deathThreshold:e.target.value===''?NaN:Number(e.target.value)}:v))}/></label>}</div>)}</div>}
    <details><summary className="cursor-pointer text-sm">Lời báo khi thua do ngưỡng điểm hoặc thua trận</summary><p className="text-xs my-2">Nội dung BE nằm ở chính ô kết thúc BE, không dùng lời báo này.</p><label>Tiêu đề<input className={inputClass} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Nội dung<textarea className={inputClass} value={text} onChange={e=>setText(e.target.value)}/></label></details>
    {error&&<p role="alert" className="text-red-600 text-sm">{error}</p>}<Button onClick={()=>{try{if(snapshot!==JSON.stringify(game.meta))throw new Error('Bộ điểm đã thay đổi, hãy mở lại cửa sổ.');onSave(saveOutcomeMode(game,mode,stats,title,text));onClose();}catch(e){setError(e.message);}}}>Lưu chế độ và thông báo</Button>
  </DialogContent></Dialog>;
}
export function OutcomeGateDialog({ game, sourceId, index, onSave, onClose }) {
  const source=game.nodes[sourceId], choice=source.choices[index];
  const [snapshot]=useState(()=>JSON.stringify(choice));
  const [gate,setGate]=useState(()=>structuredClone(choice));
  const [error,setError]=useState('');
  const setBound=(field,key,value)=>setGate(prev=>{const bounds={...prev[field]};if(value==='')delete bounds[key];else bounds[key]=Number(value);return {...prev,[field]:bounds};});
  return <Dialog open onOpenChange={v=>!v&&onClose()}><DialogContent className="max-w-2xl max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>Điều kiện mở đáp án</DialogTitle><DialogDescription>{sceneLabel(sourceId,source)} · {choice.text || `Đáp án ${index+1}`}. Tất cả điều kiện phải đồng thời đúng, xét trước khi cộng/trừ điểm của đáp án này.</DialogDescription></DialogHeader>
    <p className="text-sm">Để trống nghĩa là không giới hạn. Không đủ điều kiện chỉ khóa đáp án, không tự kết thúc lượt chơi.</p>
    <table className="w-full text-sm"><thead><tr><th className="text-left">Chỉ số</th><th>Tối thiểu ≥</th><th>Tối đa ≤</th></tr></thead><tbody>{(game.meta.statsConfig||[]).map(s=><tr key={s.key}><td>{s.label||s.key}</td><td><input aria-label={`${s.label||s.key} tối thiểu`} type="number" className={inputClass} value={gate.statRequirements?.[s.key]??''} onChange={e=>setBound('statRequirements',s.key,e.target.value)}/></td><td><input aria-label={`${s.label||s.key} tối đa`} type="number" className={inputClass} value={gate.statRequirementsMax?.[s.key]??''} onChange={e=>setBound('statRequirementsMax',s.key,e.target.value)}/></td></tr>)}</tbody></table>
    {['statRequirements','statRequirementsMax'].flatMap(field=>Object.keys(gate[field]||{}).filter(key=>!(game.meta.statsConfig||[]).some(s=>s.key===key)).map(key=><p key={`${field}:${key}`} className="text-sm text-red-600">Chỉ số không tồn tại: {key} <button className="underline" onClick={()=>setBound(field,key,'')}>Bỏ điều kiện này</button></p>))}
    <details open={!!(gate.requiresFlag||gate.requiresFlagAbsent||gate.requiresItem)}><summary className="cursor-pointer text-sm">Sự kiện đã xảy ra / chưa xảy ra và vật phẩm</summary>{[['requiresFlag','Bắt buộc đã có cờ sự kiện'],['requiresFlagAbsent','Bắt buộc chưa có cờ sự kiện'],['requiresItem','Bắt buộc có vật phẩm']].map(([key,label])=><label key={key} className="block text-sm mt-2">{label}<input className={inputClass} value={gate[key]||''} onChange={e=>setGate({...gate,[key]:e.target.value})}/></label>)}<p className="text-xs mt-2">Dùng đúng mã cờ/vật phẩm được cấp ở các đáp án trước đó. QA kiểm tra nguồn cấp và khả năng đi tới.</p></details>
    {(choice.requiresNpcAffinity||choice.requiresNpcAffinityMax)&&<p className="text-xs">Đáp án còn có điều kiện hảo cảm NPC; phần này giữ nguyên, có thể sửa qua nút Sửa trên ô đáp án.</p>}
    {error&&<p role="alert" className="text-red-600 text-sm">{error}</p>}<Button onClick={()=>{try{if(snapshot!==JSON.stringify(game.nodes[sourceId]?.choices?.[index]))throw new Error('Đáp án đã thay đổi, hãy mở lại cửa sổ.');onSave(saveOutcomeGate(game,sourceId,index,gate));onClose();}catch(e){setError(e.message);}}}>Lưu điều kiện</Button>
  </DialogContent></Dialog>;
}
function EndingDialog({game,id,onSave,onClose}) {
  const node=id?game.nodes[id]:null;
  const [snapshot]=useState(()=>JSON.stringify(node));
  const [title,setTitle]=useState(node?.workshopTitle||'');
  const [text,setText]=useState(node?.text||'');
  const [type,setType]=useState(node?.endingType||'GOOD_END');
  const [error,setError]=useState('');
  return <Dialog open onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>{id?'Sửa kết thúc':'Thêm một kết thúc'}</DialogTitle></DialogHeader><label>Loại kết thúc<select className={inputClass} value={type} onChange={e=>setType(e.target.value)}>{Object.entries(ENDING_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Tên kết thúc<input className={inputClass} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Lời kết hiển thị trong game<textarea className={inputClass} rows={5} value={text} onChange={e=>setText(e.target.value)} placeholder="Có thể để trống rồi chọn ô để AI viết sau"/></label><p className="text-xs">Kết thúc mới được đặt riêng, không tự nối hoặc tạo cảnh khác. Tại ô kết thúc, dùng Thêm → Nối nhiều đáp án vào ô này để chọn đường vào.</p>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<Button onClick={()=>{try{if(id&&snapshot!==JSON.stringify(game.nodes[id]))throw new Error('Kết thúc đã thay đổi, hãy mở lại.');const added=id?{game:structuredClone(game),firstId:id}:addSceneChain(game,'',1,0,true);Object.assign(added.game.nodes[added.firstId],{workshopTitle:title.trim()||ENDING_LABELS[type],endingType:type,text});added.game.meta.sourceScriptOutdated=!!added.game.meta.sourceScript;onSave(added.game,added.firstId);onClose();}catch(e){setError(e.message);}}}>Lưu kết thúc</Button></DialogContent></Dialog>;
}
export default function OutcomeControls({game,onChange,onFocus}) {
  const [modeOpen,setModeOpen]=useState(false),[gate,setGate]=useState(null),[ending,setEnding]=useState(null);
  const endings=Object.entries(game.nodes).filter(([,node])=>node.isEnding);
  const warnings=outcomeWarnings(game);
  return <details className="rounded-2xl border-2 border-emerald-500/40 p-4"><summary className="cursor-pointer font-semibold">Điểm số, HE/BE và điều kiện kết thúc · {endings.length} kết thúc</summary><div className="space-y-3 mt-3"><p className="text-sm">{game.meta.outcomeMode==='accumulation'?'Chỉ tích lũy điểm; không tự thua vì điểm thấp.':game.meta.outcomeMode==='survival'?'Đang cho phép ngưỡng thua sớm.':'Chưa chốt chế độ điểm; đang dùng cấu hình chỉ số hiện có.'} HE/BE phụ thuộc các đường đi bạn nối, không chỉ nhãn của ô kết thúc.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setModeOpen(true)}>Chế độ điểm & lời báo thua</Button><Button variant="outline" onClick={()=>setEnding('new')}>Thêm kết thúc HE/BE/NE</Button></div>
    <p className="text-xs text-muted-foreground">Ví dụ minh họa: HE cần Thiện cảm ≥ 70, Tin tưởng ≥ 60, Tai tiếng ≤ 20. BE do tai tiếng cần Tai tiếng ≥ 21. Đây không phải ngưỡng mặc định. Nếu muốn luôn có đường đi tiếp, thiết kế thêm NE hoặc đường tiếp tục phù hợp; QA kiểm tra trường hợp không đạt nhánh nào. Nhiều nhánh cùng đủ điều kiện thì người chơi được chọn, không tự ưu tiên HE.</p>
    {endings.map(([id,node])=><div key={id} className="rounded-lg border p-3 space-y-2"><div className="flex flex-wrap gap-2 items-center"><strong className="text-sm">{node.workshopTitle||id} · {ENDING_LABELS[node.endingType]||node.endingType}</strong><button className="text-sm underline text-primary" onClick={()=>onFocus(id)}>Xem ô</button><button className="text-sm underline text-primary" onClick={()=>setEnding(id)}>Sửa lời kết</button></div>{!node.text?.trim()&&<p className="text-xs text-amber-700">Chưa có lời kết hiển thị cho người chơi.</p>}{endingEntries(game,id).map((entry,i)=><div key={`${entry.sourceId}:${entry.index}:${i}`} className="flex flex-wrap gap-2 items-center text-sm"><span>{sceneLabel(entry.sourceId,game.nodes[entry.sourceId])} → {entry.choice?.text||`Đáp án ${(entry.index??0)+1}`}</span>{entry.special?<span className="text-xs">Do xúc xắc/chiến đấu quyết định — sửa ở ô nguồn</span>:<button className="underline text-primary" onClick={()=>setGate(entry)}>{hasGate(entry.choice)?'Xem / sửa điều kiện':'Đặt điều kiện vào kết thúc'}</button>}</div>)}</div>)}
    {!!warnings.length&&<details><summary className="text-sm cursor-pointer text-amber-700">Cần rà soát {warnings.length} điểm</summary><ul className="list-disc pl-5 text-sm space-y-1 mt-2">{warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>}<p className="text-xs text-muted-foreground">Điều kiện lưu trực tiếp vào đáp án, dùng chung cho game thật, QA và chơi thử tuyến. Sau khi đổi đường nối, cần rà soát điều kiện của đường mới. AI đọc các luật đã lưu khi viết nội dung, không tự thay luật.</p></div>
    {modeOpen&&<ModeDialog game={game} onSave={onChange} onClose={()=>setModeOpen(false)}/>}
    {gate&&game.nodes[gate.sourceId]?.choices?.[gate.index]&&<OutcomeGateDialog game={game} sourceId={gate.sourceId} index={gate.index} onSave={onChange} onClose={()=>setGate(null)}/>}
    {ending&&<EndingDialog game={game} id={ending==='new'?null:ending} onSave={(next,id)=>{onChange(next);onFocus(id);}} onClose={()=>setEnding(null)}/>}
  </details>;
}
