import {selectedScopes, orderedWritingKeys, workshopPrompt, WRITE_SCHEMA, applyWriting} from './aiMindMap.js';

const text = {type:'string'};
export const PROSE_SCHEMA = {type:'object',properties:{entries:{type:'array',items:{type:'object',properties:{key:text,text,choices:{type:'array',items:{type:'object',properties:{index:{type:'integer'},text},required:['index','text']}}},required:['key','text','choices']}},suggestions:text},required:['entries','suggestions']};

// Only the two prose fields may change, even if AI or the review form sends mechanics.
export function normalizeProseEntries(game,keys,result) {
 const scopes=selectedScopes(game,keys),seen=new Set();
 if(!scopes.length||!Array.isArray(result?.entries)||result.entries.length!==scopes.length)throw new Error('AI chưa trả đủ các ô lời văn.');
 return result.entries.map(entry=>{
  const scope=scopes.find(s=>s.key===entry?.key);
  if(!scope||seen.has(entry.key))throw new Error('Ô lời văn bị trùng hoặc ngoài phạm vi.');
  seen.add(entry.key);
  if(typeof entry.text!=='string'||scope.choiceIndex===null&&!entry.text.trim())throw new Error(`Thiếu lời văn ${entry.key}.`);
  if(!Array.isArray(entry.choices)||entry.choices.length!==scope.choiceIndexes.length)throw new Error(`Sai số đáp án ${entry.key}.`);
  const node=game.nodes[scope.id],indexes=new Set();
  const choices=entry.choices.map(c=>{
   if(!scope.choiceIndexes.includes(c.index)||indexes.has(c.index)||typeof c.text!=='string'||!c.text.trim())throw new Error(`Đáp án chưa hợp lệ ${entry.key}.`);
   indexes.add(c.index);
   const old=node.choices[c.index];
   return {index:c.index,text:c.text,modifiers:Object.entries(old.statModifiers||{}).map(([key,value])=>({key,value})),npcName:old.npcCard?.name||'',npcTagline:old.npcCard?.tagline||''};
  });
  return {key:entry.key,text:entry.text,speaker:node.speaker||'',systemTitle:'',systemText:'',choices};
 });
}

export function applyProseWriting(game,keys,result){
 const entries=normalizeProseEntries(game,keys,result),next=structuredClone(game);
 for(const entry of entries){
  const scope=selectedScopes(game,[entry.key])[0],node=next.nodes[scope.id];
  if(scope.choiceIndex===null)node.text=entry.text;
  for(const choice of entry.choices)node.choices[choice.index].text=choice.text;
 }
 next.meta.sourceScriptOutdated=!!next.meta.sourceScript;
 return next;
}

// Conservative heuristic, not a tokenizer or a promise of completion.
export function planWritingBudget(game,keys,{maxCalls=2,targetChars=700,proseOnly=true}={}){
 if(![1,2].includes(maxCalls)||!Number.isInteger(targetChars)||targetChars<200||targetChars>6000)throw new Error('Chọn 1–2 lượt và độ dài 200–6000 ký tự/cảnh.');
 const ordered=orderedWritingKeys(game,keys),scopes=selectedScopes(game,ordered),batches=[];
 let batch=[],tokens=0;
 for(const scope of scopes){
  const estimate=200+(scope.choiceIndex===null?Math.ceil(targetChars/1.5):0)+scope.choiceIndexes.length*(proseOnly?180:240);
  if(batch.length&&tokens+estimate>6000){batches.push(batch);batch=[];tokens=0;}
  batch.push(scope.key);tokens+=estimate;
 }
 if(batch.length)batches.push(batch);
 return {keys:ordered,batches,estimatedCalls:batches.length,plannedKeys:batches.slice(0,maxCalls).flat(),remainingKeys:batches.slice(maxCalls).flat(),maxCalls,targetChars,proseOnly};
}

export async function writeBudgetedScopes(game,keys,instruction,requestAI,onProgress=(message)=>void message,isActive=()=>true,options={}){
 const plan=planWritingBudget(game,keys,options),entries=[],suggestions=[];
 let working=game,calls=0,attempts=0,pending=[...plan.keys],issues=[];
 const apply=plan.proseOnly?applyProseWriting:applyWriting;
 // Check full context before spending any requests.
 if(pending.length)workshopPrompt(game,pending,instruction);
 while(pending.length&&attempts<plan.maxCalls){
  if(!isActive())throw new Error('Lượt viết đã dừng.');
  const batch=planWritingBudget(working,pending,options).batches[0];
  const mode=plan.proseOnly?'CHỈ TRAU CHUỐT LỜI VĂN. Quy tắc này thay phần yêu cầu trả điểm/người nói/thông báo hệ thống: chỉ trả key, text, choices[{index,text}]. Không đề xuất thay cơ chế, không đổi sự kiện hoặc kết cục. Không trả modifiers, speaker, systemTitle, systemText, npcName, npcTagline.':'Có thể đề xuất điểm trong schema; không đổi đường nối hay điều kiện.';
  const prompt=workshopPrompt(working,batch,instruction)+`\n${mode}\nĐộ dài mục tiêu khoảng ${plan.targetChars} ký tự/cảnh, giữ ý chính và nhịp truyện. entries phải có đúng ${batch.length} ô, mỗi key một lần: ${JSON.stringify(batch)}. Chỉ viết các ô này. ${issues.length?'Bổ sung/sửa phần thiếu: '+issues.join('; '):''}`;
  attempts++;
  const progress=()=>onProgress(`Lượt xử lý ${attempts}/${plan.maxCalls} · đã gọi ${calls} lần · đang viết ${batch.length} ô · đã nhận ${entries.length}/${plan.keys.length} ô.`);
  progress();let sent=0;
  let response;
  try{response=await requestAI(prompt,{jsonSchema:plan.proseOnly?PROSE_SCHEMA:WRITE_SCHEMA,useCache:false,maxAttempts:1,onRequest:()=>{
   if(!isActive()||sent||calls>=plan.maxCalls)throw new Error('Đã dừng theo ngân sách, không gọi thêm.');
   sent++;calls++;progress();
  }});}
  catch(e){issues=[e.message];break;}
  if(!isActive())throw new Error('Lượt viết đã dừng.');
  const accepted=[];issues=[];
  for(const key of batch){
   const matches=Array.isArray(response?.entries)?response.entries.filter(e=>e?.key===key):[];
   try{
    if(matches.length!==1)throw new Error(`${key}: ${matches.length?'trùng ô':'chưa trả ô'}`);
    const valid=plan.proseOnly?normalizeProseEntries(working,[key],{entries:matches}):matches;
    working=apply(working,[key],{entries:valid});entries.push(...valid);accepted.push(key);
   }catch(e){issues.push(e.message);}
  }
  if(typeof response?.suggestions==='string')suggestions.push(response.suggestions);
  pending=pending.filter(key=>!accepted.includes(key));
  // Next call repairs missing source scopes first; accepted scopes are never repeated.
 }
 const completed=plan.keys.filter(key=>entries.some(e=>e.key===key));
 if(!entries.length)throw new Error(`Đã dùng ${calls}/${plan.maxCalls} lượt; chưa có ô hợp lệ. Game chưa thay đổi. ${issues.join('; ')}`);
 return {result:{entries,suggestions:suggestions.join('\n')},keys:completed,remainingKeys:pending,calls,notice:`Đã dùng ${calls}/${plan.maxCalls} lượt; hoàn tất ${completed.length}/${plan.keys.length} ô. ${pending.length?`Còn ${pending.length} ô; duyệt phần đã viết rồi bấm viết tiếp bằng ngân sách mới.`:'Đã nhận đủ ô.'} ${issues.join('; ')}`};
}
