import React,{useMemo,useRef,useState,useEffect} from 'react';
import {Button} from '@/components/ui/button';
import {aiCall} from '@/lib/aiCall';
import {inspectScriptImport,applyScriptImport,IMPORT_REPAIR_SCHEMA,importRepairPrompt,applyImportRepairs} from '@/lib/gameStudio/scriptImport';

const cls='block w-full border rounded p-2 bg-background';
export default function ScriptImportPanel({game,onApply,onClose,Preview,onBusyChange}){
 const [text,setText]=useState(''),[report,setReport]=useState(null),[stamp,setStamp]=useState('');
 const [source,setSource]=useState(()=>game.nodes.start_node&&!game.nodes.start_node.choices?.length?'start_node':'');
 const [budget,setBudget]=useState(1),[calls,setCalls]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[repair,setRepair]=useState(null);
 const latest=useRef(game),mounted=useRef(true);latest.current=game;
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
 const result=useMemo(()=>{
  if(!report||report.issues.length)return null;
  try{return {value:applyScriptImport(game,report,source)};}catch(e){return {error:e.message};}
 },[game,report,source]);
 const changeText=value=>{setText(value);setReport(null);setRepair(null);setError('');setCalls(0);};
 function inspect(){setError('');setRepair(null);setCalls(0);setStamp(JSON.stringify(game));setReport(inspectScriptImport(game,text));}
 async function repairRules(){
  if(!report||busy)return;
  setError('');setCalls(0);setRepair(null);
  const original=latest.current,fingerprint=JSON.stringify(original);let used=0;
  try{
   if(fingerprint!==stamp)throw new Error('Game đã đổi; hãy kiểm tra lại kịch bản trước khi gọi AI.');
   const prompt=importRepairPrompt(report);
   setBusy(true);onBusyChange(true);
   const response=await aiCall(prompt,{jsonSchema:IMPORT_REPAIR_SCHEMA,useCache:false,maxAttempts:budget,onRequest:()=>{
    if(!mounted.current||used>=budget)throw new Error('Đã dừng theo ngân sách.');
    used++;setCalls(used);
   }});
   if(!mounted.current)return;
   if(JSON.stringify(latest.current)!==fingerprint)throw new Error('Game đã đổi trong lúc AI xử lý; hãy kiểm tra lại.');
   const candidate=applyImportRepairs(report,response),inspection=inspectScriptImport(original,candidate);
   setRepair({...response,changes:response.patches.map(p=>({...p,before:report.lines[p.line-1]})),candidate});setReport(inspection);
  }catch(e){if(mounted.current)setError(e.message);}finally{if(mounted.current){setBusy(false);onBusyChange(false);}}
 }
 return <div className="space-y-3">
  <p className="text-sm">Giữ lời truyện trên máy. Nhận diện CẢNH / PHÂN CẢNH / SCENE, đáp án A —, → điểm/đích và KẾT THÚC mã [TRUE_END]. Kịch bản rõ luật được dựng với <strong>0 lượt AI</strong>. Không tự đoán đích, bỏ cảnh hoặc thay cơ chế lạ. Thông báo hệ thống trong lời kể được giữ thành văn bản, không dựng popup riêng.</p>
  <fieldset disabled={busy} className="space-y-3">
   <label className="block text-sm">Mở tệp .txt / .md<input aria-label="Mở tệp kịch bản" className={cls} type="file" accept=".txt,.md,text/plain,text/markdown" onChange={async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{if(file.size>1500000)throw new Error('Tệp quá lớn (tối đa 1,5 MB).');const value=await file.text();if(mounted.current)changeText(value);}catch(err){setError(err.message);}
   }}/></label>
   <label className="block text-sm">Kịch bản gốc<textarea aria-label="Kịch bản nhập tiết kiệm" rows={10} className={cls} value={text} onChange={e=>changeText(e.target.value)} placeholder="Dán toàn bộ kịch bản, gồm điểm khởi đầu, lời dẫn, các cảnh và điều kiện kết thúc…"/></label>
   <label className="block text-sm">Nối từ ô chưa có đáp án<select className={cls} aria-label="Nguồn nối kịch bản nhập" value={source} onChange={e=>setSource(e.target.value)}><option value="">Đặt riêng — tôi nối sau</option>{Object.entries(game.nodes).filter(([,n])=>!n.isEnding&&!n.automaticEnding&&!n.combat&&!n.choices?.length).map(([id,n])=><option key={id} value={id}>{n.workshopTitle||id}</option>)}</select></label>
   <Button disabled={!text.trim()} onClick={inspect}>Kiểm tra & dựng trên máy · 0 lượt AI</Button>
   {report&&<>
    <p className="text-sm">{report.plan.summary}</p>
    {!!report.notes.length&&<details><summary>Ghi chú nhập / mốc cần duyệt ({report.notes.length})</summary>{report.notes.map((note,i)=><p key={i} className="text-xs whitespace-pre-wrap">Dòng {note.line}: {note.text}</p>)}</details>}
    {!!report.issues.length&&<div role="alert" className="border border-amber-400 rounded p-3 space-y-2"><p>Chưa thể áp dụng. Hãy sửa đúng phần sau rồi kiểm tra lại:</p><ul className="list-disc pl-5 max-h-60 overflow-auto">{report.issues.map((item,i)=><li key={i} className="text-sm">{item.line?`Dòng ${item.line}: `:''}{item.message}</li>)}</ul></div>}
    {!!report.issues.some(i=>i.repairable)&&!repair&&<div className="flex items-center flex-wrap gap-2"><select className={cls+' !w-auto'} aria-label="Ngân sách sửa luật nhập" value={budget} onChange={e=>setBudget(Number(e.target.value))}><option value={1}>Tối đa 1 lượt AI</option><option value={2}>Tối đa 2 lượt AI (kể cả thử lại JSON)</option></select><Button variant="outline" onClick={repairRules}>Nhờ AI làm rõ riêng các dòng luật</Button><p className="text-xs">Chỉ gửi danh sách cảnh, điểm và các dòng lỗi; không gửi toàn bộ lời truyện. Không cam kết sửa được luật mâu thuẫn.</p></div>}
   </>}
  </fieldset>
  {(busy||calls>0)&&<p role="status" className="text-sm">{busy?'AI đang xử lý · ':''}Đã gọi {calls}/{budget} lượt. Game chưa thay đổi.</p>}
  {error&&<p role="alert" className="text-red-600 text-sm">{error}</p>}
  {repair&&<div className="border rounded p-3 space-y-2"><h3 className="font-semibold">Bản sửa luật — chưa áp dụng</h3><p>{repair.summary}</p>{repair.changes.map(p=><div key={p.line} className="text-sm"><p>Dòng {p.line}</p><pre className="whitespace-pre-wrap text-red-700">{p.before}</pre><pre className="whitespace-pre-wrap text-green-700">{p.replacement}</pre></div>)}{repair.questions.map((q,i)=><p role="alert" key={i} className="text-amber-700">Cần bạn làm rõ: {q}</p>)}<Button variant="outline" onClick={()=>changeText(repair.candidate)}>Đưa bản sửa vào ô văn bản để chỉnh tiếp</Button></div>}
  {result?.error&&<p role="alert" className="text-red-600">{result.error}</p>}
  {result?.value&&<p className="text-sm text-amber-700">Bộ điểm dưới đây cập nhật toàn game, có thể ảnh hưởng các cảnh cũ. Không xóa các nhánh hiện tại; nên nhập toàn bộ kịch bản vào game mới nếu không muốn thêm một bản sao. Nếu nối từ ô dẫn truyện còn trống, lời dẫn trong tệp sẽ điền vào ô đó.</p>}
  {result?.value&&<div className="border rounded p-3 space-y-3"><h3 className="font-semibold">Xem trước — chưa nhập vào game</h3><Preview result={result.value}/><details><summary>Kiểm tra nội dung và luật trước khi nhập</summary><div className="max-h-80 overflow-auto">{report.plan.nodes.map(n=><details key={n.id} className="border rounded p-2"><summary>{n.title} · {n.role}</summary><p className="text-sm whitespace-pre-wrap">{n.text}</p>{n.choices.map((c,i)=><div key={i} className="text-xs border-t py-2"><p className="whitespace-pre-wrap">{c.text} → {report.plan.nodes.find(node=>node.id===c.target)?.title||c.target}</p><pre className="whitespace-pre-wrap">{JSON.stringify({min:c.min,max:c.max,điểm:c.modifiers,cầnCờ:c.requiresFlag,chưaCóCờ:c.requiresFlagAbsent,cầnVậtPhẩm:c.requiresItem,nhậnCờ:c.grantFlag,nhậnVậtPhẩm:c.grantItem},null,2)}</pre></div>)}</details>)}</div></details><p className="text-sm">{report.plan.stats.map(s=>`${s.label}: ${s.initial}${s.isVital?` (thua khi ≤ ${s.deathThreshold})`:' (không sinh tồn)'}`).join(' · ')}</p><Button disabled={busy||!!repair?.questions?.length||stamp!==JSON.stringify(game)} onClick={()=>{
   if(stamp!==JSON.stringify(latest.current)){setError('Game đã đổi. Hãy kiểm tra lại trước khi nhập.');return;}
   onApply(result.value);onClose();
  }}>Áp dụng kịch bản đã duyệt</Button></div>}
 </div>;
}
