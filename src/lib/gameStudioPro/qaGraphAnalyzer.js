// PRO 7 — deterministic graph analysis for authoring blueprints.
// This module never mutates the source and deliberately runs before
// normalizeAndRepair(), whose synthetic endings would otherwise hide broken
// authoring links. Complexity is O(V + E), including Tarjan SCC detection.

export function analyzeBlueprintGraph(blueprint) {
  const scenes = Array.isArray(blueprint?.scenes) ? blueprint.scenes : [];
  const endings = Array.isArray(blueprint?.endings) ? blueprint.endings : [];
  const byId = new Map();
  const duplicateSceneIds = new Set();
  for (const scene of scenes) {
    if (!scene?.id) continue;
    if (byId.has(scene.id)) duplicateSceneIds.add(scene.id);
    else byId.set(scene.id, scene);
  }
  const endingIds = new Set(endings.map((e) => e?.id).filter(Boolean));
  const incoming = new Map([...byId.keys()].map((id) => [id, []]));
  const outgoing = new Map([...byId.keys()].map((id) => [id, []]));
  const validEdges = [];
  const edgesBySource = new Map([...byId.keys()].map((id) => [id, []]));
  const brokenEdges = [];
  const reachableEndingIds = new Set();

  for (const scene of byId.values()) {
    const choices = Array.isArray(scene?.choices) ? scene.choices : [];
    for (const choice of choices) {
      const edge = { sceneId: scene.id, choiceId: choice?.id || null, targetType: choice?.targetType || null, targetId: choice?.targetId || null };
      if (!edge.targetType || !edge.targetId) brokenEdges.push({ ...edge, reason: "missing" });
      else if (edge.targetType === "scene") {
        if (!byId.has(edge.targetId)) brokenEdges.push({ ...edge, reason: "unknown_scene" });
        else {
          validEdges.push(edge); edgesBySource.get(scene.id).push(edge);
          outgoing.get(scene.id).push(edge.targetId);
          incoming.get(edge.targetId).push(edge);
        }
      } else if (edge.targetType === "ending") {
        if (!endingIds.has(edge.targetId)) brokenEdges.push({ ...edge, reason: "unknown_ending" });
        else { validEdges.push(edge); edgesBySource.get(scene.id).push(edge); }
      } else if (edge.targetType === "episode") { validEdges.push(edge); edgesBySource.get(scene.id).push(edge); }
      else brokenEdges.push({ ...edge, reason: "unknown_target_type" });

      for (const branch of Array.isArray(choice?.conditionalOutcomes) ? choice.conditionalOutcomes : []) {
        const branchEdge = { sceneId: scene.id, choiceId: choice?.id || null, branchId: branch?.id || null, targetType: branch?.targetType || null, targetId: branch?.targetId || null };
        if (!branchEdge.targetType || !branchEdge.targetId) brokenEdges.push({ ...branchEdge, reason: "missing" });
        else if (branchEdge.targetType === "scene" && byId.has(branchEdge.targetId)) {
          validEdges.push(branchEdge); edgesBySource.get(scene.id).push(branchEdge); outgoing.get(scene.id).push(branchEdge.targetId); incoming.get(branchEdge.targetId).push(branchEdge);
        } else if (branchEdge.targetType === "ending" && endingIds.has(branchEdge.targetId)) { validEdges.push(branchEdge); edgesBySource.get(scene.id).push(branchEdge); }
        else if (branchEdge.targetType === "episode") { validEdges.push(branchEdge); edgesBySource.get(scene.id).push(branchEdge); }
        else brokenEdges.push({ ...branchEdge, reason: branchEdge.targetType === "scene" ? "unknown_scene" : "unknown_target" });
      }
    }
  }

  const reachableSceneIds = new Set();
  const startId = blueprint?.startSceneId;
  if (startId && byId.has(startId)) {
    const queue = [startId]; reachableSceneIds.add(startId);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const id = queue[cursor];
      for (const edge of edgesBySource.get(id) || []) {
        if (edge.targetType === "ending") reachableEndingIds.add(edge.targetId);
        if (edge.targetType === "scene" && !reachableSceneIds.has(edge.targetId)) {
          reachableSceneIds.add(edge.targetId); queue.push(edge.targetId);
        }
      }
    }
  }

  // Tarjan SCC. A cyclic SCC is dangerous only when it has no structural exit.
  let index = 0;
  const stack = [], onStack = new Set(), indices = new Map(), low = new Map(), components = [];
  function strongConnect(id) {
    indices.set(id, index); low.set(id, index); index += 1; stack.push(id); onStack.add(id);
    for (const next of outgoing.get(id) || []) {
      if (!indices.has(next)) { strongConnect(next); low.set(id, Math.min(low.get(id), low.get(next))); }
      else if (onStack.has(next)) low.set(id, Math.min(low.get(id), indices.get(next)));
    }
    if (low.get(id) === indices.get(id)) {
      const members = []; let member;
      do { member = stack.pop(); onStack.delete(member); members.push(member); } while (member !== id);
      components.push(members);
    }
  }
  for (const id of byId.keys()) if (!indices.has(id)) strongConnect(id);
  const cycles = components.filter((members) => members.length > 1 || (outgoing.get(members[0]) || []).includes(members[0])).map((members) => {
    const set = new Set(members);
    const hasExit = members.some((id) => (edgesBySource.get(id) || []).some((e) => e.targetType !== "scene" || !set.has(e.targetId)));
    return { sceneIds: members, hasExit };
  });

  return {
    scenes, endings, byId, endingIds, incoming, outgoing, validEdges, edgesBySource, brokenEdges,
    duplicateSceneIds, reachableSceneIds, reachableEndingIds,
    unreachableSceneIds: new Set([...byId.keys()].filter((id) => !reachableSceneIds.has(id))),
    unreachableEndingIds: new Set([...endingIds].filter((id) => !reachableEndingIds.has(id))),
    deadEndSceneIds: new Set([...byId.keys()].filter((id) => (edgesBySource.get(id)?.length || 0) === 0)),
    cycles,
  };
}
