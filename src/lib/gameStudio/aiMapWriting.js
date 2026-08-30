import {selectedScopes,applyWriting,workshopPrompt,WRITE_SCHEMA} from './aiMindMap.js';

export function collectWritingEntries(game,keys,response) {
 const expected=selectedScopes(game,keys).map(s=>s.key);
 const incoming=Array.isArray(response?.entries)?response.entries:[];
 const entries=[],issues=[];
 for(const key of expected){
  const matches=incoming.filter(entry=>entry?.key===key);
  if(matches.length!==1){issues.push(`${key}: ${matches.length?'AI trả trùng ô':'AI chưa trả ô này'}`);continue;}
  try{applyWriting(game,[key],{entries:matches});entries.push(matches[0]);}catch(e){issues.push(`${key}: ${e.message}`);}
 }
 return {entries,missing:expected.filter(key=>!entries.some(e=>e.key===key)),issues};
}

export async function writeMapScopes(game,keys,instruction,requestAI,onProgress=(message)=>void message,isActive=()=>true) {
 const expected=selectedScopes(game,keys).map(s=>s.key),entries=[],suggestions=[];
 let working=game,issues=[];
 for(let i=0;i<expected.length;i+=4){
  let pending=expected.slice(i,i+4);
  for(let attempt=0;attempt<2&&pending.length;attempt++){
   if(!isActive())throw new Error('Lượt viết đã dừng.');
   onProgress(attempt?`AI đang bổ sung ${pending.length} ô chưa hợp lệ của nhóm ${Math.floor(i/4)+1}…`:`AI đang viết nhóm ${Math.floor(i/4)+1}/${Math.ceil(expected.length/4)}…`);
   let response;
   try{
    const contract=`\nBẮT BUỘC: entries phải có đúng ${pending.length} phần tử, mỗi key xuất hiện một lần: ${JSON.stringify(pending)}. Không viết lại ô ngoài danh sách. Ô ending có choices: [].`;
    response=await requestAI(workshopPrompt(working,pending,instruction)+contract+(attempt?`\nSửa các lỗi lượt trước: ${issues.join('; ')}`:''),{jsonSchema:WRITE_SCHEMA,useCache:false});
   }catch(e){issues=[e.message];break;}
   const collected=collectWritingEntries(working,pending,response);
   if(collected.entries.length){
    working=applyWriting(working,collected.entries.map(e=>e.key),{entries:collected.entries});
    entries.push(...collected.entries);
   }
   if(typeof response?.suggestions==='string'&&response.suggestions.trim())suggestions.push(response.suggestions);
   pending=collected.missing;issues=collected.issues;
  }
  // Don't write later scenes on top of missing source content.
  if(pending.length)break;
 }
 const completed=expected.filter(key=>entries.some(e=>e.key===key));
 const remaining=expected.filter(key=>!completed.includes(key));
 if(!entries.length)throw new Error(`AI chưa trả được ô hợp lệ nào trong ${expected.length} ô yêu cầu. ${issues.join('; ')}`);
 const result={entries,suggestions:suggestions.join('\n')};
 applyWriting(game,completed,result);
 return {result,keys:completed,remainingKeys:remaining,notice:remaining.length?`Đã viết hợp lệ ${completed.length}/${expected.length} ô. Còn ${remaining.length} ô chưa hoàn tất: ${remaining.join(', ')}. ${issues.join('; ')}. Bạn có thể duyệt phần này trước; các ô còn lại sẽ được chọn sẵn để viết tiếp.`:''};
}
