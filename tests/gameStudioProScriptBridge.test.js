import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseProScript,
  cleanLine,
  stripBullet,
} from '../src/lib/gameStudioPro/scriptParser.js';
import {
  normalizeProScriptAst,
  finalizeProScriptBlueprint,
} from '../src/lib/gameStudioPro/scriptNormalizer.js';
import { validateParsedScript } from '../src/lib/gameStudioPro/scriptValidator.js';
import { serializeEpisodeBlueprint } from '../src/lib/gameStudioPro/scriptSerializer.js';
import {
  generateExternalAiPrompt,
  generateRepairPrompt,
} from '../src/lib/gameStudioPro/scriptPromptGenerator.js';
import {
  parseAndValidateProScript,
  SCRIPT_HEADER_V1,
  SCRIPT_FORMAT_VERSION,
} from '../src/lib/gameStudioPro/scriptBridge.js';
import {
  SCENE_ROLES,
  newSceneBlueprint,
  addScene,
  addChoice,
  updateChoice,
  connectChoice,
  addEnding,
  findScene,
  setRegistry,
  newOutcomeBranch,
} from '../src/lib/gameStudioPro/blueprintModel.js';
import {
  newEmptyRegistry,
  addStatEntity,
  addRelationshipEntity,
  addFlagEntity,
  addItemEntity,
  ENTITY_KINDS,
} from '../src/lib/gameStudioPro/entityRegistry.js';
import {
  statCompare,
  flagPresent,
  flagAbsent,
  itemPresent,
  statChange,
  grantFlag,
  grantItem,
  removeItem,
  CONDITION_TYPES,
  EFFECT_TYPES,
} from '../src/lib/gameStudioPro/ruleModel.js';
import { compileEpisodeBlueprint } from '../src/lib/gameStudioPro/proCompiler.js';
import { choiceAvailable, buildRoutes } from '../src/lib/gameStudio/routeExplorer.js';
import { gameOverReasons } from '../src/lib/gameStudio/playerState.js';

// =========================================================================
// 1. LEXER & PARSER TESTS
// =========================================================================

test('cleanLine and stripBullet handle markdown, code fences, bullets, and whitespace', () => {
  assert.equal(cleanLine('# CẢNH: Yến tiệc'), 'CẢNH: Yến tiệc');
  assert.equal(cleanLine('### **LỰA CHỌN A:**'), 'LỰA CHỌN A:');
  assert.equal(cleanLine('```markdown'), '');
  assert.equal(cleanLine('```'), '');
  assert.equal(stripBullet('- Uy tín +5'), 'Uy tín +5');
  assert.equal(stripBullet('* Có cờ: Đã cứu Tiểu Lan'), 'Có cờ: Đã cứu Tiểu Lan');
  assert.equal(stripBullet('• Ngọc bội'), 'Ngọc bội');
});

test('parser accepts valid FICTIONWORLD PRO SCRIPT v1 header', () => {
  const script = `${SCRIPT_HEADER_V1}\n\nTẬP: Mở đầu\n\nCẢNH: Cảnh 1\nLOẠI: Kể chuyện\nNỘI DUNG:\nBắt đầu.`;
  const { ast, issues } = parseProScript(script);
  assert.ok(ast);
  assert.equal(ast.version, SCRIPT_FORMAT_VERSION);
  assert.equal(ast.episodeTitle, 'Mở đầu');
  assert.equal(issues.length, 0);
});

test('parser rejects unsupported version with clear error message', () => {
  const script = `FICTIONWORLD PRO SCRIPT v2\n\nTẬP: Mở đầu\n\nCẢNH: Cảnh 1\nLOẠI: Kể chuyện\nNỘI DUNG:\nBắt đầu.`;
  const { ast, issues } = parseProScript(script);
  assert.equal(ast, null);
  assert.ok(issues.some((i) => i.message.includes('chưa được hỗ trợ')));
});

test('parser handles case-insensitivity and markdown wrappers on keywords', () => {
  const script = "```markdown\n" +
`# FICTIONWORLD PRO SCRIPT V1

## TẬP: Nhập cung

**CHỈ SỐ:**
- Sinh tồn = 100 [sinh tồn, ngưỡng 0]
- Uy tín = 10

**QUAN HỆ:**
- Sủng ái Lệ Phi = 0 (NPC: Lệ Phi)

**CỜ:**
- Đã cứu Tiểu Lan

**VẬT PHẨM:**
- Ngọc bội

### CẢNH: Yến tiệc
**LOẠI:** lựa chọn

**NỘI DUNG:**
Lệ Phi hỏi tội.

**LỰA CHỌN A:** Xin lỗi
**HỆ QUẢ:**
- Uy tín +5
**ĐẾN:** Cảnh 2

### CẢNH: Cảnh 2
**LOẠI:** kể chuyện
**NỘI DUNG:**
Kết thúc yến tiệc.
` + "```";

  const { ast, issues } = parseProScript(script);
  assert.ok(ast);
  assert.equal(issues.length, 0);
  assert.equal(ast.episodeTitle, 'Nhập cung');
  assert.equal(ast.stats.length, 2);
  assert.equal(ast.stats[0].name, 'Sinh tồn');
  assert.equal(ast.stats[0].isVital, true);
  assert.equal(ast.stats[0].deathThreshold, 0);
  assert.equal(ast.relationships.length, 1);
  assert.equal(ast.relationships[0].npc, 'Lệ Phi');
  assert.equal(ast.flags.length, 1);
  assert.equal(ast.flags[0].name, 'Đã cứu Tiểu Lan');
  assert.equal(ast.items.length, 1);
  assert.equal(ast.items[0].name, 'Ngọc bội');
  assert.equal(ast.scenes.length, 2);
  assert.equal(ast.scenes[0].role, 'decision');
  assert.equal(ast.scenes[1].role, 'story');
});

test('parser prevents prototype pollution in entity names', () => {
  const script = `${SCRIPT_HEADER_V1}
CHỈ SỐ:
- __proto__ = 100
- constructor = 50
- prototype = 10
CẢNH: Test
LOẠI: Kể chuyện
NỘI DUNG: Test.`;
  const { ast, issues } = parseProScript(script);
  assert.ok(ast);
  assert.equal(ast.stats.length, 0);
  assert.ok(issues.some((i) => /không hợp lệ/.test(i.message)));
});

test('parser enforces safety bounds (max script size & max scenes)', () => {
  const huge = `${SCRIPT_HEADER_V1}\n` + 'A'.repeat(600000);
  const { ast: ast1, issues: issues1 } = parseProScript(huge);
  assert.equal(ast1, null);
  assert.ok(issues1.some((i) => /quá dài/.test(i.message)));

  let manyScenes = `${SCRIPT_HEADER_V1}\nTẬP: Nhiều cảnh\n`;
  for (let i = 1; i <= 105; i++) {
    manyScenes += `\nCẢNH: Cảnh ${i}\nLOẠI: Kể chuyện\nNỘI DUNG: Nội dung ${i}.\n`;
  }
  const { ast: ast2, issues: issues2 } = parseProScript(manyScenes);
  assert.ok(ast2);
  assert.ok(issues2.some((i) => /giới hạn/.test(i.message)));
});

// =========================================================================
// 2. NORMALIZER & ENTITY RESOLUTION TESTS (NO SILENT CREATION)
// =========================================================================

test('normalizer resolves target scene names to stable IDs without guessing', () => {
  const script = `${SCRIPT_HEADER_V1}
TẬP: Thử nghiệm

CẢNH: Khởi đầu
LOẠI: Lựa chọn
NỘI DUNG: Bắt đầu câu chuyện.

LỰA CHỌN A: Rẽ trái
ĐẾN: Cảnh Trái

LỰA CHỌN B: Rẽ phải
ĐẾN: Cảnh Phải

CẢNH: Cảnh Trái
LOẠI: Kể chuyện
NỘI DUNG: Bên trái.

CẢNH: Cảnh Phải
LOẠI: Kể chuyện
NỘI DUNG: Bên phải.`;

  const { ast } = parseProScript(script);
  const { blueprint, issues } = normalizeProScriptAst(ast, { episodeId: 'ep_test' });

  assert.equal(issues.length, 0);
  assert.equal(blueprint.scenes.length, 3);
  const start = blueprint.scenes[0];
  const left = blueprint.scenes[1];
  const right = blueprint.scenes[2];

  assert.equal(start.choices[0].targetType, 'scene');
  assert.equal(start.choices[0].targetId, left.id);
  assert.equal(start.choices[1].targetType, 'scene');
  assert.equal(start.choices[1].targetId, right.id);
});

test('normalizer reports duplicate scene names as line-level errors (ambiguity detection)', () => {
  const script = `${SCRIPT_HEADER_V1}
TẬP: Trùng tên

CẢNH: Yến tiệc
LOẠI: Kể chuyện
NỘI DUNG: Cảnh 1.

CẢNH: Yến tiệc
LOẠI: Lựa chọn
NỘI DUNG: Cảnh 2 trùng tên.`;

  const { ast } = parseProScript(script);
  const { issues } = normalizeProScriptAst(ast, { episodeId: 'ep_test' });
  assert.ok(issues.some((i) => i.line > 0 && /Trùng tên cảnh/.test(i.message)));
});

test('normalizer reports missing target with exact line number', () => {
  const script = `${SCRIPT_HEADER_V1}
TẬP: Lỗi đích

CẢNH: Yến tiệc
LOẠI: Lựa chọn
NỘI DUNG: Gặp Lệ Phi.

LỰA CHỌN A: Cầu cứu
ĐẾN: Gặp Hoàng Hậu`;

  const { ast } = parseProScript(script);
  const { issues } = normalizeProScriptAst(ast, { episodeId: 'ep_test' });
  const missingErr = issues.find((i) => /Không tìm thấy cảnh "Gặp Hoàng Hậu"/.test(i.message));
  assert.ok(missingErr);
  assert.ok(missingErr.line > 0);
});

// =========================================================================
// 3. ENTITY PROPOSAL & NO SILENT CREATION TESTS (HOTFIX 1 & 3)
// =========================================================================

test('entity approval test 1: existing registry has Uy tín, script uses Uy tín >= 20 -> resolves directly, 0 proposals', () => {
  let existingRegistry = newEmptyRegistry();
  existingRegistry = addStatEntity(existingRegistry, { displayName: 'Uy tín', default: 10 });

  const script = `${SCRIPT_HEADER_V1}
TẬP: Test 1
CẢNH: Cảnh 1
LOẠI: Lựa chọn
NỘI DUNG: Test.
LỰA CHỌN A: Đi tiếp
NẾU:
- Uy tín >= 20
ĐẾN: Cảnh 2
CẢNH: Cảnh 2
LOẠI: Kể chuyện
NỘI DUNG: Hết.`;

  const result = parseAndValidateProScript(script, {
    episodeId: 'ep_test',
    existingRegistry,
  });

  assert.equal(result.entityProposals.length, 0);
  assert.equal(result.validation.readyToImport, true);
  assert.equal(result.validation.valid, true);

  const statId = existingRegistry.stats[0].id;
  assert.equal(result.blueprint.scenes[0].choices[0].rules.conditions[0].entityId, statId);
});

test('entity approval test 2: existing registry has Uy tín, script uses Danh vọng >= 20 -> NO silent create, proposal generated, import blocked', () => {
  let existingRegistry = newEmptyRegistry();
  existingRegistry = addStatEntity(existingRegistry, { displayName: 'Uy tín', default: 10 });
  const registrySnapshot = JSON.stringify(existingRegistry);

  const script = `${SCRIPT_HEADER_V1}
TẬP: Test 2
CẢNH: Cảnh 1
LOẠI: Lựa chọn
NỘI DUNG: Test.
LỰA CHỌN A: Đi tiếp
NẾU:
- Danh vọng >= 20
ĐẾN: Cảnh 2
CẢNH: Cảnh 2
LOẠI: Kể chuyện
NỘI DUNG: Hết.`;

  const result = parseAndValidateProScript(script, {
    episodeId: 'ep_test',
    existingRegistry,
  });

  // 1. Không tự động thêm vào registry
  assert.equal(JSON.stringify(existingRegistry), registrySnapshot, 'existingRegistry không bị mutate');
  assert.equal(result.registry.stats.length, 1, 'Registry vẫn chỉ có 1 entity');

  // 2. Tạo proposal và chặn import
  assert.equal(result.entityProposals.length, 1);
  assert.equal(result.entityProposals[0].requestedName, 'Danh vọng');
  assert.equal(result.validation.readyToImport, false);
  assert.equal(result.validation.valid, false);
  assert.equal(result.validation.hasPendingProposals, true);
});

test('entity approval test 3: user maps Danh vọng -> Uy tín -> finalized blueprint uses exact entityId of Uy tín', () => {
  let existingRegistry = newEmptyRegistry();
  existingRegistry = addStatEntity(existingRegistry, { displayName: 'Uy tín', default: 10 });
  const uyTinId = existingRegistry.stats[0].id;

  const script = `${SCRIPT_HEADER_V1}
TẬP: Test 3
CẢNH: Cảnh 1
LOẠI: Lựa chọn
NỘI DUNG: Test.
LỰA CHỌN A: Đi tiếp
NẾU:
- Danh vọng >= 20
ĐẾN: Cảnh 2
CẢNH: Cảnh 2
LOẠI: Kể chuyện
NỘI DUNG: Hết.`;

  const result = parseAndValidateProScript(script, {
    episodeId: 'ep_test',
    existingRegistry,
  });

  const prop = result.entityProposals[0];
  const approvals = {
    [prop.tempKey]: { action: 'map', targetEntityId: uyTinId },
  };

  const finalized = finalizeProScriptBlueprint(result, approvals, {
    existingRegistry,
    episodeId: 'ep_test',
  });

  assert.equal(finalized.registry.stats.length, 1, 'Không tạo stat mới');
  const cond = finalized.blueprint.scenes[0].choices[0].rules.conditions[0];
  assert.equal(cond.entityId, uyTinId, 'Rule sử dụng đúng ID của Uy tín');
});

test('entity approval test 4: user approves create Danh vọng -> entity created ONLY at finalize step', () => {
  let existingRegistry = newEmptyRegistry();
  existingRegistry = addStatEntity(existingRegistry, { displayName: 'Uy tín', default: 10 });

  const script = `${SCRIPT_HEADER_V1}
TẬP: Test 4
CẢNH: Cảnh 1
LOẠI: Lựa chọn
NỘI DUNG: Test.
LỰA CHỌN A: Đi tiếp
NẾU:
- Danh vọng >= 20
ĐẾN: Cảnh 2
CẢNH: Cảnh 2
LOẠI: Kể chuyện
NỘI DUNG: Hết.`;

  const result = parseAndValidateProScript(script, {
    episodeId: 'ep_test',
    existingRegistry,
  });

  assert.equal(result.registry.stats.length, 1, 'Trước finalize, registry chưa có Danh vọng');

  const prop = result.entityProposals[0];
  const approvals = {
    [prop.tempKey]: { action: 'create', config: { displayName: 'Danh vọng', default: 5 } },
  };

  const finalized = finalizeProScriptBlueprint(result, approvals, {
    existingRegistry,
    episodeId: 'ep_test',
  });

  assert.equal(finalized.registry.stats.length, 2, 'Sau finalize, registry có 2 stats');
  const danhVongStat = finalized.registry.stats.find((s) => s.displayName === 'Danh vọng');
  assert.ok(danhVongStat);
  assert.equal(danhVongStat.default, 5);

  const cond = finalized.blueprint.scenes[0].choices[0].rules.conditions[0];
  assert.equal(cond.entityId, danhVongStat.id, 'Rule sử dụng ID mới được tạo của Danh vọng');
});

test('entity approval test 5: flags and items work identically with approval flow', () => {
  let existingRegistry = newEmptyRegistry();
  const script = `${SCRIPT_HEADER_V1}
TẬP: Test Flags & Items
CỜ:
- Đã cứu Tiểu Lan
VẬT PHẨM:
- Ngọc bội
CẢNH: Cảnh 1
LOẠI: Lựa chọn
NỘI DUNG: Test.
LỰA CHỌN A: Đi tiếp
NẾU:
- Có vật phẩm: Ngọc bội
HỆ QUẢ:
- Đặt cờ: Đã cứu Tiểu Lan
ĐẾN: Cảnh 2
CẢNH: Cảnh 2
LOẠI: Kể chuyện
NỘI DUNG: Hết.`;

  const result = parseAndValidateProScript(script, {
    episodeId: 'ep_test',
    existingRegistry,
  });

  assert.equal(result.entityProposals.length, 2);
  assert.equal(result.registry.flags.length, 0);
  assert.equal(result.registry.items.length, 0);

  const approvals = {};
  for (const p of result.entityProposals) {
    approvals[p.tempKey] = { action: 'create' };
  }

  const finalized = finalizeProScriptBlueprint(result, approvals, {
    existingRegistry,
    episodeId: 'ep_test',
  });

  assert.equal(finalized.registry.flags.length, 1);
  assert.equal(finalized.registry.items.length, 1);
  assert.equal(finalized.registry.flags[0].displayName, 'Đã cứu Tiểu Lan');
  assert.equal(finalized.registry.items[0].displayName, 'Ngọc bội');
});

test('entity approval test 6: existingRegistry is NEVER mutated after parse/check/normalize', () => {
  let existingRegistry = newEmptyRegistry();
  existingRegistry = addStatEntity(existingRegistry, { displayName: 'Sinh tồn', default: 100 });
  const snapshot = JSON.stringify(existingRegistry);

  const script = `${SCRIPT_HEADER_V1}
TẬP: Pure Check
CHỈ SỐ:
- Uy tín = 10
- Khí sắc = 50
CỜ:
- Cờ mới
CẢNH: Cảnh 1
LOẠI: Kể chuyện
NỘI DUNG: Test.`;

  parseAndValidateProScript(script, { episodeId: 'ep_1', existingRegistry });
  assert.equal(JSON.stringify(existingRegistry), snapshot);
});

// =========================================================================
// 4. CONDITIONAL OUTCOME & ROUND-TRIP TESTS (HOTFIX 2)
// =========================================================================

test('conditional outcome round-trip: Blueprint -> Serialize -> Parse -> Finalize -> Compile preserves 19 vs 20 semantics', () => {
  let r = newEmptyRegistry();
  r = addStatEntity(r, { displayName: 'Uy tín', default: 10 });
  const uyTin = r.stats[0];

  let bp = newSceneBlueprint({ id: 'ep_cond_rt', title: 'Tập Phản Bác' });
  bp = setRegistry(bp, r);

  bp = addScene(bp, SCENE_ROLES.STORY, { title: 'Cảnh Sau Yến Tiệc' });
  const nextSceneId = bp.scenes[1].id;

  bp = addEnding(bp, { title: 'Bị xử tử', tone: 'death' });
  const deathEndingId = bp.endings[0].id;

  const startId = bp.startSceneId;
  bp = addChoice(bp, startId, { text: 'Phản bác Lệ Phi' });
  const cid = findScene(bp, startId).choices[0].id;

  // Cấu hình:
  // Base choice (else): Uy tín >= 20 -> Uy tín -10 -> Cảnh Sau Yến Tiệc
  // Conditional outcome branch: Uy tín < 20 -> Ending Bị xử tử
  bp = updateChoice(bp, startId, cid, {
    targetType: 'scene',
    targetId: nextSceneId,
    rules: {
      conditions: [statCompare(uyTin.id, '>=', 20)],
      effects: [statChange(uyTin.id, -10)],
    },
    conditionalOutcomes: [
      newOutcomeBranch({
        conditions: [statCompare(uyTin.id, '<', 20)],
        targetType: 'ending',
        targetId: deathEndingId,
      }),
    ],
  });

  // 1. Serialize sang FICTIONWORLD PRO SCRIPT v1
  const serialized = serializeEpisodeBlueprint(bp, { title: 'Tập Phản Bác' });

  // 2. Parse lại
  const parsedResult = parseAndValidateProScript(serialized, {
    episodeId: 'ep_cond_rt',
    existingRegistry: r,
  });

  // 3. Finalize
  const finalized = finalizeProScriptBlueprint(parsedResult, {}, {
    existingRegistry: r,
    episodeId: 'ep_cond_rt',
  });

  // 4. Biên dịch cả 2 và kiểm tra tính nhất quán
  const origCompiled = compileEpisodeBlueprint(bp, { title: 'Tập Phản Bác' });
  const rtCompiled = compileEpisodeBlueprint(finalized.blueprint, { title: 'Tập Phản Bác' });

  const origChoices = origCompiled.nodes.start_node.choices;
  const rtChoices = rtCompiled.nodes.start_node.choices;

  assert.equal(rtChoices.length, origChoices.length, 'Số lượng lựa chọn runtime phải bằng nhau (2)');

  const rtDeathEndingId = finalized.blueprint.endings[0].id;
  const rtNextSceneId = finalized.blueprint.scenes[1].id;

  const origDeath = origChoices.find((c) => c.targetNodeId === deathEndingId);
  const origSurvive = origChoices.find((c) => c.targetNodeId === nextSceneId);
  const rtDeath = rtChoices.find((c) => c.targetNodeId === rtDeathEndingId);
  const rtSurvive = rtChoices.find((c) => c.targetNodeId === rtNextSceneId);

  assert.ok(origDeath && origSurvive);
  assert.ok(rtDeath && rtSurvive);

  // 5. Kiểm tra ranh giới 19 vs 20 điểm Uy tín
  const state19 = { stats: { [uyTin.id]: 19 }, items: new Set(), flags: new Set(), npcAffinity: {} };
  const state20 = { stats: { [uyTin.id]: 20 }, items: new Set(), flags: new Set(), npcAffinity: {} };

  // Tại 19 điểm Uy tín: Phải chết, không được sống
  assert.equal(choiceAvailable(origDeath, state19), true);
  assert.equal(choiceAvailable(origSurvive, state19), false);
  assert.equal(choiceAvailable(rtDeath, state19), true);
  assert.equal(choiceAvailable(rtSurvive, state19), false);

  // Tại 20 điểm Uy tín: Phải sống và bị trừ 10 điểm, không được chết
  assert.equal(choiceAvailable(origDeath, state20), false);
  assert.equal(choiceAvailable(origSurvive, state20), true);
  assert.equal(choiceAvailable(rtDeath, state20), false);
  assert.equal(choiceAvailable(rtSurvive, state20), true);
  assert.equal(rtSurvive.statModifiers[uyTin.id], -10);
});

// =========================================================================
// 5. MANDATORY TEST SCENARIO (Section 32: Hậu Cung — Tập 1: Nhập Cung)
// =========================================================================

test('mandatory scenario: Full Hậu Cung Episode 1 script parses, approves, compiles, and verifies correctly', () => {
  const scriptHauCung = `${SCRIPT_HEADER_V1}

TẬP: Nhập cung

CHỈ SỐ:
- Sinh tồn = 100 [sinh tồn, ngưỡng 0]
- Uy tín = 10

QUAN HỆ:
- Sủng ái Lệ Phi = 0 (NPC: Lệ Phi)

CỜ:
- Đã cứu Tiểu Lan

VẬT PHẨM:
- Ngọc bội

CẢNH: Yến tiệc
LOẠI: Lựa chọn
NỘI DUNG:
Lệ Phi bất ngờ hỏi tội nhân vật chính trước yến tiệc hoàng cung.

LỰA CHỌN A:
Xin lỗi nhún nhường.
HỆ QUẢ:
- Uy tín +5
ĐẾN:
Cảnh Sau Yến Tiệc

LỰA CHỌN B:
Nói đỡ cho Tiểu Lan.
HỆ QUẢ:
- Đặt cờ: Đã cứu Tiểu Lan
- Uy tín +10
ĐẾN:
Cảnh Gặp Tiểu Lan

LỰA CHỌN C:
Đưa tín vật Ngọc bội làm chứng.
NẾU:
- Có vật phẩm: Ngọc bội
HỆ QUẢ:
- Mất vật phẩm: Ngọc bội
- Tăng 8 Sủng ái Lệ Phi
ĐẾN:
Cảnh Sau Yến Tiệc

LỰA CHỌN D:
Phản bác Lệ Phi.
NẾU:
- Uy tín < 20
KẾT THÚC [Chết]:
Bị xử tử

NẾU:
- Uy tín >= 20
HỆ QUẢ:
- Uy tín -10
ĐẾN:
Cảnh Sau Yến Tiệc

CẢNH: Cảnh Gặp Tiểu Lan
LOẠI: Kể chuyện
NỘI DUNG:
Tiểu Lan cảm tạ ơn cứu mạng và trao lại tín vật gia truyền.
HỆ QUẢ:
- Nhận vật phẩm: Ngọc bội
ĐẾN:
Cảnh Sau Yến Tiệc

CẢNH: Cảnh Sau Yến Tiệc
LOẠI: Kể chuyện
NỘI DUNG:
Yến tiệc kết thúc êm thấm. Nhân vật chính an toàn bước vào hậu cung.
ĐẾN:
Qua Ải

CẢNH: Qua Ải
LOẠI: Kết thúc
NỘI DUNG:
Chúc mừng bạn đã vượt qua Tập 1.

KẾT THÚC [Chết]: Bị xử tử
LOẠI: Chết
NỘI DUNG:
Do không đủ uy tín để tự bảo vệ, bạn bị Lệ Phi khép tội khi quân và xử tử ngay tại yến tiệc.`;

  // 1. Phân tích kịch bản
  const parsed = parseAndValidateProScript(scriptHauCung, { episodeId: 'ep_haucung' });
  assert.equal(parsed.entityProposals.length, 5, 'Phải có 5 entity proposals từ header khai báo');
  assert.equal(parsed.validation.readyToImport, false, 'Import bị block khi chưa duyệt proposals');

  // 2. User duyệt tất cả entity được khai báo
  const approvals = {};
  for (const p of parsed.entityProposals) {
    approvals[p.tempKey] = { action: 'create' };
  }

  const finalized = finalizeProScriptBlueprint(parsed, approvals, { episodeId: 'ep_haucung' });
  assert.equal(finalized.blueprint.scenes.length, 4); // Yến tiệc, Cảnh Gặp Tiểu Lan, Cảnh Sau Yến Tiệc, Qua Ải
  assert.equal(finalized.blueprint.endings.length, 1); // Bị xử tử

  // 3. Biên dịch sang runtime GamePlayer
  const { nodes, meta, warnings } = compileEpisodeBlueprint(finalized.blueprint, { title: 'Tập 1 — Nhập cung' });
  assert.equal(warnings.filter((w) => /Thiếu cảnh/.test(w)).length, 0);

  // Kiểm tra Stats Config (Sinh tồn isVital, deathThreshold 0)
  const sinhTonStat = meta.statsConfig.find((s) => s.label === 'Sinh tồn');
  assert.ok(sinhTonStat);
  assert.equal(sinhTonStat.isVital, true);
  assert.equal(sinhTonStat.deathThreshold, 0);

  const uyTinStat = meta.statsConfig.find((s) => s.label === 'Uy tín');
  assert.ok(uyTinStat);
  assert.equal(uyTinStat.default, 10);

  // 4. Kiểm tra các nhánh runtime qua buildRoutes
  const { routes } = buildRoutes(nodes, meta.statsConfig);
  assert.ok(routes.length >= 4);

  // 5. Kiểm tra điều kiện loại trừ lẫn nhau tại lựa chọn Phản bác (19 vs 20 Uy tín)
  const ytsChoices = nodes.start_node.choices;
  const deathChoice = ytsChoices.find((c) => c.statRequirementsMax && c.statRequirementsMax[uyTinStat.key] === 19);
  const surviveChoice = ytsChoices.find((c) => c.statRequirements && c.statRequirements[uyTinStat.key] === 20);

  assert.ok(deathChoice, 'phải có nhánh chết khi Uy tín < 20');
  assert.ok(surviveChoice, 'phải có nhánh sống khi Uy tín >= 20');

  const state19 = { stats: { [uyTinStat.key]: 19 }, items: new Set(), flags: new Set(), npcAffinity: {} };
  const state20 = { stats: { [uyTinStat.key]: 20 }, items: new Set(), flags: new Set(), npcAffinity: {} };

  assert.equal(choiceAvailable(deathChoice, state19), true);
  assert.equal(choiceAvailable(surviveChoice, state19), false);
  assert.equal(choiceAvailable(deathChoice, state20), false);
  assert.equal(choiceAvailable(surviveChoice, state20), true);

  // 6. Kiểm tra Game Over vì Sinh tồn
  assert.equal(gameOverReasons({ [sinhTonStat.key]: 100 }, meta.statsConfig).length, 0);
  assert.equal(gameOverReasons({ [sinhTonStat.key]: 0 }, meta.statsConfig).length, 1);
});

// =========================================================================
// 6. AI PROMPT GENERATOR & REPAIR PROMPT TESTS
// =========================================================================

test('generateExternalAiPrompt produces neutral, provider-agnostic prompt', () => {
  const prompt = generateExternalAiPrompt({
    mode: 'full_episode',
    episode: { title: 'Nhập cung', summary: 'Màn ra mắt tại hậu cung.' },
  });

  assert.ok(prompt.includes('Bạn là biên kịch game tương tác chuyên nghiệp'));
  assert.ok(!prompt.includes('Claude hãy'));
  assert.ok(!prompt.includes('ChatGPT hãy'));
  assert.ok(prompt.includes(SCRIPT_HEADER_V1));
  assert.ok(prompt.includes('Nhập cung'));
});

test('generateRepairPrompt includes line-level errors and original script', () => {
  const repair = generateRepairPrompt({
    validationIssues: [
      { line: 15, message: 'Không tìm thấy cảnh "Gặp Hoàng Hậu".' },
      { line: 22, message: 'Trùng tên cảnh "Yến tiệc".' },
    ],
    originalScript: 'CẢNH: Yến tiệc...',
  });

  assert.ok(repair.includes('Dòng 15: Không tìm thấy cảnh "Gặp Hoàng Hậu".'));
  assert.ok(repair.includes('Dòng 22: Trùng tên cảnh "Yến tiệc".'));
  assert.ok(repair.includes('CẢNH: Yến tiệc...'));
  assert.ok(repair.includes(SCRIPT_HEADER_V1));
});
