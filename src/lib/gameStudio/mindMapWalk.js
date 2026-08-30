// Editorial walkthrough: follow exact graph links, without simulating player state.
export function beginWalk(graph, cardKey = 'scene:start_node') {
  const card = graph.cards.find((entry) => entry.key === cardKey);
  if (!card) return [];
  if (card.kind !== 'choice') return [card.key];
  const trail = [`scene:${card.sceneId}`, card.key];
  const exits = graph.edges.filter((edge) => edge.from === card.key);
  if (exits.length === 1) trail.push(exits[0].to);
  return trail;
}

export function advanceWalk(graph, trail, edge) {
  const current = trail.at(-1);
  if (edge.from !== current || !graph.edges.some((item) => item.from === current && item.to === edge.to && item.label === edge.label)) return trail;
  const next = [...trail, edge.to];
  const card = graph.cards.find((item) => item.key === edge.to);
  if (card?.kind === 'choice') {
    const exits = graph.edges.filter((item) => item.from === card.key);
    if (exits.length === 1) next.push(exits[0].to);
  }
  return next;
}

export function walkGraph(graph, trail, showNext = false) {
  const byKey = new Map(graph.cards.map((card) => [card.key, card]));
  const cards = trail.filter((key) => byKey.has(key)).map((key, index) => ({ ...byKey.get(key), canonicalKey: key, key: `walk:${index}`, x: 40 + index * 410, y: 60 }));
  const edges = cards.slice(1).map((card, index) => ({ from: cards[index].key, to: card.key, label: '→' }));
  if (showNext && cards.length) {
    const last = cards.at(-1);
    graph.edges.filter((edge) => edge.from === trail.at(-1)).forEach((edge, index) => {
      const target = byKey.get(edge.to);
      if (!target) return;
      const key = `next:${index}`;
      cards.push({ ...target, canonicalKey: target.key, key, x: last.x + 410, y: 60 + index * 310, previewEdge: edge });
      edges.push({ from: last.key, to: key, label: edge.label });
    });
  }
  return { cards, edges, errors: graph.errors, width: Math.max(800, ...cards.map((card) => card.x + 370)), height: Math.max(420, ...cards.map((card) => card.y + 310)) };
}

export function walkCounts(graph, trail) {
  const cards = new Map(graph.cards.map((card) => [card.key, card]));
  const result = { scenes: 0, choices: 0, intros: 0, endings: 0 };
  for (const key of trail) {
    const kind = cards.get(key)?.kind;
    if (kind === 'scene') result.scenes++;
    if (kind === 'choice') result.choices++;
    if (kind === 'intro') result.intros++;
    if (kind === 'ending') result.endings++;
  }
  return result;
}
