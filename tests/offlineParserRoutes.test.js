import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScript } from '../src/lib/gameStudio/scriptParser.js';
import { parseSystemScript } from '../src/lib/gameStudio/systemScriptParser.js';
import { parsePalaceScript } from '../src/lib/gameStudio/palaceScriptParser.js';
import { parseRebirthScript } from '../src/lib/gameStudio/rebirthScriptParser.js';
import { gameOverReasons } from '../src/lib/gameStudio/playerState.js';
import { buildMindMap } from '../src/lib/gameStudio/mindMap.js';
import { walkCounts } from '../src/lib/gameStudio/mindMapWalk.js';
for (const parse of [parseScript, parseSystemScript, parsePalaceScript, parseRebirthScript]) {
  test(`${parse.name}: no-intro return to first scene remains playable`, () => {
    const game = parse('## CẢNH 1\nBạn bước vào rừng.\nA — Đi tiếp\n→ Đến cảnh 2\n## CẢNH 2\nBạn đứng ở ngã rẽ.\nA — Quay lại\n→ Đến cảnh 1\nB — Kết thúc\n→ Kết thúc het\n## KẾT THÚC het — Hết [GOOD_END]\nHoàn tất.');
    assert.equal(game.nodes.scene_2.choices[0].targetNodeId, 'start_node');
    assert.equal(game.nodes.start_node.choices[0].targetNodeId, 'scene_2');
    assert.ok(!game.nodes.broken_link_end);
  });
  test(`${parse.name}: preserves a 16-scene sequential script without stopping at eight`, () => {
    const source = '## GIỚI THIỆU\nBắt đầu.\n' + Array.from({ length: 16 }, (_, i) => `## CẢNH ${i + 1}\nNội dung ${i + 1}.\nA — Tiếp tục\n→ ${i < 15 ? `Đến cảnh ${i + 2}` : 'Kết thúc het'}`).join('\n') + '\n## KẾT THÚC het — Hết [GOOD_END]\nHoàn tất.';
    const game = parse(source);
    let id = game.nodes.start_node.choices[0].targetNodeId;
    for (let i = 1; i <= 16; i++) {
      assert.equal(id, `scene_${i}`);
      assert.equal(game.nodes[id].isEnding, false);
      id = game.nodes[id].choices[0].targetNodeId;
    }
    assert.equal(game.nodes[id].isEnding, true);
  });
}
test('a vital stat can stop gameplay on eighth choice while sixteen structural scenes exist', () => {
  const stats = { health: 50 }, config = [{ key: 'health', label: 'Sức khỏe', isVital: true }];
  for (let i = 1; i <= 8; i++) {
    stats.health -= 7;
    assert.equal(gameOverReasons(stats, config).length, i < 8 ? 0 : 1);
  }
  assert.deepEqual(gameOverReasons(stats, config)[0], { key: 'health', label: 'Sức khỏe', value: -6, threshold: 0 });
});
test('fifteen map boxes can represent eight scenes, not fifteen scenes', () => {
  const nodes = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`scene_${i + 1}`, { id: `scene_${i + 1}`, text: '', choices: i < 7 ? [{ text: 'Tiếp', targetNodeId: `scene_${i + 2}` }] : [] }]));
  const trail = Array.from({ length: 8 }, (_, i) => [`scene:scene_${i + 1}`, ...(i < 7 ? [`choice:scene_${i + 1}:0`] : [])]).flat();
  assert.equal(trail.length, 15);
  assert.deepEqual(walkCounts(buildMindMap(nodes), trail), { scenes: 8, choices: 7, intros: 0, endings: 0 });
});
