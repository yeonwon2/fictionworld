import test from 'node:test';
import assert from 'node:assert/strict';
import { findingLocations } from '../src/lib/gameStudio/qaLocations.js';
import { buildGameTestReport } from '../src/lib/gameStudio/gameTestReport.js';
const nodes = {
  start_node: { id: 'start_node', text: 'Mở đầu', choices: [{ text: 'Đi tiếp', targetNodeId: 'scene_1' }] },
  scene_1: { id: 'scene_1', text: 'Cảnh 1', choices: [{ text: 'Mở cửa', targetNodeId: 'missing' }, { text: 'Đi tiếp', targetNodeId: 'end', grantItem: 'Khóa' }] },
  end: { id: 'end', text: 'Hết', isEnding: true, choices: [] },
};
test('real QA missing-link finding points to original choice, not repaired ending', () => {
  const report = buildGameTestReport({ meta: { statsConfig: [] }, nodes }, { runsPerPersona: 1 });
  const finding = report.findings.find((f) => f.message.includes('nhưng không tồn tại'));
  assert.ok(finding);
  assert.equal(findingLocations(finding, nodes)[0].key, 'choice:scene_1:0');
});
test('scene issue, global issue and missing destination fallback', () => {
  assert.equal(findingLocations({ sceneIds: ['end'] }, nodes)[0].key, 'scene:end');
  assert.deepEqual(findingLocations({ message: 'Vấn đề cấu hình' }, nodes), []);
  assert.equal(findingLocations({ sceneIds: ['missing'] }, nodes)[0].key, 'choice:scene_1:0');
});
test('balance route starts at final choice and exposes related steps', () => {
  const result = findingLocations({ category: 'balance', route: [{ sceneId: 'start_node', choiceIndex: 0 }, { sceneId: 'scene_1', choiceIndex: 1 }] }, nodes);
  assert.deepEqual(result.map((location) => location.key), ['choice:scene_1:1', 'choice:start_node:0']);
});
test('orphan items and disconnected scenes retain locations on original map', () => {
  assert.equal(findingLocations({ orphan: { kind: 'item', name: 'Khóa' } }, nodes)[0].key, 'choice:scene_1:1');
  assert.equal(findingLocations({ message: 'Cảnh đã bị bỏ đi: scene_1, end.' }, nodes).length, 2);
});
test('duplicate choice text exposes both candidates rather than guessing', () => {
  const result = findingLocations({ sceneIds: ['custom'], message: 'Cảnh "custom" — lựa chọn "Giống nhau": sai.' }, { custom: { choices: [{ text: 'Giống nhau' }, { text: 'Giống nhau' }] } });
  assert.deepEqual(result.map((location) => location.choiceIndex), [0, 1]);
});
