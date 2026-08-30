import { connectionPorts } from './mapConnections.js';
import { touchWorkshop } from './aiMindMap.js';

const portToken = (id, key) => JSON.stringify([id, key]);
export function copyMapPattern(game, ids) {
  const selected = [...new Set(ids)].filter((id) => id !== 'start_node' && game.nodes[id]);
  if (!selected.length) throw new Error('Chọn ít nhất một cảnh để sao chép. Lời dẫn được giữ riêng, không nhân bản.');
  const nodes = Object.fromEntries(selected.map((id) => [id, structuredClone(game.nodes[id])]));
  const exits = selected.flatMap((id) => connectionPorts(nodes[id]).filter((p) => !Object.hasOwn(nodes,p.target)).map((p) => ({ token: portToken(id,p.key), sourceId: id, ...p })));
  return { nodes, ids: selected, exits };
}
function setPort(node, port, target) {
  if (port.combat) node.combat[port.field] = target;
  else if (port.dice) node.choices[port.index].diceRoll[port.field] = target;
  else node.choices[port.index].targetNodeId = target;
}
export function pasteMapPattern(game, pattern, { count = 1, keepContent = false, chain = false, entryId = pattern.ids[0], exitTokens = [], finalTarget = '', keepExternal = false } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 30 || count * pattern.ids.length > 600) throw new Error('Mỗi lần dán 1–30 nhóm, tối đa 600 cảnh.');
  if (!pattern.nodes[entryId]) throw new Error('Chọn cảnh đầu của nhóm.');
  if (finalTarget && !game.nodes[finalTarget]) throw new Error('Đích cuối không còn tồn tại.');
  if (exitTokens.some((token) => !pattern.exits.some((p) => p.token === token))) throw new Error('Đường ra của nhóm không hợp lệ.');
  if (chain && !exitTokens.length) throw new Error('Chọn ít nhất một đáp án cuối nhóm để nối sang nhóm kế.');
  const next = structuredClone(game);
  let number = Math.max(game.meta.nextSceneNumber || 1, game.meta.aiWorkshop?.nextSceneNumber || 1, ...Object.keys(game.nodes).map((id) => /^scene_\d+$/.test(id) ? Number(id.slice(6)) + 1 : 1));
  const mappings = Array.from({length:count},()=>Object.fromEntries(pattern.ids.map((id)=>[id,`scene_${number++}`])));
  const addedIds = [];
  mappings.forEach((mapping, batch) => {
    pattern.ids.forEach((id) => {
      const node = structuredClone(pattern.nodes[id]);
      node.id = mapping[id];
      if (!keepContent) {
        node.text = ''; node.speaker = ''; node.workshopHint = node.workshopRole === 'consequence' ? 'Viết hệ quả của đáp án dẫn vào cảnh này, rồi nối mạch tới cảnh tiếp theo.' : '';
        if (node.systemPopup) node.systemPopup.text = '';
        (node.choices || []).forEach((c) => { c.text = c.workshopContinuation ? 'Tiếp tục' : ''; if (c.systemPopup) c.systemPopup.text = ''; });
      }
      if (node.workshopRole === 'consequence') node.workshopTitle = `Hệ quả · Cảnh ${mapping[id].slice(6)}`;
      // Remap even legacy nominal targets; engine-relevant dice outcomes follow below.
      (node.choices || []).forEach((c) => { if (Object.hasOwn(c,'targetNodeId')) c.targetNodeId = mapping[c.targetNodeId] || (keepExternal ? c.targetNodeId : ''); });
      for (const port of connectionPorts(pattern.nodes[id])) {
        let target = mapping[port.target] || (keepExternal ? port.target : '');
        if (chain && exitTokens.includes(portToken(id,port.key))) target = mappings[batch + 1]?.[entryId] || finalTarget;
        setPort(node,port,target);
      }
      next.nodes[node.id] = node; addedIds.push(node.id);
    });
  });
  next.meta.nextSceneNumber = number;
  if (next.meta.aiWorkshop) next.meta.aiWorkshop.nextSceneNumber = number;
  return { game: touchWorkshop(next), addedIds, firstId: mappings[0][entryId] };
}
