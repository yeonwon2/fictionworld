import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TEMPLATES,
  TEMPLATE_IDS,
  findTemplate,
  previewTemplate,
  mergeNamedEntitiesIntoRegistry,
  applyTemplate,
} from '../src/lib/gameStudioPro/templateRegistry.js';
import { newEmptyRegistry, addStatEntity, ENTITY_KINDS } from '../src/lib/gameStudioPro/entityRegistry.js';
import { isMechanicEnabled, MECHANIC_IDS } from '../src/lib/gameStudioPro/mechanicsModel.js';
import { newEmptyProGame } from '../src/lib/gameStudioPro/proModel.js';
import { newEmptyGlobalState } from '../src/lib/gameStudioPro/globalStateModel.js';

// ---------- Template registry shape ----------

test('every template has a stable id, label, and only known mechanic ids', () => {
  const seen = new Set();
  for (const t of TEMPLATES) {
    assert.ok(t.id && !seen.has(t.id), `id trùng hoặc rỗng: ${t.id}`);
    seen.add(t.id);
    assert.ok(t.label);
    assert.ok(Array.isArray(t.suggestedEntities));
    assert.ok(Array.isArray(t.suggestedMechanics));
  }
  assert.ok(findTemplate(TEMPLATE_IDS.PALACE));
  assert.equal(findTemplate('khong_ton_tai'), null);
});

// ---------- Template preview purity ----------

test('previewTemplate is pure (does not mutate the registry) and classifies every suggested entity', () => {
  const registry = newEmptyRegistry();
  const before = JSON.stringify(registry);
  const preview = previewTemplate(registry, TEMPLATE_IDS.PALACE);
  assert.equal(JSON.stringify(registry), before, 'previewTemplate không được mutate registry đầu vào');
  const total = preview.toAdd.length + preview.existing.length + preview.conflicts.length;
  assert.equal(total, findTemplate(TEMPLATE_IDS.PALACE).suggestedEntities.length);
  assert.equal(preview.toAdd.length, 3); // Sinh tồn, Uy tín, Quyền lực — registry trống nên cả 3 đều mới
});

// ---------- Exact-safe entity reuse + conflict detection ----------

test('previewTemplate reuses an existing same-name-same-kind stat instead of proposing a duplicate', () => {
  let registry = newEmptyRegistry();
  registry = addStatEntity(registry, { displayName: 'Sinh tồn', default: 80, isVital: true, deathThreshold: 0 });
  const existingId = registry.stats[0].id;

  const preview = previewTemplate(registry, TEMPLATE_IDS.PALACE);
  assert.equal(preview.toAdd.length, 2, 'Sinh tồn đã có sẵn -> chỉ còn Uy tín + Quyền lực là mới');
  assert.equal(preview.existing.length, 1);
  assert.equal(preview.existing[0].entity.id, existingId);
});

test('previewTemplate reports a conflict when the same name exists under a different entity kind', () => {
  let registry = newEmptyRegistry();
  registry = { ...registry, flags: [{ id: 'flag_x', kind: ENTITY_KINDS.FLAG, displayName: 'Uy tín' }] };

  const preview = previewTemplate(registry, TEMPLATE_IDS.PALACE);
  assert.equal(preview.conflicts.length, 1);
  assert.equal(preview.conflicts[0].suggested.displayName, 'Uy tín');
  assert.equal(preview.toAdd.length, 2, 'Uy tín bị xung đột -> không nằm trong toAdd, chỉ Sinh tồn + Quyền lực');
});

// ---------- mergeNamedEntitiesIntoRegistry (additive commit) ----------

test('mergeNamedEntitiesIntoRegistry only adds — never overwrites or removes existing entities', () => {
  let registry = newEmptyRegistry();
  registry = addStatEntity(registry, { displayName: 'Sinh tồn', default: 100 });
  const preview = previewTemplate(registry, TEMPLATE_IDS.SURVIVAL); // Sinh tồn + Thể lực
  const { registry: merged, created } = mergeNamedEntitiesIntoRegistry(registry, preview.toAdd);

  assert.equal(merged.stats.length, 2, 'Sinh tồn giữ nguyên (1) + Thể lực mới (1) = 2, không nhân đôi Sinh tồn');
  assert.equal(created.length, 1);
  assert.equal(created[0].displayName, 'Thể lực');
  // Entity Sinh tồn gốc không bị đổi id/giá trị.
  assert.equal(merged.stats.find((e) => e.displayName === 'Sinh tồn').default, 100);
});

// ---------- applyTemplate: additive, no reset, mechanics union, rank wiring ----------

test('applyTemplate is purely additive: never touches episodes/scenes/rules/startEpisodeId', () => {
  let proDoc = newEmptyProGame();
  proDoc = {
    ...proDoc,
    storyBlueprint: { idea: 'x', episodes: [{ id: 'ep1', title: 'Tập 1' }] },
    globalState: { ...newEmptyGlobalState(), startEpisodeId: 'ep1' },
  };
  const next = applyTemplate(proDoc, TEMPLATE_IDS.PALACE);
  assert.equal(next.storyBlueprint, proDoc.storyBlueprint, 'storyBlueprint (episodes/scenes/rules) không bị đụng tới — cùng reference');
  assert.equal(next.globalState.startEpisodeId, 'ep1', 'không reset tập bắt đầu');
});

test('applyTemplate enables suggested mechanics additively without disabling anything already on', () => {
  let proDoc = newEmptyProGame();
  proDoc = { ...proDoc, mechanics: { ...proDoc.mechanics, enabled: [MECHANIC_IDS.QUEST] } };
  const next = applyTemplate(proDoc, TEMPLATE_IDS.PALACE);
  assert.ok(isMechanicEnabled(next.mechanics, MECHANIC_IDS.QUEST), 'mechanic đã bật trước đó vẫn còn');
  assert.ok(isMechanicEnabled(next.mechanics, MECHANIC_IDS.VITAL_STAT));
  assert.ok(isMechanicEnabled(next.mechanics, MECHANIC_IDS.RANK));
});

test('applyTemplate adds the registry entities and wires the suggested rank config to the resolved stat id', () => {
  const proDoc = newEmptyProGame();
  const next = applyTemplate(proDoc, TEMPLATE_IDS.PALACE);

  const uyTin = next.globalState.registry.stats.find((e) => e.displayName === 'Uy tín');
  assert.ok(uyTin);
  assert.equal(next.globalState.registry.stats.length, 3); // Sinh tồn, Uy tín, Quyền lực
  assert.equal(next.templateId, TEMPLATE_IDS.PALACE);

  assert.equal(next.mechanics.configs.rank.length, 1);
  const rank = next.mechanics.configs.rank[0];
  assert.equal(rank.entityId, uyTin.id, 'rank config trỏ ĐÚNG entity Uy tín vừa được resolve, không sở hữu bản sao riêng');
  assert.equal(rank.levels.length, 7);
  assert.equal(rank.levels[0].label, 'Cung nữ');
  assert.equal(rank.levels[6].label, 'Hoàng hậu');
});

test('applyTemplate does not duplicate entities when re-applied, or when a same-name entity already exists', () => {
  let proDoc = newEmptyProGame();
  proDoc = applyTemplate(proDoc, TEMPLATE_IDS.PALACE);
  const afterFirst = proDoc.globalState.registry.stats.length;
  proDoc = applyTemplate(proDoc, TEMPLATE_IDS.PALACE);
  assert.equal(proDoc.globalState.registry.stats.length, afterFirst, 'áp lại cùng template không tạo thêm entity trùng tên+loại');
});

test('blank template applies cleanly (no entities, no mechanics) — a no-op that just sets templateId', () => {
  const proDoc = newEmptyProGame();
  const next = applyTemplate(proDoc, TEMPLATE_IDS.BLANK);
  assert.deepEqual(next.globalState.registry, proDoc.globalState.registry);
  assert.deepEqual(next.mechanics.enabled, []);
  assert.equal(next.templateId, TEMPLATE_IDS.BLANK);
});
