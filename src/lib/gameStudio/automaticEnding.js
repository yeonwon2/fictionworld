import { choiceAvailable } from './routeExplorer.js';
const permitted = new Set(['text','targetNodeId','statRequirements','statRequirementsMax','requiresFlag','requiresFlagAbsent','requiresItem','requiresNpcAffinity','requiresNpcAffinityMax','statModifiers']);
export function validateAutomaticEnding(nodes,node) {
 if(!node || node.isEnding || !node.choices?.length) throw new Error('Ô xét điểm phải có đường dẫn tới các kết thúc.');
 if(['combat','randomEvents','quest','systemPopup','grantItem','grantFlag'].some(k=>node[k])) throw new Error('Ô xét điểm tự động không được chứa chiến đấu, sự kiện hay hiệu ứng vào cảnh.');
 for(const c of node.choices) {
  if(!nodes[c.targetNodeId]?.isEnding) throw new Error('Mọi đường của ô xét điểm tự động phải dẫn trực tiếp tới một ending có thật.');
  if(Object.keys(c).some(k=>!permitted.has(k)&&c[k]!=null&&c[k]!==''&&c[k]!==false) || Object.values(c.statModifiers||{}).some(v=>v!==0)) throw new Error('Đáp án xét điểm chỉ được có điều kiện, không có thưởng/phạt, xúc xắc hoặc hiệu ứng khác.');
 }
}
export function resolveAutomaticEnding(nodes,node,runtime) {
 validateAutomaticEnding(nodes,node);
 const state={stats:runtime.stats,flags:new Set(runtime.flags||[]),items:new Set(runtime.inventory||[]),npcAffinity:runtime.npcAffinity||{}};
 const eligible=node.choices.filter(c=>choiceAvailable(c,state));
 if(eligible.length!==1) throw new Error(eligible.length?'Có nhiều kết thúc cùng đủ điều kiện. Tác giả cần sửa các khoảng điểm/điều kiện để chỉ còn một kết thúc phù hợp.':'Không có kết thúc phù hợp với điểm và sự kiện hiện tại. Tác giả cần bổ sung nhánh còn thiếu.');
 return eligible[0].targetNodeId;
}
