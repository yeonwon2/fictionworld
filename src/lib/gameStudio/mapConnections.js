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

export function connectFromCard(game, { sourceId, choiceIndex = null, portKeys, targetId = '', create = false, choiceCount = 4, ending = false, hint = '' }) {
  const source = game.nodes[sourceId];
  if (!source || source.isEnding) throw new Error('Cảnh nguồn không tồn tại hoặc đã là kết thúc.');
  const ports = connectionPorts(source, choiceIndex);
  if (choiceIndex !== null && !ports.length) throw new Error('Lựa chọn nguồn không còn tồn tại.');
  if (ports.length && (!portKeys.length || portKeys.some((key) => !ports.some((p) => p.key === key)))) throw new Error('Hãy chọn ít nhất một đáp án cần nối.');
  let next = structuredClone(game), destination = targetId;
  if (create) {
    const added = addSceneChain(next, '', 1, choiceCount, ending);
    next = added.game; destination = added.firstId; next.nodes[destination].workshopHint = hint;
  }
  if (!next.nodes[destination]) throw new Error('Hãy chọn một cảnh đích có thật.');
  const node = next.nodes[sourceId];
  if (!ports.length) node.choices = [...(node.choices || []), { text: '', statModifiers: {}, targetNodeId: destination }];
  for (const port of ports.filter((p) => portKeys.includes(p.key))) {
    if (port.combat) node.combat[port.field] = destination;
    else if (port.dice) node.choices[port.index].diceRoll[port.field] = destination;
    else node.choices[port.index].targetNodeId = destination;
  }
  return { game: touchWorkshop(next), targetId: destination };
}
