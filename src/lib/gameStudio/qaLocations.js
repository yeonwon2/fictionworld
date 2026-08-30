// Resolve against the original map, never against QA's repaired simulation copy.
export function findingLocations(finding, nodes) {
  const result = [];
  const add = (sceneId, choiceIndex = null) => {
    const node = nodes[sceneId];
    if (!node) return;
    const validChoice = Number.isInteger(choiceIndex) && !!node.choices?.[choiceIndex];
    const key = validChoice ? `choice:${sceneId}:${choiceIndex}` : `scene:${sceneId}`;
    if (!result.some((item) => item.key === key)) result.push({ key, sceneId, choiceIndex: validChoice ? choiceIndex : null });
  };
  // Balance findings concern a whole reproduction route: start at its final choice,
  // and expose the other choices as related locations rather than claiming one cause.
  if (finding.category === 'balance' && finding.route?.length) {
    [...finding.route].reverse().forEach((step) => add(step.sceneId, step.choiceIndex));
    return result;
  }
  if (finding.orphan) {
    const { kind, name } = finding.orphan;
    for (const [id, node] of Object.entries(nodes)) {
      if (kind === 'item' ? node.grantItem === name : node.setFlags?.includes(name)) add(id);
      (node.choices || []).forEach((choice, index) => {
        if (kind === 'item' ? choice.grantItem === name : choice.grantFlag === name || choice.grantFlags?.includes(name)) add(id, index);
      });
    }
    if (result.length) return result;
  }
  const ids = new Set(finding.sceneIds || []);
  if (finding.sceneId) ids.add(finding.sceneId);
  // Quoted IDs work for custom scene names, not just scene_N.
  for (const id of Object.keys(nodes)) if ((finding.message || '').includes(`"${id}"`)) ids.add(id);
  const removedList = (finding.message || '').match(/đã bị bỏ đi:\s*([^.]*)/);
  if (removedList) for (const id of removedList[1].split(',').map((part) => part.trim())) if (nodes[id]) ids.add(id);
  for (const id of ids) {
    const node = nodes[id];
    if (!node) continue;
    const matches = (node.choices || []).flatMap((choice, index) =>
      (finding.message || '').includes(`lựa chọn "${choice.text || '(không có chữ)'}"`) ? [index] : []);
    if (matches.length) matches.forEach((index) => add(id, index));
    else add(id);
  }
  // For a missing destination, locate the source choices still visible on the map.
  if (!result.length) for (const [id, node] of Object.entries(nodes)) {
    (node.choices || []).forEach((choice, index) => {
      if ([choice.targetNodeId, choice.diceRoll?.successTarget, choice.diceRoll?.failTarget].some((target) => target && ids.has(target))) add(id, index);
    });
  }
  return result;
}
