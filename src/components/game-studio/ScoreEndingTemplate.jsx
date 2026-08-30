import React,{useState,useMemo} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {createScoreEndingRules,scoreEndingRanges,ENDING_LABELS} from '@/lib/gameStudio/outcomeControls';
import GamePlayer from './player/GamePlayer';
const control='w-full border rounded bg-background p-2';
const defaults=[{id:1,title:'BE · Kết thúc xấu',type:'BAD_END',min:null},{id:2,title:'NE · Bình thường',type:'NORMAL_END',min:20},{id:3,title:'HE · Kết thúc tốt',type:'GOOD_END',min:80}];
export default function ScoreEndingTemplate({game,onApply,onClose}) {
 const stats=game.meta.statsConfig||[];
 const [key,setKey]=useState(stats[0]?.key||''),[rules,setRules]=useState(defaults);
 const [score,setScore]=useState(90),[playing,setPlaying]=useState(false),[revision,setRevision]=useState(0),[error,setError]=useState('');
 const label=stats.find(s=>s.key===key)?.label||key;
 let ranges=[],validation='';
 try {ranges=scoreEndingRanges(rules);} catch(e){validation=e.message;}
 const valid=!!key&&!validation;
 const demo=useMemo(()=>{
  if(!valid)return null;
  const sample={meta:{title:'Thử xét kết thúc',theme:game.meta.theme,presentation:game.meta.presentation,statsConfig:[{key,label,default:score,isVital:false}],initialStats:{[key]:score}},nodes:{}};
  const built=createScoreEndingRules(sample,key,rules);
  built.game.nodes.start_node={...built.game.nodes[built.checkpoint],id:'start_node'};
  delete built.game.nodes[built.checkpoint];return built.game;
 },[key,label,rules,score,valid,game.meta.theme,game.meta.presentation]);
 const reset=()=>{setPlaying(false);setError('');};
 const patch=(id,values)=>{setRules(prev=>prev.map(r=>r.id===id?{...r,...values}:r));reset();};
 const rangeText=r=>r.min===null?(r.max===null?'Mọi mức điểm':`≤ ${r.max}`):r.max===null?`≥ ${r.min}`:`${r.min}–${r.max}`;
 return <Dialog open onOpenChange={v=>!v&&onClose()}><DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto"><DialogHeader><DialogTitle>Thiết kế các kết thúc theo điểm</DialogTitle><DialogDescription>Tự thêm/xóa nhánh và đặt tên riêng. HE, BE, NE, TE là loại hiển thị, không giới hạn số kết thúc; có thể tạo nhiều nhánh cùng loại.</DialogDescription></DialogHeader>
 <label className="text-sm">Chỉ số dùng xét kết thúc<select className={control} value={key} onChange={e=>{setKey(e.target.value);reset();}}>{!stats.length&&<option value="">Chưa có bộ điểm</option>}{stats.map(s=><option key={s.key} value={s.key}>{s.label||s.key}</option>)}</select></label>
 <div className="space-y-3">{rules.map((r,i)=><div key={r.id} className="border rounded-lg p-3 grid gap-2 sm:grid-cols-3"><label className="text-sm">Tên kết thúc {i+1}<input className={control} value={r.title} onChange={e=>patch(r.id,{title:e.target.value})}/></label><label className="text-sm">Loại hiển thị<select className={control} value={r.type} onChange={e=>patch(r.id,{type:e.target.value})}>{Object.entries(ENDING_LABELS).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><label className="text-sm">{r.min===null?'Phần điểm thấp nhất':'Bắt đầu từ điểm'}{r.min===null?<p className="p-2 text-muted-foreground">Tất cả điểm dưới mốc kế tiếp</p>:<input className={control} type="number" value={r.min} onChange={e=>patch(r.id,{min:e.target.value===''?'':Number(e.target.value)})}/>}</label><button className="text-sm text-red-600 underline justify-self-start disabled:opacity-40" disabled={rules.length===1} onClick={()=>{setRules(prev=>{const remaining=prev.filter(v=>v.id!==r.id);if(r.min===null)remaining[0]={...remaining[0],min:null};return remaining;});reset();}}>Xóa nhánh này</button></div>)}</div>
 <Button variant="outline" onClick={()=>{setRules(prev=>[...prev,{id:Math.max(...prev.map(r=>r.id))+1,title:`Kết thúc ${prev.length+1}`,type:'TRUE_END',min:Math.max(0,...prev.map(r=>typeof r.min==='number'?r.min:0))+20}]);reset();}}>+ Thêm một kết thúc</Button>
 <p className="text-xs text-muted-foreground">Mỗi nhánh nhận điểm từ mốc của mình đến ngay trước mốc tiếp theo. Dùng điểm nguyên; không để trùng mốc. Đây là phân loại theo một chỉ số. Kết thúc bí mật cần thêm cờ/sự kiện có thể sửa điều kiện trên đáp án sau khi tạo.</p>
 {validation&&<p role="alert" className="text-sm text-red-600">{validation}</p>}
 {valid&&<><div className="rounded-lg border p-3 text-sm space-y-1"><strong>Các hệ quả cuối truyện → Xét kết thúc → {ranges.length} nhánh</strong>{ranges.map(r=><p key={r.id}>↳ {label} {rangeText(r)} → {r.title}</p>)}</div>
 <div className="rounded-xl bg-muted/40 border p-3 space-y-2"><strong className="text-sm">Thử từng kết thúc bằng game thật</strong><p className="text-xs">Điểm thử không sửa điểm hay tiến độ của game bạn.</p><div className="flex flex-wrap gap-2">{ranges.map(r=>{const n=r.min??r.max??0;return <Button key={r.id} variant="outline" onClick={()=>{setScore(n);setRevision(v=>v+1);setPlaying(true);}}>Thử {n} điểm → {r.title}</Button>;})}</div>{playing&&demo&&<GamePlayer key={revision} gameData={demo} persistProgress={false} onExit={()=>setPlaying(false)}/>}</div></>}
 {!stats.length&&<p className="text-sm">Hãy tạo và duyệt bộ điểm trước.</p>}
 <p className="text-sm">Tạo riêng 1 cảnh xét điểm và {rules.length} ô kết thúc, không tự nối vào truyện. Sau đó nối hệ quả cuối vào cảnh xét điểm. Lời kết mẫu có thể sửa hoặc để AI viết lại.</p>
 {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex gap-2"><Button disabled={!valid} onClick={()=>{try{onApply(createScoreEndingRules(game,key,rules));onClose();}catch(e){setError(e.message);}}}>Thêm cảnh xét điểm + {rules.length} kết thúc</Button><Button variant="outline" onClick={onClose}>Đóng</Button></div>
 </DialogContent></Dialog>;
}
