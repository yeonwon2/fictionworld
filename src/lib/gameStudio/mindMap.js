// A lossless view of the player's canonical nodes. Never repair or sample links.
export function choiceLabel(index) {
  let n = index + 1, label = '';
  while (n > 0) { n--; label = String.fromCharCode(65 + n % 26) + label; n = Math.floor(n / 26); }
  return label;
}

export function sceneLabel(id, node) {
  if (id === 'start_node') return 'Dẫn truyện';
  if (node?.isEnding) return `Kết thúc · ${node.endingLabel || id}`;
  return /^scene_\d+$/.test(id) ? `Cảnh ${id.slice(6)}` : id;
}

export function buildMindMap(nodes = {}) {
  /** @type {Array<{key: string, kind: string, title: string, text: string, sceneId?: string, choiceIndex?: number, canonicalKey?: string, previewEdge?: any, choice?: any, x?: number, y?: number, unreachable?: boolean}>} */
  const cards = [];
  /** @type {Array<{from: string, to: string, label: string, missing?: boolean}>} */
  const edges = [];
  const errors = [];
  const sceneKey = (id) => `scene:${id}`;
  const addEdge = (from, target, label = '') => {
    const missing = !target || !Object.hasOwn(nodes, target);
    const to = missing ? `missing:${edges.length}` : sceneKey(target);
    if (missing) {
      cards.push({ key: to, kind: 'missing', title: target ? `Thiếu cảnh: ${target}` : 'Chưa chọn đích', text: 'Sửa lựa chọn ở ô trước để nối tới một cảnh có thật.' });
      errors.push(`${label || from}: ${target ? `không tìm thấy ${target}` : 'chưa có đích'}`);
    }
    edges.push({ from, to, label, missing });
  };
  for (const [id, node] of Object.entries(nodes)) {
    cards.push({ key: sceneKey(id), kind: node.isEnding ? 'ending' : id === 'start_node' ? 'intro' : 'scene', sceneId: id, title: sceneLabel(id, node), text: node.text || '' });
    if (node.id !== id) errors.push(`${id}: ID cảnh không khớp dữ liệu (${node.id || 'trống'}).`);
    if (node.isEnding) continue;
    if (!node.choices?.length && !node.combat) errors.push(`${sceneLabel(id, node)}: chưa có lựa chọn và chưa phải kết thúc.`);
    (node.choices || []).forEach((choice, index) => {
      const key = `choice:${id}:${index}`;
      cards.push({ key, kind: 'choice', sceneId: id, choiceIndex: index, title: `${sceneLabel(id, node)} · ${choiceLabel(index)}`, text: choice.text || '(Chưa có lời lựa chọn)', choice });
      edges.push({ from: sceneKey(id), to: key, label: choiceLabel(index) });
      if (choice.diceRoll) {
        addEdge(key, choice.diceRoll.successTarget, 'Thành công');
        addEdge(key, choice.diceRoll.failTarget, 'Thất bại');
      } else addEdge(key, choice.targetNodeId, 'Đi tới');
    });
    if (node.combat) {
      addEdge(sceneKey(id), node.combat.winTarget, 'Thắng trận');
      if (node.combat.fleeTarget) addEdge(sceneKey(id), node.combat.fleeTarget, 'Bỏ chạy');
      // The player always ends on defeat, even if legacy data has loseTarget.
      const key = `defeat:${id}`;
      cards.push({ key, kind: 'combat', sceneId: id, title: 'Thua trận · Game Over', text: 'Người chơi kết thúc khi thua trận.' });
      edges.push({ from: sceneKey(id), to: key, label: 'Thua trận' });
    }
  }
  if (!nodes.start_node) errors.unshift('Thiếu cảnh mở đầu start_node.');
  const outgoing = new Map(cards.map((c) => [c.key, []]));
  edges.forEach((e) => outgoing.get(e.from)?.push(e.to));
  const depths = new Map();
  function visit(root, initial) {
    depths.set(root, initial);
    const queue = [root];
    for (let i = 0; i < queue.length; i++) {
      for (const to of outgoing.get(queue[i]) || []) {
        if (!depths.has(to)) { depths.set(to, depths.get(queue[i]) + 1); queue.push(to); }
      }
    }
  }
  if (nodes.start_node) visit(sceneKey('start_node'), 0);
  const reachable = new Set(depths.keys());
  // Include disconnected scenes too. Cycles are edges, never recursive copies.
  cards.forEach((card) => { if (!depths.has(card.key)) visit(card.key, 0); });
  const rows = new Map();
  for (const card of cards) {
    const depth = depths.get(card.key);
    const row = rows.get(depth) || 0;
    rows.set(depth, row + 1);
    Object.assign(card, { x: 40 + depth * 410, y: 60 + row * 310, unreachable: !reachable.has(card.key) });
  }
  return { cards, edges, errors, width: Math.max(800, ...cards.map((c) => c.x + 370)), height: Math.max(420, ...cards.map((c) => c.y + 310)) };
}

export function gameFromMindMap(game) {
  const graph = buildMindMap(game.nodes);
  if (graph.errors.length) throw new Error(graph.errors.join('\n'));
  // Preserve every gameplay field; in particular don't reparse sourceScript.
  const result = JSON.parse(JSON.stringify(game));
  result.meta.mindMapRevision = (result.meta.mindMapRevision || 0) + 1;
  return result;
}
