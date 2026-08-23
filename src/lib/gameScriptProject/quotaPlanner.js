const clean = (value) => String(value || "").trim();

export function estimateGeminiCalls({ sceneCount = 0, branchCount = 0, existingScenes = 0, missingDraftScenes = 0 } = {}) {
  const remainingScenes = Math.max(0, Number(sceneCount) - Number(existingScenes));
  const planCalls = existingScenes ? Math.ceil(remainingScenes / 8) : 1 + Math.ceil(remainingScenes / 8);
  const draftCalls = Math.ceil(Math.max(0, Number(missingDraftScenes)) / 6);
  return { core: existingScenes ? 0 : 1, plan: Math.max(0, planCalls - (existingScenes ? 0 : 1)), drafts: draftCalls, final: 0, total: planCalls + draftCalls, branches: Number(branchCount) || 0 };
}

function normalizeEffectPart(raw) {
  const line = clean(raw).replace(/^→\s*/, "").replace(/[.。]+$/, "");
  if (!line || /^(?:hướng tới|tiến tới|mở đường tới|tăng tiến trình)\s+(?:kết thúc|ending)/i.test(line)) return [];
  if (/^(?:vật phẩm|cờ|flag|item|cần\s|yêu cầu\s|mất\s+(?:vật phẩm|item))/i.test(line) || /(?:[+\-]\s*\d+|>=?\s*-?\d+|<=?\s*-?\d+)$/i.test(line)) return [`→ ${line}`];
  const useFlag = line.match(/^(?:sử dụng|dùng|kiểm tra)\s+cờ\s*:?\s*(.+)$/i);
  if (useFlag) return [`→ Cờ: ${clean(useFlag[1])}`];
  const results = [];
  for (const part of line.split(/[,،]+/)) {
    const delta = clean(part).match(/^(tăng|cập nhật|cộng|giảm|trừ)\s+(.+)$/i);
    if (!delta) continue;
    const name = clean(delta[2]).replace(/^(?:chỉ số)\s+/i, "");
    if (!name || /^(?:tiến trình|kết thúc|ending)$/i.test(name)) continue;
    results.push(`→ ${name} ${/^(?:giảm|trừ)$/i.test(delta[1]) ? "-" : "+"}5`);
  }
  return results;
}

export function effectLines(effect) {
  return clean(effect).split(/[;\n]+/).flatMap(normalizeEffectPart);
}

function endingParts(value) {
  const parts = clean(value).split(/\s+[—–]\s+/, 2);
  return { label: clean(parts[0]), title: clean(parts[1]) };
}

export function compileFinalScriptLocally({ project = {}, meta = {}, scenes = [], draftByScene = new Map() } = {}) {
  const sorted = scenes.slice().sort((a, b) => Number(a.scene_order) - Number(b.scene_order));
  const player = clean(project.player_name) || "Nhân vật chính";
  const quest = clean(project.main_quest) || "hoàn thành nhiệm vụ chính";
  const description = clean(project.player_desc).replace(/[.。]+$/, "");
  const questText = quest.replace(/[.。]+$/, "");
  const intro = description ? `${player} — ${description}. Nhiệm vụ chính: ${questText}.` : `${player} phải ${questText}.`;
  const blocks = [`# ${clean(project.title) || "Kịch bản game"}`, `**Thể loại:** ${clean(project.genre) || "Tương tác nhiều nhánh"}`, `## GIỚI THIỆU\n${intro}`];
  for (const scene of sorted) {
    const draft = clean(draftByScene.get(scene.id)?.draft || draftByScene.get(scene.id) || scene.description);
    const choices = (scene.choices || []).map((choice, index) => {
      const label = String.fromCharCode(65 + index);
      const lines = [`**${label} — ${clean(choice.text) || `Lựa chọn ${label}`}**`, ...effectLines(choice.effect)];
      const target = clean(choice.target);
      if (/^(?:→\s*)?(?:cảnh|scene)\s*#?\s*\d+/i.test(target)) lines.push(`→ Đến cảnh ${target.match(/\d+/)?.[0]}`);
      else if (/^(?:→\s*)?(?:kết\s*thúc|ending)/i.test(target)) {
        const rawEnding = target.replace(/^(?:→\s*)?(?:kết\s*thúc|ending)\s*[:\-]?\s*/i, "");
        lines.push(`→ Kết thúc ${endingParts(rawEnding).label}`);
      }
      else if (target) lines.push(`→ ${target}`);
      return lines.join("\n");
    }).join("\n\n");
    blocks.push(`## CẢNH ${scene.scene_order} — ${clean(scene.title) || `Cảnh ${scene.scene_order}`}\n${draft}\n\n${choices}`.trim());
  }
  for (const ending of meta?.endings || []) {
    const parts = endingParts(ending.name);
    blocks.push(`## KẾT THÚC ${parts.label} — ${parts.title || clean(ending.type) || "Kết thúc"}\n${clean(ending.description) || "Câu chuyện khép lại."}`);
  }
  return blocks.join("\n\n").trim();
}
