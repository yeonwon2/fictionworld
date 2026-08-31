// A deterministic content round-trip: never infer IDs, destinations or game rules.
const FORMAT = 'fictionworld-branch-v1';
const clone = value => structuredClone(value);
const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k,v[k]])) : v);
async function revision(game) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(game)));
  return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function choiceTargets(c) {
  return c.diceRoll ? [c.diceRoll.successTarget || c.diceRoll.targetNodeId, c.diceRoll.failTarget || c.diceRoll.targetNodeId].filter(Boolean) : [c.targetNodeId].filter(Boolean);
}
function targets(n) {
  if(n.isEnding)return [];
  return [...(n.choices||[]).flatMap(choiceTargets), ...['winTarget','fleeTarget','loseTarget'].map(k=>n.combat?.[k]).filter(Boolean)];
}
function visit(nodes, initial, stop = new Set()) {
  const seen = new Set(), queue=[...initial];
  for(let i=0;i<queue.length;i++) { const id=queue[i]; if(stop.has(id)||seen.has(id)||!nodes[id])continue; seen.add(id);queue.push(...targets(nodes[id])); }
  return seen;
}
export function branchScope(game,root) {
  const source=game.nodes?.[root.sceneId];
  if(!source||!Number.isInteger(root.choiceIndex)||!source.choices?.[root.choiceIndex])throw new Error('Hãy chọn một đáp án có thật để xuất nhánh.');
  const starts=choiceTargets(source.choices[root.choiceIndex]);
  if(!starts.length)throw new Error('Đáp án chưa nối tới cảnh nào.');
  const ids=visit(game.nodes,starts,new Set([root.sceneId]));
  if(!ids.size)throw new Error('Nhánh không có cảnh tiếp theo có thể xuất.');
  // Other entrances, including unreachable authoring nodes, conservatively mark shared content.
  const entrances=[];
  for(const [id,n] of Object.entries(game.nodes)) {
    if(ids.has(id))continue;
    if(id===root.sceneId) {
      (n.choices||[]).forEach((c,i)=>{if(i!==root.choiceIndex)entrances.push(...choiceTargets(c));});
      entrances.push(...['winTarget','loseTarget','fleeTarget'].map(k=>n.combat?.[k]).filter(Boolean));
    } else entrances.push(...targets(n));
  }
  const shared=visit(game.nodes,entrances.filter(id=>ids.has(id)),new Set([root.sceneId]));
  const missing=[...new Set([...starts,...[...ids].flatMap(id=>targets(game.nodes[id]))].filter(id=>!game.nodes[id]))];
  return {ids:[...ids],shared:[...ids].filter(id=>shared.has(id)),missing};
}
function textPaths(node) {
  const paths=[];
  function add(base,key){let v=node;for(const k of base)v=v?.[k];if(typeof v?.[key]==='string')paths.push([...base,key]);}
  add([],'text');add([],'speaker');
  for(const key of ['title','text'])add(['systemPopup'],key);
  for(const key of ['title','desc'])add(['quest'],key);
  (node.choices||[]).forEach((c,i)=>{add(['choices',i],'text');for(const key of ['title','text'])add(['choices',i,'systemPopup'],key);});
  return paths;
}
function get(value,path){return path.reduce((v,k)=>v?.[k],value);}
function put(value,path,text){let at=value;for(const key of path.slice(0,-1))at=at[key];at[path.at(-1)]=text;}
export async function exportBranch(game,root) {
  const scope=branchScope(game,root);
  return {format:FORMAT,revision:await revision(game),root:clone(root),context:{title:game.meta?.title||'',source:clone(game.nodes[root.sceneId])},scenes:scope.ids.map(id=>({id,shared:scope.shared.includes(id),node:clone(game.nodes[id])}))};
}
export async function reviewBranch(game,text,allowShared=false) {
  text = text.trim().replace(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/,'$1');
  if(text.startsWith('<!-- FW-BRANCH ')) text=JSON.stringify(await parseBranchScript(game,text));
  let doc;
  try {doc=JSON.parse(text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/,'$1'));} catch {throw new Error('Bản dán không đúng JSON. Hãy giữ nguyên định dạng bản xuất, gồm dấu ngoặc và mã cảnh.');}
  if(doc?.format!==FORMAT)throw new Error('Đây không phải bản xuất nhánh của xưởng. Không thể đoán mã cảnh từ văn bản tự do.');
  if(doc.revision!==await revision(game))throw new Error('Game đã thay đổi hoặc bản dán thuộc game khác. Hãy xuất nhánh mới để tránh ghi đè nhầm.');
  const expected=await exportBranch(game,doc.root);
  if(!Array.isArray(doc.scenes)||doc.scenes.length!==expected.scenes.length)throw new Error('Thiếu hoặc thừa cảnh so với nhánh đã xuất.');
  const expectedMap=new Map(expected.scenes.map(s=>[s.id,s])),seen=new Set(),changes=[];
  const normalized=clone(doc);
  for(const entry of normalized.scenes){
    const before=expectedMap.get(entry.id);
    if(!before||seen.has(entry.id))throw new Error(`Mã cảnh lạ hoặc trùng: ${entry.id}`);seen.add(entry.id);
    for(const path of textPaths(before.node)) {
      const old=get(before.node,path),next=get(entry.node,path);
      if(typeof next!=='string')throw new Error(`Thiếu nội dung ${entry.id} / ${path.join('.')}`);
      if(next!==old) {
        if(entry.shared&&!allowShared)throw new Error(`Cảnh ${entry.id} dùng chung với nhánh khác. Bỏ sửa cảnh này hoặc xác nhận sửa cảnh chung.`);
        changes.push({id:entry.id,path,before:old,after:next,shared:before.shared});
      }
      put(entry.node,path,old);
    }
  }
  normalized.scenes.sort((a,b)=>a.id.localeCompare(b.id));expected.scenes.sort((a,b)=>a.id.localeCompare(b.id));
  if(stable(normalized)!==stable(expected))throw new Error('Mã cảnh, cấu trúc, điểm, điều kiện hoặc dữ liệu bảo vệ đã bị sửa. Chỉ sửa nội dung chữ trong các trường được hỗ trợ.');
  return {changes,revision:doc.revision};
}
export async function applyBranch(game,text,allowShared=false) {
  const review=await reviewBranch(game,text,allowShared),next=clone(game);
  for(const change of review.changes)put(next.nodes[change.id],change.path,change.after);
  if(review.changes.length)next.meta={...next.meta,sourceScriptOutdated:!!next.meta?.sourceScript};
  return {game:next,changes:review.changes};
}

const scriptLabels={text:'Nội dung',speaker:'Người nói',title:'Tiêu đề',desc:'Mô tả',targetNodeId:'Đi tới',statModifiers:'Thay đổi điểm',statRequirements:'Điểm tối thiểu',statRequirementsMax:'Điểm tối đa',requiresFlag:'Cần cờ',requiresFlagAbsent:'Cần chưa có cờ',requiresItem:'Cần vật phẩm',grantFlag:'Nhận cờ',grantItem:'Nhận vật phẩm',removeItem:'Mất vật phẩm',npcAffinity:'Thay đổi thiện cảm nhân vật',requiresNpcAffinity:'Thiện cảm tối thiểu',requiresNpcAffinityMax:'Thiện cảm tối đa',diceRoll:'Xúc xắc',successTarget:'Thành công →',failTarget:'Thất bại →',successMods:'Điểm khi thành công',failMods:'Điểm khi thất bại',difficulty:'Độ khó',stat:'Chỉ số',combat:'Chiến đấu',enemy:'Đối thủ',winTarget:'Thắng →',loseTarget:'Thua →',fleeTarget:'Bỏ chạy →',systemPopup:'Thông báo hệ thống',quest:'Nhiệm vụ',randomEvents:'Sự kiện ngẫu nhiên',setFlags:'Đặt cờ',endingType:'Loại kết thúc',automaticEnding:'Tự xét kết thúc',reward:'Phần thưởng',rewards:'Phần thưởng',exp:'Kinh nghiệm',systemPoints:'Điểm hệ thống',unlockSkill:'Mở kỹ năng',completeQuestId:'Hoàn thành nhiệm vụ',bgImage:'Ảnh nền',npcAvatar:'Ảnh nhân vật',npcCard:'Thẻ nhân vật',name:'Tên',image:'Hình ảnh',description:'Mô tả',isEnding:'Là kết thúc'};
const ignoredScriptKeys=new Set(['id','choices','workshopPosition','workshopHint','workshopTitle','workshopRole']);
function scriptRules(value,game,depth=0) {
  const stats=Object.fromEntries((game.meta?.statsConfig||[]).map(s=>[s.key,s.label||s.key]));
  const lines=[];
  for(const [key,v] of Object.entries(value||{})) {
    if(ignoredScriptKeys.has(key)||v===null||v===undefined||v===''||v===false)continue;
    if(typeof v==='object') {
      const children=scriptRules(v,game,depth+1);
      if(children.length)lines.push(`${'  '.repeat(depth)}- ${scriptLabels[key]||stats[key]||key}:`,...children);
    } else lines.push(`${'  '.repeat(depth)}- ${scriptLabels[key]||stats[key]||key}: ${v===true?'Có':String(v)}`);
  }
  return lines;
}
export function branchFieldLabel(path) {
  if(path[0]==='choices')return `Đáp án ${String.fromCharCode(65+path[1])}${path[2]==='systemPopup'?' · Hệ thống · '+(scriptLabels[path[3]]||path[3]):''}`;
  if(path.length===1)return path[0]==='text'?'Lời truyện':scriptLabels[path[0]]||path[0];
  return path.map(k=>scriptLabels[k]||k).join(' · ');
}
function renderBranchScript(game,doc) {
  const lines=[`<!-- FW-BRANCH ${JSON.stringify({revision:doc.revision,root:doc.root})} -->`,
    `# KỊCH BẢN NHÁNH — ${doc.context.title}`,'',
    'YÊU CẦU CHO AI: Biên tập lời truyện, lời thoại và đáp án cho nhất quán. Chỉ sửa chữ giữa các dấu FW-TEXT và /FW-TEXT; giữ nguyên mọi dấu đánh dấu, mã cảnh, tiêu đề, điểm, điều kiện và đường đi. Trả lại TOÀN BỘ bản kịch bản này, không tóm tắt hoặc bỏ cảnh. Cảnh ghi DÙNG CHUNG ảnh hưởng nhiều nhánh; mặc định giữ nguyên.','',
    '## BỐI CẢNH TRƯỚC NHÁNH — chỉ đọc',
    `Cảnh nguồn: ${doc.root.sceneId}`,
    doc.context.source.text||'',
    `Đáp án mở nhánh: ${String.fromCharCode(65+doc.root.choiceIndex)} — ${doc.context.source.choices[doc.root.choiceIndex].text||''}`,
    ...scriptRules(doc.context.source.choices[doc.root.choiceIndex],game),''];
  for(const entry of doc.scenes) {
    const node=entry.node,paths=textPaths(node),rules=clone(node);
    for(const path of paths)put(rules,path,'');
    const name=node.workshopTitle||(/^scene_\d+$/.test(entry.id)?`Cảnh ${entry.id.slice(6)}`:entry.id);
    lines.push('---',`## ${node.isEnding?'KẾT THÚC':'CẢNH'} — ${name} [${entry.id}]`,entry.shared?'DÙNG CHUNG — sửa sẽ ảnh hưởng các nhánh đi qua.':'CẢNH RIÊNG CỦA NHÁNH','');
    function field(path) {
      const text=get(node,path);
      if(/<!--\s*\/?FW-(?:TEXT|BRANCH)/.test(text))throw new Error(`Nội dung ${entry.id} chứa dấu FW dành riêng. Hãy đổi dấu này trong lời truyện trước khi xuất.`);
      lines.push(`### ${branchFieldLabel(path)}`,`<!-- FW-TEXT ${JSON.stringify([entry.id,...path])} -->`,text,'<!-- /FW-TEXT -->','');
    }
    paths.filter(p=>p[0]!=='choices').forEach(field);
    const nodeRules=scriptRules(rules,game);
    if(nodeRules.length)lines.push('Luật của cảnh — chỉ đọc:',...nodeRules,'');
    (node.choices||[]).forEach((c,i)=>{
      paths.filter(p=>p[0]==='choices'&&p[1]===i).forEach(field);
      const choiceRules=scriptRules(rules.choices[i],game);
      lines.push(`Luật đáp án ${String.fromCharCode(65+i)} — chỉ đọc:`,...(choiceRules.length?choiceRules:['- Chưa có điều kiện hoặc đường đi.']),'');
    });
  }
  return lines.join('\n').trim();
}
export async function exportBranchScript(game,root) {
  return renderBranchScript(game,await exportBranch(game,root));
}
function splitScript(text) {
  const fields=new Map();
  const shell=text.replace(/<!-- FW-TEXT (\[[^\n]*\]) -->\n([\s\S]*?)\n<!-- \/FW-TEXT -->/g,(_,key,value)=>{
    if(fields.has(key))throw new Error(`Dấu nội dung bị trùng: ${key}`);
    fields.set(key,value);return `<!-- FW-TEXT ${key} -->\n<!-- /FW-TEXT -->`;
  });
  return {shell,fields};
}
async function parseBranchScript(game,text) {
  text=text.replace(/\r\n/g,'\n').trim();
  let header;
  try{header=JSON.parse(text.split('\n')[0].replace(/^<!-- FW-BRANCH /,'').replace(/ -->$/,''));}catch{throw new Error('Dòng nhận diện nhánh bị hỏng. Giữ nguyên dòng FW-BRANCH ở đầu bản xuất.');}
  if(header.revision!==await revision(game))throw new Error('Game đã thay đổi hoặc bản dán thuộc game khác. Hãy xuất nhánh mới để tránh ghi đè nhầm.');
  const doc=await exportBranch(game,header.root);
  const expected=splitScript(renderBranchScript(game,doc).replace(/\r\n/g,'\n'));
  const actual=splitScript(text);
  if(expected.shell!==actual.shell||expected.fields.size!==actual.fields.size)throw new Error('Bản dán bị thiếu/thừa cảnh hoặc đã sửa mã, dấu đánh dấu, tiêu đề, điểm hay đường nối. Chỉ thay lời văn giữa FW-TEXT và /FW-TEXT; giữ nguyên phần còn lại.');
  for(const entry of doc.scenes)for(const path of textPaths(entry.node)) {
    const key=JSON.stringify([entry.id,...path]);
    if(!actual.fields.has(key))throw new Error(`Thiếu nội dung: ${entry.id} · ${branchFieldLabel(path)}`);
    const value=actual.fields.get(key);
    if(value!==get(entry.node,path).replace(/\r\n/g,'\n'))put(entry.node,path,value);
  }
  return doc;
}
