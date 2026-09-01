import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseProScript,
  cleanLine,
  stripBullet,
} from '../src/lib/gameStudioPro/scriptParser.js';
import { normalizeProScriptAst } from '../src/lib/gameStudioPro/scriptNormalizer.js';
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
// 2. NORMALIZER & ENTITY RESOLUTION TESTS
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

test('normalizer handles conditional outcomes (multiple NẾU in one choice)', () => {
  const script = `${SCRIPT_HEADER_V1}
TẬP: Rẽ nhánh điều kiện

CHỈ SỐ:
- Uy tín = 10

CẢNH: Yến tiệc
LOẠI: Lựa chọn
NỘI DUNG: Lệ Phi hỏi tội.

LỰA CHỌN D: Phản bác Lệ Phi
NẾU:
- Uy tín < 20
KẾT THÚC [Chết]: Bị xử tử

NẾU:
- Uy tín >= 20
HỆ QUẢ:
- Uy tín -10
ĐẾN: Cảnh Sau Yến Tiệc

CẢNH: Cảnh Sau Yến Tiệc
LOẠI: Kể chuyện
NỘI DUNG: An toàn qua ải.

KẾT THÚC: Bị xử tử
LOẠI: Chết
NỘI DUNG: Bị xử trảm.`;

  const { ast } = parseProScript(script);
  const { blueprint, issues } = normalizeProScriptAst(ast, { episodeId: 'ep_test' });
  assert.equal(issues.length, 0);

  const scene1 = blueprint.scenes[0];
  const choiceD = scene1.choices[0];
  assert.ok(choiceD);
  assert.equal(choiceD.conditionalOutcomes.length, 1);

  // Nhánh 1 (trong conditionalOutcomes): Uy tín < 20 -> Ending Bị xử tử
  const branch1 = choiceD.conditionalOutcomes[0];
  assert.equal(branch1.conditions.length, 1);
  assert.equal(branch1.conditions[0].operator, '<');
  assert.equal(branch1.conditions[0].value, 20);
  assert.equal(branch1.targetType, 'ending');

  // Nhánh chính (else / nhánh 2): Uy tín >= 20 -> Uy tín -10 -> Cảnh Sau Yến Tiệc
  assert.equal(choiceD.rules.conditions.length, 1);
  assert.equal(choiceD.rules.conditions[0].operator, '>=');
  assert.equal(choiceD.rules.conditions[0].value, 20);
  assert.equal(choiceD.rules.effects.length, 1);
  assert.equal(choiceD.rules.effects[0].amount, -10);
  assert.equal(choiceD.targetType, 'scene');
});

// =========================================================================
// 3. VALIDATOR & LINE-LEVEL ISSUES TESTS
// =========================================================================

test('validator aggregates line-level errors, warnings, and returns stats', () => {
  const script = `${SCRIPT_HEADER_V1}
TẬP: Kiểm định

CHỈ SỐ:
- Uy tín = 10

CẢNH: Cảnh 1
LOẠI: Lựa chọn
NỘI DUNG: Cảnh mở đầu.

LỰA CHỌN A: Đi tiếp
ĐẾN: Cảnh Không Tồn Tại`;

  const result = parseAndValidateProScript(script, { episodeId: 'ep_1' });
  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((e) => e.line === 12 && /Không tìm thấy cảnh/.test(e.message)));
  assert.equal(result.validation.stats.sceneCount, 1);
  assert.equal(result.validation.stats.choiceCount, 1);
  assert.equal(result.validation.stats.statCount, 1);
});

// =========================================================================
// 4. SERIALIZER & BIDIRECTIONAL ROUND-TRIP TESTS
// =========================================================================

test('serializer exports blueprint to valid FICTIONWORLD PRO SCRIPT v1 text', () => {
  let r = newEmptyRegistry();
  r = addStatEntity(r, { displayName: 'Sinh tồn', default: 100, isVital: true, deathThreshold: 0 });
  r = addStatEntity(r, { displayName: 'Uy tín', default: 10 });
  r = addRelationshipEntity(r, { displayName: 'Sủng ái Lệ Phi', npc: 'Lệ Phi', default: 0 });
  r = addFlagEntity(r, 'Đã cứu Tiểu Lan');
  r = addItemEntity(r, 'Ngọc bội');

  let bp = newSceneBlueprint({ id: 'ep_roundtrip', title: 'Tập Roundtrip' });
  bp = setRegistry(bp, r);

  // Tạo scene 1 & scene 2
  let s2 = addScene(bp, SCENE_ROLES.STORY, { title: 'Cảnh Kế' });
  bp = s2;
  const targetId = bp.scenes[1].id;

  const startId = bp.startSceneId;
  bp = addChoice(bp, startId, { text: 'Đi tiếp sang Cảnh Kế' });
  const cid = findScene(bp, startId).choices[0].id;
  bp = connectChoice(bp, startId, cid, 'scene', targetId);
  bp = updateChoice(bp, startId, cid, {
    rules: {
      conditions: [statCompare(r.stats[1].id, '>=', 20), flagPresent(r.flags[0].id), itemPresent(r.items[0].id)],
      effects: [statChange(r.stats[1].id, -5), grantFlag(r.flags[0].id), removeItem(r.items[0].id)],
    },
  });

  const serialized = serializeEpisodeBlueprint(bp, { title: 'Tập Roundtrip' });
  assert.ok(serialized.startsWith(SCRIPT_HEADER_V1));
  assert.ok(serialized.includes('TẬP: Tập Roundtrip'));
  assert.ok(serialized.includes('Sinh tồn = 100 [sinh tồn, ngưỡng 0]'));
  assert.ok(serialized.includes('Uy tín >= 20'));
  assert.ok(serialized.includes('Có cờ: Đã cứu Tiểu Lan'));
  assert.ok(serialized.includes('Có vật phẩm: Ngọc bội'));
  assert.ok(serialized.includes('Uy tín -5'));
  assert.ok(serialized.includes('Mất vật phẩm: Ngọc bội'));
});

test('round-trip: Blueprint -> Serialize -> Parse -> Compile yields identical runtime behavior', () => {
  let r = newEmptyRegistry();
  r = addStatEntity(r, { displayName: 'Sinh tồn', default: 100, isVital: true, deathThreshold: 0 });
  r = addStatEntity(r, { displayName: 'Uy tín', default: 10 });
  r = addRelationshipEntity(r, { displayName: 'Sủng ái Lệ Phi', npc: 'Lệ Phi', default: 0 });
  r = addFlagEntity(r, 'Đã cứu Tiểu Lan');
  r = addItemEntity(r, 'Ngọc bội');

  let bp = newSceneBlueprint({ id: 'ep_rt', title: 'Tập Roundtrip' });
  bp = setRegistry(bp, r);

  bp = addScene(bp, SCENE_ROLES.STORY, { title: 'Cảnh 2' });
  const scene2Id = bp.scenes[1].id;

  bp = addEnding(bp, { title: 'Bị xử tử', tone: 'death' });
  const endingId = bp.endings[0].id;

  const startId = bp.startSceneId;
  bp = addChoice(bp, startId, { text: 'Lựa chọn Phản bác' });
  const cid = findScene(bp, startId).choices[0].id;

  bp = updateChoice(bp, startId, cid, {
    targetType: 'scene',
    targetId: scene2Id,
    rules: {
      conditions: [statCompare(r.stats[1].id, '>=', 20)],
      effects: [statChange(r.stats[1].id, -10)],
    },
    conditionalOutcomes: [
      newOutcomeBranch({
        conditions: [statCompare(r.stats[1].id, '<', 20)],
        targetType: 'ending',
        targetId: endingId,
      }),
    ],
  });

  // 1. Serialize
  const text = serializeEpisodeBlueprint(bp, { title: 'Tập Roundtrip' });

  // 2. Parse back
  const { blueprint: importedBp, validation } = parseAndValidateProScript(text, { episodeId: 'ep_rt' });
  assert.equal(validation.valid, true);
  assert.equal(importedBp.scenes.length, bp.scenes.length);
  assert.equal(importedBp.endings.length, bp.endings.length);

  // 3. Compile both and compare runtime behavior
  const compiledOrig = compileEpisodeBlueprint(bp, { title: 'Tập Roundtrip' });
  const compiledImp = compileEpisodeBlueprint(importedBp, { title: 'Tập Roundtrip' });

  assert.equal(compiledOrig.meta.statsConfig.length, compiledImp.meta.statsConfig.length);
  assert.equal(compiledOrig.nodes.start_node.choices.length, compiledImp.nodes.start_node.choices.length);
});

// =========================================================================
// 5. MANDATORY TEST SCENARIO (Section 32: Hậu Cung — Tập 1: Nhập Cung)
// =========================================================================

test('mandatory scenario: Full Hậu Cung Episode 1 script parses, compiles, and verifies correctly', () => {
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
  const { blueprint, validation } = parseAndValidateProScript(scriptHauCung, { episodeId: 'ep_haucung' });
  assert.equal(validation.valid, true, `Validation errors: ${JSON.stringify(validation.errors)}`);
  assert.equal(validation.stats.sceneCount, 4); // Yến tiệc, Cảnh Gặp Tiểu Lan, Cảnh Sau Yến Tiệc, Qua Ải
  assert.equal(validation.stats.endingCount, 1); // Bị xử tử

  // 2. Biên dịch sang runtime GamePlayer
  const { nodes, meta, warnings } = compileEpisodeBlueprint(blueprint, { title: 'Tập 1 — Nhập cung' });
  assert.equal(warnings.filter((w) => /Thiếu cảnh/.test(w)).length, 0);

  // Kiểm tra Stats Config (Sinh tồn isVital, deathThreshold 0)
  const sinhTonStat = meta.statsConfig.find((s) => s.label === 'Sinh tồn');
  assert.ok(sinhTonStat);
  assert.equal(sinhTonStat.isVital, true);
  assert.equal(sinhTonStat.deathThreshold, 0);

  const uyTinStat = meta.statsConfig.find((s) => s.label === 'Uy tín');
  assert.ok(uyTinStat);
  assert.equal(uyTinStat.default, 10);

  // 3. Kiểm tra các nhánh runtime qua buildRoutes
  const { routes } = buildRoutes(nodes, meta.statsConfig);
  assert.ok(routes.length >= 4);

  // 4. Kiểm tra điều kiện loại trừ lẫn nhau tại lựa chọn Phản bác (19 vs 20 Uy tín)
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

  // 5. Kiểm tra Game Over vì Sinh tồn
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
