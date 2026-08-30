import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMindMap, gameFromMindMap, choiceLabel } from '../src/lib/gameStudio/mindMap.js';
import { parseScript } from '../src/lib/gameStudio/scriptParser.js';
const scene = (id, choices = [], extra = {}) => ({ id, text: `Nội dung ${id}`, choices, ...extra });
const choice = (targetNodeId, extra = {}) => ({ text: 'Đi tiếp', targetNodeId, ...extra });

test('preserves all branches, shared destinations, loops and disconnected scenes without mutation', () => {
  const nodes = {
    start_node: scene('start_node', [choice('scene_1')]),
    scene_1: scene('scene_1', [choice('scene_2'), choice('scene_2', { requiresFlag: 'secret' }), choice('end')]),
    scene_2: scene('scene_2', [choice('scene_1'), choice('end')]),
    end: scene('end', [], { isEnding: true }),
    unused: scene('unused', [], { isEnding: true }),
  };
  const before = structuredClone(nodes), map = buildMindMap(nodes);
  assert.deepEqual(nodes, before);
  assert.equal(map.cards.filter((c) => c.kind === 'choice').length, 6);
  assert.equal(map.edges.length, 12);
  assert.equal(map.cards.filter((c) => c.key === 'scene:scene_2').length, 1);
  assert.equal(map.edges.filter((e) => e.to === 'scene:scene_2').length, 2);
  assert.equal(map.cards.find((c) => c.key === 'scene:unused').unreachable, true);
  assert.equal(map.cards.find((c) => c.key === 'scene:end').unreachable, false);
  assert.deepEqual(map.errors, []);
  const positions = new Set(map.cards.map((c) => `${c.x}:${c.y}`));
  assert.equal(positions.size, map.cards.length);
});

test('draws dice outcomes instead of the ignored nominal target and combat defeat as game over', () => {
  const map = buildMindMap({
    start_node: scene('start_node', [choice('ignored', { diceRoll: { successTarget: 'win', failTarget: 'fail' } })], { combat: { winTarget: 'win', fleeTarget: 'fail', loseTarget: 'ignored' } }),
    win: scene('win', [], { isEnding: true }), fail: scene('fail', [], { isEnding: true }),
  });
  assert.deepEqual(map.errors, []);
  assert.ok(map.edges.some((e) => e.label === 'Thành công' && e.to === 'scene:win'));
  assert.ok(map.edges.some((e) => e.label === 'Thất bại' && e.to === 'scene:fail'));
  assert.ok(map.edges.some((e) => e.label === 'Thua trận' && e.to === 'defeat:start_node'));
  assert.ok(!map.edges.some((e) => e.to === 'scene:ignored'));
});

test('missing destinations are shown, never silently repaired, and block rebuild', () => {
  const game = { meta: {}, nodes: { start_node: scene('start_node', [choice('missing'), choice('')]) } };
  const map = buildMindMap(game.nodes);
  assert.equal(map.cards.filter((c) => c.kind === 'missing').length, 2);
  assert.equal(map.errors.length, 2);
  assert.throws(() => gameFromMindMap(game), /không tìm thấy missing/);
  assert.throws(() => gameFromMindMap({ meta: {}, nodes: {} }), /Thiếu cảnh mở đầu/);
});

test('rebuild uses edited nodes and preserves all fields rather than parsing the old source', () => {
  const game = { meta: { sourceScript: 'Outdated source', sourceScriptOutdated: true, statsConfig: [{ key: 'hp' }] }, nodes: {
    start_node: scene('start_node', [choice('end', { requiresFlag: 'seen', npcAffinity: { Lily: 3 }, statModifiers: { hp: -1 } })], { text: 'Đã sửa', systemPopup: { title: 'Hệ thống' }, randomEvents: [{ chance: 0.5, text: 'Mưa' }] }),
    end: scene('end', [], { isEnding: true, endingType: 'TRUE_END' }),
  } };
  const rebuilt = gameFromMindMap(game);
  assert.deepEqual(rebuilt.nodes, game.nodes);
  assert.notEqual(rebuilt.nodes, game.nodes);
  assert.equal(rebuilt.meta.mindMapRevision, 1);
  assert.equal(game.meta.mindMapRevision, undefined);
  assert.equal(gameFromMindMap(rebuilt).meta.mindMapRevision, 2);
});

test('real script import produces introduction, every choice and ending on the map', () => {
  const game = parseScript('## GIỚI THIỆU\nBạn bước vào rừng.\n## CẢNH 1\nCó hai con đường.\n**A —** Đi trái\n→ Đến cảnh 2\n**B —** Đi phải\n→ Đến cảnh 2\n## CẢNH 2\nTới đích.\n**A —** Kết thúc\n→ Kết thúc [GOOD_END]\nBạn về nhà.', { statsConfig: [], initialStats: {} });
  const map = buildMindMap(game.nodes);
  assert.equal(map.cards.filter((c) => c.kind === 'choice').length, Object.values(game.nodes).reduce((sum, n) => sum + n.choices.length, 0));
  assert.deepEqual(map.errors, []);
  assert.deepEqual(gameFromMindMap(game).nodes, game.nodes);
});

test('large branching scripts are not limited to a route sample', () => {
  const nodes = { start_node: scene('start_node', Array.from({ length: 500 }, (_, i) => choice(`end_${i}`))) };
  for (let i = 0; i < 500; i++) nodes[`end_${i}`] = scene(`end_${i}`, [], { isEnding: true });
  const map = buildMindMap(nodes);
  assert.equal(map.cards.length, 1001);
  assert.equal(map.edges.length, 1000);
  assert.equal(choiceLabel(26), 'AA');
});
