import { addSceneChain, touchWorkshop } from './aiMindMap.js';

export function connectionPorts(node, choiceIndex = null) {
  /** @type {Array<{key: string, field: string, label: string, target: string, index?: number, dice?: boolean, combat?: boolean}>} */
  const ports = [];
  (node.choices || []).forEach((choice, index) => {
    if (choiceIndex !== null && index !== choiceIndex) return;
    const label = `Lựa chọn ${index + 1}${choice.text ? ` · ${choice.text}` : ' · Chưa viết'}`;
    if (choice.diceRoll) {
      for (const [field, suffix] of [['successTarget', 'Thành công'], ['failTarget', 'Thất bại']]) ports.push({ key: `choice:${index}:${field}`, index, field, dice: true, label: `${label} / ${suffix}`, target: choice.diceRoll[field] || '' });
    } else ports.push({ key: `choice:${index}:targetNodeId`, index, field: 'targetNodeId', label, target: choice.targetNodeId || '' });
  });
  if (choiceIndex === null && node.combat) for (const field of ['winTarget', 'fleeTarget']) ports.push({ key: `combat:${field}`, field, combat: true, label: field === 'winTarget' ? 'Thắng trận' : 'Bỏ chạy', target: node.combat[field] || '' });
  return ports;
}

export function connectFromCard(game, { sourceId, choiceIndex = null, portKeys, targetId = '', create = false, choiceCount = 4, ending = false, hint = '', role = 'main' }) {
  const source = game.nodes[sourceId];
  if (!source || source.isEnding) throw new Error('Cảnh nguồn không tồn tại hoặc đã là kết thúc.');
  const ports = connectionPorts(source, choiceIndex);
  if (choiceIndex !== null && !ports.length) throw new Error('Lựa chọn nguồn không còn tồn tại.');
  if (ports.length && (!portKeys.length || portKeys.some((key) => !ports.some((p) => p.key === key)))) throw new Error('Hãy chọn ít nhất một đáp án cần nối.');
  let next = structuredClone(game), destination = targetId;
  if (create) {
    const added = addSceneChain(next, '', 1, choiceCount, ending);
    next = added.game; destination = added.firstId; next.nodes[destination].workshopHint = hint;
    next.nodes[destination].workshopRole = role === 'side' ? 'side' : 'main';
    if (role === 'side') next.nodes[destination].workshopTitle = `Cảnh phụ · ${destination.replace('scene_', 'Cảnh ')}`;
  }
  if (!next.nodes[destination]) throw new Error('Hãy chọn một cảnh đích có thật.');
  const node = next.nodes[sourceId];
  if (!ports.length) node.choices = [...(node.choices || []), { text: sourceId === 'start_node' ? 'Bắt đầu' : 'Tiếp tục', statModifiers: {}, targetNodeId: destination }];
  for (const port of ports.filter((p) => portKeys.includes(p.key))) {
    if (port.combat) node.combat[port.field] = destination;
    else if (port.dice) node.choices[port.index].diceRoll[port.field] = destination;
    else node.choices[port.index].targetNodeId = destination;
  }
  return { game: touchWorkshop(next), targetId: destination };
}

// Insert on one edge: the original choice keeps its costs/gates/effects, and
// the new scene continues to exactly the previous destination.
export function insertConsequence(game, { sourceId, choiceIndex, portKey, targetId = '', title = '', text = '', hint = '' }) {
  const source = game.nodes[sourceId];
  if (!source || source.isEnding || !Number.isInteger(choiceIndex)) throw new Error('Hãy chọn một đáp án của cảnh để chèn hệ quả.');
  const port = connectionPorts(source, choiceIndex).find((p) => p.key === portKey);
  if (!port) throw new Error('Đường đi không còn tồn tại. Hãy chọn lại đáp án.');
  const hasOldDestination = !!(port.target && game.nodes[port.target]);
  const destination = hasOldDestination ? port.target : targetId;
  if (destination && !game.nodes[destination]) throw new Error('Đáp án chưa có đích hợp lệ. Hãy chọn cảnh sẽ đi tiếp sau hệ quả.');
  const next = structuredClone(game);
  const number = Math.max(game.meta.nextSceneNumber || 1, game.meta.aiWorkshop?.nextSceneNumber || 1, ...Object.keys(game.nodes).map((id) => /^scene_\d+$/.test(id) ? Number(id.slice(6)) + 1 : 1));
  const id = `scene_${number}`;
  next.meta.nextSceneNumber = number + 1;
  if (next.meta.aiWorkshop) next.meta.aiWorkshop.nextSceneNumber = number + 1;
  next.nodes[id] = {
    id, text, workshopRole: 'consequence', workshopTitle: title.trim() || `Hệ quả của ${sourceId} · lựa chọn ${choiceIndex + 1}`,
    workshopHint: hint || `Mô tả hệ quả trực tiếp của lựa chọn: ${source.choices[choiceIndex].text || `lựa chọn ${choiceIndex + 1}`}. Sau đó nối mạch tới ${destination || 'cảnh tiếp theo do tác giả chọn sau'}. Không tính lại điểm, vật phẩm hoặc cờ của lựa chọn nguồn.`,
    choices: [{ text: 'Tiếp tục', targetNodeId: destination, statModifiers: {}, workshopContinuation: true }],
  };
  const choice = next.nodes[sourceId].choices[choiceIndex];
  if (port.dice) choice.diceRoll[port.field] = id;
  else choice.targetNodeId = id;
  return { game: touchWorkshop(next), targetId: id };
}

export function connectIncoming(game, targetId, selections) {
  if (!game.nodes[targetId]) throw new Error('Cảnh đích không còn tồn tại.');
  if (!Array.isArray(selections) || !selections.length) throw new Error('Hãy chọn ít nhất một đáp án cần nối vào cảnh này.');
  const changes = selections.map(({ sourceId, portKey }) => {
    const node = game.nodes[sourceId];
    const port = node && !node.isEnding && connectionPorts(node).find((p) => p.key === portKey);
    if (!port) throw new Error('Một đáp án đã thay đổi hoặc không còn tồn tại. Hãy mở lại cửa sổ nối.');
    return { sourceId, port };
  });
  const next = structuredClone(game);
  for (const { sourceId, port } of changes) {
    const node = next.nodes[sourceId];
    if (port.combat) node.combat[port.field] = targetId;
    else if (port.dice) node.choices[port.index].diceRoll[port.field] = targetId;
    else node.choices[port.index].targetNodeId = targetId;
  }
  return touchWorkshop(next);
}

// Create exactly one shared destination; all selected incoming paths change atomically.
export function createMergeScene(game, selections, choiceCount = 4) {
  if (!selections.length) throw new Error('Chọn ít nhất một đường dẫn vào cảnh chung.');
  const added = addSceneChain(game, '', 1, choiceCount);
  added.game.nodes[added.firstId].workshopRole = 'main';
  return { game: connectIncoming(added.game, added.firstId, selections), targetId: added.firstId };
}

export function appendChoices(game, sourceId, count = 1) {
  const source = game.nodes[sourceId];
  if (!source || source.isEnding) throw new Error('Không thể thêm đáp án vào cảnh kết thúc.');
  if (!Number.isInteger(count) || count < 1 || count > 12) throw new Error('Chọn từ 1 đến 12 đáp án mới.');
  const next = structuredClone(game);
  next.nodes[sourceId].choices = [...(source.choices || []), ...Array.from({ length: count }, () => ({ text: '', targetNodeId: '', statModifiers: {} }))];
  return touchWorkshop(next);
}
