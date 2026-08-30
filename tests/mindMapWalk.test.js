import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMindMap } from '../src/lib/gameStudio/mindMap.js';
import { beginWalk, advanceWalk, walkGraph } from '../src/lib/gameStudio/mindMapWalk.js';
const choice = (text, targetNodeId) => ({ text, targetNodeId });
const graph = buildMindMap({
  start_node: { id: 'start_node', text: 'Mở đầu', choices: [choice('Bắt đầu', 'scene_1')] },
  scene_1: { id: 'scene_1', text: 'Cảnh 1', choices: [choice('Trái', 'scene_2'), choice('Phải', 'end')] },
  scene_2: { id: 'scene_2', text: 'Cảnh 2', choices: [choice('Về đầu', 'scene_1'), choice('Kết thúc', 'end'), { text: 'Thử', diceRoll: { successTarget: 'end', failTarget: 'scene_1' } }] },
  end: { id: 'end', text: 'Hết', isEnding: true, choices: [] },
});
const edgeTo = (from, to) => graph.edges.find((edge) => edge.from === from && edge.to === to);
test('walk 1A then 2B includes only chosen scenes and choices', () => {
  const initial = beginWalk(graph, 'choice:scene_1:0');
  assert.deepEqual(initial, ['scene:scene_1', 'choice:scene_1:0', 'scene:scene_2']);
  const next = advanceWalk(graph, initial, edgeTo('scene:scene_2', 'choice:scene_2:1'));
  assert.deepEqual(next, [...initial, 'choice:scene_2:1', 'scene:end']);
  const view = walkGraph(graph, next);
  assert.equal(view.cards.length, 5);
  assert.equal(view.edges.length, 4);
  assert.ok(!view.cards.some((card) => card.canonicalKey === 'choice:scene_1:1'));
});
test('revisiting a scene gets a distinct visual occurrence and allows changing history', () => {
  const initial = beginWalk(graph, 'choice:scene_1:0');
  const loop = advanceWalk(graph, initial, edgeTo('scene:scene_2', 'choice:scene_2:0'));
  const view = walkGraph(graph, loop);
  assert.equal(view.cards.filter((card) => card.sceneId === 'scene_1' && card.kind === 'scene').length, 2);
  assert.equal(new Set(view.cards.map((card) => card.key)).size, view.cards.length);
  const changed = advanceWalk(graph, loop.slice(0, 1), edgeTo('scene:scene_1', 'choice:scene_1:1'));
  assert.deepEqual(changed, ['scene:scene_1', 'choice:scene_1:1', 'scene:end']);
});
test('dice outcomes require explicit choice; invalid edges cannot jump to other scenes', () => {
  const initial = beginWalk(graph, 'choice:scene_2:2');
  assert.deepEqual(initial, ['scene:scene_2', 'choice:scene_2:2']);
  const next = advanceWalk(graph, initial, edgeTo('choice:scene_2:2', 'scene:end'));
  assert.equal(next.at(-1), 'scene:end');
  assert.deepEqual(advanceWalk(graph, initial, { from: 'choice:scene_2:2', to: 'scene:start_node' }), initial);
});
test('starting at intro, missing target and combat outcomes preserve actual graph', () => {
  assert.deepEqual(beginWalk(graph), ['scene:start_node']);
  const special = buildMindMap({ start_node: { id: 'start_node', text: '', choices: [choice('Sai', 'gone')], combat: { winTarget: 'start_node' } } });
  const missing = beginWalk(special, 'choice:start_node:0');
  assert.equal(walkGraph(special, missing).cards.at(-1).kind, 'missing');
  const defeat = special.edges.find((edge) => edge.label === 'Thua trận');
  assert.equal(walkGraph(special, advanceWalk(special, beginWalk(special), defeat)).cards.at(-1).kind, 'combat');
});
test('starting from a scene immediately shows selectable next branches outside its prose', () => {
  const trail = beginWalk(graph, 'scene:scene_1');
  const view = walkGraph(graph, trail, true);
  assert.equal(view.cards.length, 3);
  assert.equal(view.cards[0].canonicalKey, 'scene:scene_1');
  assert.deepEqual(view.cards.filter((card) => card.previewEdge).map((card) => card.canonicalKey), ['choice:scene_1:0', 'choice:scene_1:1']);
  assert.equal(view.edges.length, 2);
  const next = advanceWalk(graph, trail, view.cards[1].previewEdge);
  assert.equal(next.at(-1), 'scene:scene_2');
  assert.ok(!next.includes('choice:scene_1:1'));
});
