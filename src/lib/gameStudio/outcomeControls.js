// Outcome controls use the engine's existing choice gates, not a second rules engine.
export const ENDING_LABELS = { GOOD_END: 'HE · Kết thúc tốt', BAD_END: 'BE · Kết thúc xấu', NORMAL_END: 'NE · Kết thúc thường', TRUE_END: 'TE · Kết thúc trọn vẹn' };
export function endingEntries(game, endingId) {
  const entries = [];
  for (const [sourceId, node] of Object.entries(game.nodes)) {
    (node.choices || []).forEach((choice, index) => {
      if (choice.diceRoll) {
        if ([choice.diceRoll.successTarget, choice.diceRoll.failTarget].includes(endingId)) entries.push({ sourceId, index, special: true, choice });
      } else if (choice.targetNodeId === endingId) entries.push({ sourceId, index, special: false, choice });
    });
    if (node.combat && [node.combat.winTarget,node.combat.fleeTarget].includes(endingId)) entries.push({ sourceId, index: null, special: true, choice: null });
  }
  return entries;
}
export function hasGate(choice) {
  return ['statRequirements','statRequirementsMax','requiresNpcAffinity','requiresNpcAffinityMax'].some((key) => Object.keys(choice?.[key] || {}).length) || ['requiresFlag','requiresFlagAbsent','requiresItem'].some((key) => !!choice?.[key]);
}
export function validateOutcomeGate(choice, statsConfig) {
  const keys = new Set(statsConfig.map((stat) => stat.key));
  for (const field of ['statRequirements','statRequirementsMax']) for (const [key,value] of Object.entries(choice[field] || {})) {
    if (!keys.has(key)) throw new Error(`Không có chỉ số ${key} trong bộ điểm. Hãy sửa bộ điểm hoặc bỏ điều kiện này.`);
    if (!Number.isFinite(value)) throw new Error(`Điều kiện ${key} phải là một số.`);
  }
  for (const [key,min] of Object.entries(choice.statRequirements || {})) if (choice.statRequirementsMax?.[key] !== undefined && min > choice.statRequirementsMax[key]) throw new Error(`${key}: điểm tối thiểu lớn hơn điểm tối đa, không ai có thể vào nhánh này.`);
  if (choice.requiresFlag && choice.requiresFlag === choice.requiresFlagAbsent) throw new Error('Một sự kiện không thể vừa bắt buộc có vừa bắt buộc chưa xảy ra.');
}
export function saveOutcomeGate(game, sourceId, index, gate) {
  const source = game.nodes[sourceId];
  if (!source?.choices?.[index]) throw new Error('Đáp án không còn tồn tại. Hãy mở lại cửa sổ.');
  const next = structuredClone(game);
  const choice = next.nodes[sourceId].choices[index];
  // Only replace the fields exposed by this editor; preserve links, rewards and advanced gates.
  for (const field of ['statRequirements','statRequirementsMax','requiresFlag','requiresFlagAbsent','requiresItem']) {
    delete choice[field];
    if (gate[field] && (typeof gate[field] !== 'object' || Object.keys(gate[field]).length)) choice[field] = structuredClone(gate[field]);
  }
  validateOutcomeGate(choice, game.meta.statsConfig || []);
  next.meta.sourceScriptOutdated = !!next.meta.sourceScript;
  return next;
}
export function saveOutcomeMode(game, mode, stats, title, text) {
  if (!['accumulation','survival'].includes(mode)) throw new Error('Chọn chế độ điểm.');
  const next = structuredClone(game);
  next.meta.outcomeMode = mode;
  next.meta.statsConfig = (game.meta.statsConfig || []).map((old) => {
    const edit = stats.find((stat) => stat.key === old.key) || old;
    const isVital = mode === 'survival' && !!edit.isVital;
    const deathThreshold = edit.deathThreshold ?? 0;
    const initial = game.meta.initialStats?.[old.key] ?? old.default ?? 0;
    if (isVital && (!Number.isFinite(deathThreshold) || initial <= deathThreshold)) throw new Error(`${old.label || old.key}: ngưỡng thua phải thấp hơn điểm ban đầu (${initial}).`);
    return { ...old, isVital, deathThreshold: isVital ? deathThreshold : 0 };
  });
  next.meta.gameOverTitle = title.trim(); next.meta.gameOverText = text.trim();
  next.meta.sourceScriptOutdated = !!next.meta.sourceScript;
  return next;
}
export function outcomeWarnings(game) {
  const warnings = [];
  const endings = Object.entries(game.nodes).filter(([,node]) => node.isEnding);
  if (!endings.length) warnings.push('Chưa có ô kết thúc: hãy tạo HE/BE/NE rồi nối từ cảnh chốt truyện.');
  for (const [id,node] of endings) {
    const entries = endingEntries(game,id);
    const name = node.workshopTitle || id;
    if (!entries.length) warnings.push(`${name}: chưa có đường dẫn vào.`);
    if (entries.some((entry) => !entry.special && !hasGate(entry.choice))) warnings.push(`${name}: có đường vào không yêu cầu điểm/cờ/vật phẩm. Đây là kết thúc theo lựa chọn, chưa phải kết thúc bị khóa theo điểm.`);
    if (entries.some((entry) => entry.special)) warnings.push(`${name}: có đường xúc xắc/chiến đấu. Kết quả được quyết định bởi cơ chế đó; sửa ở ô nguồn, không dùng điều kiện điểm của một đường khác để bảo vệ kết thúc này.`);
  }
  for (const [id,node] of Object.entries(game.nodes)) {
    if (!node.isEnding && node.choices?.length && node.choices.every(hasGate)) warnings.push(`${node.workshopTitle || id}: mọi đáp án đều có điều kiện; cần QA để kiểm tra có trường hợp bị kẹt hay không.`);
    for (const choice of node.choices || []) { try { validateOutcomeGate(choice,game.meta.statsConfig || []); } catch(e) { warnings.push(`${id}: ${e.message}`); } }
  }
  return warnings;
}

export function scoreEndingRanges(rules) {
  if (!Array.isArray(rules) || !rules.length) throw new Error('Cần ít nhất một kết thúc.');
  if (rules.filter(r=>r.min===null).length !== 1) throw new Error('Cần đúng một nhánh nhận phần điểm thấp nhất (không có mốc dưới).');
  for (const r of rules) {
    if (!r.title?.trim()) throw new Error('Hãy đặt tên cho mọi kết thúc.');
    if (!ENDING_LABELS[r.type]) throw new Error('Chọn loại hiển thị hợp lệ cho kết thúc.');
    if (r.min !== null && (!Number.isSafeInteger(r.min) || r.min <= Number.MIN_SAFE_INTEGER)) throw new Error('Mốc điểm phải là số nguyên hợp lệ.');
  }
  const sorted=[...rules].sort((a,b)=>a.min===null?-1:b.min===null?1:a.min-b.min);
  if (new Set(sorted.map(r=>r.min)).size !== sorted.length) throw new Error('Hai kết thúc không được có cùng mốc điểm.');
  return sorted.map((r,i)=>({...r,max:i<sorted.length-1?sorted[i+1].min-1:null}));
}
export function createScoreEndingRules(game,statKey,rules) {
  const stat=(game.meta.statsConfig||[]).find(s=>s.key===statKey);
  if(!stat) throw new Error('Chọn một chỉ số có trong bộ điểm.');
  const ranges=scoreEndingRanges(rules);
  const next=structuredClone(game);
  let number=Math.max(next.meta.nextSceneNumber||1,next.meta.aiWorkshop?.nextSceneNumber||1,...Object.keys(next.nodes).map(id=>/^scene_\d+$/.test(id)?Number(id.slice(6))+1:1));
  const ids=Array.from({length:ranges.length+1},()=>`scene_${number++}`),checkpoint=ids[0];
  next.nodes[checkpoint]={id:checkpoint,workshopTitle:'Xét kết thúc theo điểm',workshopRole:'main',text:`Hành trình đã đến hồi kết. Kết quả được mở theo chỉ số ${stat.label||statKey} bạn đã tích lũy.`,choices:ranges.map((r,i)=>({text:`Đón nhận: ${r.title.trim()}`,targetNodeId:ids[i+1],statModifiers:{},...(r.min!==null?{statRequirements:{[statKey]:r.min}}:{}),...(r.max!==null?{statRequirementsMax:{[statKey]:r.max}}:{})}))};
  ranges.forEach((r,i)=>{const id=ids[i+1];next.nodes[id]={id,isEnding:true,endingType:r.type,workshopTitle:r.title.trim(),text:r.text?.trim()||`Hành trình khép lại: ${r.title.trim()}.`,choices:[],workshopHint:'Đây là lời kết mẫu. Viết lại theo nhân vật, bối cảnh và những lựa chọn trước đó.'};});
  next.meta.nextSceneNumber=number;
  if(next.meta.aiWorkshop) next.meta.aiWorkshop.nextSceneNumber=number;
  next.meta.sourceScriptOutdated=!!next.meta.sourceScript;
  return {game:next,checkpoint,ids};
}
export function createScoreEndings(game,statKey,normalAt=20,happyAt=80) {
  if(![normalAt,happyAt].every(Number.isSafeInteger)||normalAt>=happyAt) throw new Error('Mốc HE phải cao hơn mốc Bình thường.');
  return createScoreEndingRules(game,statKey,[{title:'BE · Kết thúc xấu',type:'BAD_END',min:null},{title:'NE · Bình thường',type:'NORMAL_END',min:normalAt},{title:'HE · Kết thúc tốt',type:'GOOD_END',min:happyAt}]);
}
