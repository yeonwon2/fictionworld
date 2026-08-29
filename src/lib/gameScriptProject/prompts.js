// =============================================================================
// Xưởng Kịch Bản Game — Prompt builders
// Luồng: Ý tưởng (nguồn duy nhất) → AI phát triển bộ khung (theo lô) → duyệt
// → bản thảo 4 nhánh → kịch bản chuẩn form theo cú pháp xưởng game.
// =============================================================================
import { buildSyntaxBlock, WORKSHOPS, WORKSHOP_LIST } from "./syntaxGuide";

const WORKSHOP_DEFS_BLOCK = WORKSHOP_LIST
  .map((w) => `- ${w.label}: ${w.desc}`)
  .join("\n");

function stickToIdeaRules(idea) {
  return `# ⚠️ QUY TẮC BẮT BUỘC — BÁM SÁT Ý TƯỞNG (KHÔNG ĐƯỢC THAY THẾ)
- Ý tưởng dưới đây là NGUỒN DUY NHẤT. Bạn chỉ PHÁT TRIỂN THÊM chi tiết, KHÔNG được bịa thế giới / nhân vật / tên / cốt truyện khác.
- Mọi tên nhân vật, tổ chức, cơ chế, chỉ số, tuyến, twist và địa danh đã nêu trong ý tưởng PHẢI giữ nguyên chữ.
- Nếu ý tưởng chưa đặt tên, hãy tạo tên MỚI phù hợp riêng với bối cảnh hiện tại. CẤM tái sử dụng tên, cặp nhân vật, quan hệ hoặc mô-típ từ ví dụ hướng dẫn, dự án khác hay kịch bản đã viết trước đó.
- CẤM tự mặc định kịch bản là hệ thống, xuyên sách, cứu nữ phụ, công lược tình cảm, cung đình hoặc bất kỳ công thức quen thuộc nào nếu ý tưởng không yêu cầu.
- Giới tính, vai trò, quan hệ và số lượng nhân vật phải xuất phát từ ý tưởng; không tự mặc định player là nữ hoặc mọi nhánh đều là tuyến tình cảm.
- CẤM viết sang thể loại/bối cảnh khác (cung đình, vương phi, v.v.) nếu ý tưởng không có.
- Nếu ý tưởng đã liệt kê nhân vật/tuyến/kết thúc/chỉ số/gameplay — dùng ĐÚNG chúng, chỉ bổ sung cho đủ số lượng yêu cầu.

# Ý TƯỞNG CỦA TÁC GIẢ (NGUỒN)
"""${idea?.trim() || "(TRỐNG — dừng lại, không được bịa)"}"""`;
}

// ---------- Pass 1: nhân vật + bối cảnh + nhánh + kết thúc (KHÔNG dàn cảnh) ----------
export function buildPlanCorePrompt({ workshop, title, idea, genre, branchCount, notes, directionBlock, playerName, playerDesc, mainQuest }) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  return `Bạn là BIÊN KỊCH CHÍNH xưởng kịch bản game (${w.label}). Tác giả đã giao Ý TƯỞNG đầy đủ. Nhiệm vụ: trích xuất và phát triển BỘ CỐT LÕI (nhân vật, bối cảnh, nhánh, kết thúc) — CHƯA viết dàn cảnh.

${stickToIdeaRules(idea)}

# XƯỞNG: ${w.label} — ${w.desc}
# Tên game: ${title || "(theo ý tưởng)"}
# Thể loại: ${genre || "(theo ý tưởng)"}
# Số nhánh truyện: ${branchCount}

${directionBlock ? `# Định hướng thêm\n${directionBlock}` : ""}
${notes?.trim() ? `# Ghi chú thêm\n${notes.trim()}` : ""}

# NHÂN VẬT NHẬP VAI (nếu ý tưởng đã có tên thì dùng đúng tên đó)
- Tên từ form: ${playerName?.trim() || "(đọc trong ý tưởng; nếu chưa có thì tạo tên mới phù hợp bối cảnh)"}
- Lai lịch form: ${playerDesc?.trim() || "(đọc trong ý tưởng)"}
- Nhiệm vụ chính form: ${mainQuest?.trim() || "(đọc trong ý tưởng — nhiệm vụ hệ thống / mục tiêu chính)"}

# YÊU CẦU JSON
- characters: danh sách đầy đủ. Phần tử ĐẦU TIÊN = nhân vật người chơi nhập vai (role: "Nhân vật nhập vai / Player"), dùng đúng tên trong ý tưởng. Tiếp theo là các nhân vật thực sự cần cho ý tưởng (đồng minh, đối thủ, NPC, phản diện, nhân vật quan hệ hoặc thực thể khác nếu có) — đúng tên + tính cách + động cơ + mối quan hệ với player.
- settings: địa điểm / không gian quan trọng trong ý tưởng (có thể suy ra thêm nếu ý tưởng không liệt kê, nhưng phải khớp bối cảnh).
- branches: đúng ${branchCount} nhánh — nếu ý tưởng có 4 tuyến nhân vật thì mỗi nhánh = 1 tuyến đó; mô tả ngắn storyline của nhánh.
- endings: các kết thúc TRUE_END/GOOD_END/NORMAL_END/BAD_END phải khớp cấu trúc và xung đột của ý tưởng; không tự biến mỗi nhánh thành một tuyến tình cảm.
- invariants: 3–10 luật cốt truyện không bao giờ được vi phạm. Dùng type "ending_requires" hoặc "fact_before_scene"; field/value là cờ, vật phẩm hoặc sự thật; ending/scene là đích áp dụng.
- player_name, player_desc, main_quest: trích từ ý tưởng (bắt buộc điền, không để trống).
- notes: tóm tắt cơ chế gameplay (chỉ số, nhiệm vụ hệ thống, twist...) đã có trong ý tưởng.

Trả JSON đúng schema.`;
}

export const PLAN_CORE_SCHEMA = {
  type: "object",
  properties: {
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          personality: { type: "string" },
          motive: { type: "string" },
        },
        required: ["name", "role"],
      },
    },
    settings: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, description: { type: "string" } },
        required: ["name"],
      },
    },
    endings: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, type: { type: "string" }, description: { type: "string" } },
        required: ["name"],
      },
    },
    branches: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, description: { type: "string" } },
        required: ["name"],
      },
    },
    player_name: { type: "string" },
    player_desc: { type: "string" },
    main_quest: { type: "string" },
    notes: { type: "string" },
    invariants: {
      type: "array",
      items: { type: "object", properties: { id: { type: "string" }, description: { type: "string" }, type: { type: "string" }, field: { type: "string" }, value: { type: "string" }, ending: { type: "string" }, scene: { type: "number" } }, required: ["description", "type"] },
    },
  },
  required: ["characters", "settings", "endings", "branches", "player_name", "main_quest"],
};

// ---------- Pass 2+: dàn cảnh theo lô (mỗi lô ~8–10 cảnh) ----------
export function buildPlanScenesChunkPrompt({
  workshop,
  idea,
  coreBlock,
  branchCount,
  choicesPerScene,
  startOrder,
  count,
  totalScenes,
  prevScenesSummary,
}) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  const endOrder = Math.min(startOrder + count - 1, totalScenes);
  return `Bạn là BIÊN KỊCH CHÍNH xưởng kịch bản game (${w.label}). Đang dựng DÀN CẢNH theo lô — chỉ viết các cảnh từ số ${startOrder} đến ${endOrder} (tổng game ${totalScenes} cảnh).

${stickToIdeaRules(idea)}

# BỘ CỐT LÕI ĐÃ CHỐT (bám sát 100%)
${coreBlock}

# TIẾN ĐỘ DÀN CẢNH
- Viết đúng các cảnh số: ${startOrder} … ${endOrder} (đủ ${endOrder - startOrder + 1} cảnh, không thiếu không thừa).
- Mỗi cảnh ${choicesPerScene} lựa chọn (text + effect + target).
- ${branchCount} nhánh truyện: đánh dấu is_branch_point=true + branch_index (0..${branchCount - 1}) tại các điểm rẽ quan trọng (ưu tiên rải đều theo tiến độ game, khớp từng tuyến nhân vật trong bộ cốt lõi).

${prevScenesSummary?.trim() ? `# CÁC CẢNH TRƯỚC ĐÃ CÓ (nối mạch, không lặp)\n${prevScenesSummary.trim()}` : "(đây là lô cảnh đầu)"}

# YÊU CẦU MỖI CẢNH
- title, description (nêu rõ player làm gì + đẩy mạch nhiệm vụ chính / hệ thống nếu có), location, characters (tên đúng), foreshadow, choices[].
- state_contract nội bộ cho từng cảnh: requires (items/flags/knowledge/stats), reveals (các sự thật người chơi biết tại cảnh này), forbids (sự thật chưa được phép biết/nhắc tới), handoff (items/flags/knowledge bắt buộc phải có khi rời cảnh). Dùng mảng rỗng khi không có; không viết văn xuôi vào các field này.
- chapter_index: chia game thành chương khoảng 8–15 cảnh. is_checkpoint=true ở cảnh mở đầu mỗi chương hoặc điểm hội tụ lớn; checkpoint phải có handoff rõ ràng.
- description 1–3 câu súc tích, bám ý tưởng (nhiệm vụ hệ thống, chỉ số Tình cảm/Tin tưởng/Nghi ngờ, twist vòng lặp... nếu ý tưởng có).
- choices.target: "cảnh N" hoặc "kết thúc <tên>" hợp lý.

Trả JSON: { scenes: [ ... ] } đúng số lượng.`;
}

export const PLAN_SCENES_CHUNK_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          location: { type: "string" },
          characters: { type: "string" },
          foreshadow: { type: "string" },
          state_contract: {
            type: "object",
            properties: {
              requires: { type: "object", properties: { items: { type: "array", items: { type: "string" } }, flags: { type: "array", items: { type: "string" } }, knowledge: { type: "array", items: { type: "string" } }, stats: { type: "object" } } },
              reveals: { type: "array", items: { type: "string" } },
              forbids: { type: "array", items: { type: "string" } },
              handoff: { type: "object", properties: { items: { type: "array", items: { type: "string" } }, flags: { type: "array", items: { type: "string" } }, knowledge: { type: "array", items: { type: "string" } } } },
            },
          },
          choices: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                effect: { type: "string" },
                target: { type: "string" },
              },
              required: ["text"],
            },
          },
          is_branch_point: { type: "boolean" },
          branch_index: { type: "number" },
          chapter_index: { type: "number" },
          is_checkpoint: { type: "boolean" },
        },
        required: ["title", "description"],
      },
    },
  },
  required: ["scenes"],
};

// ---------- Phân tích kịch bản đã nhập (không viết lại nội dung/Story Graph) ----------
export function buildImportedCorePrompt({ workshop, title, genre, scenes, endings, playerName, mainQuest }) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  const outline = (scenes || []).map((scene) =>
    `C${scene.scene_order} — ${scene.title}: ${String(scene.description || "").replace(/\s+/g, " ").slice(0, 420)}\nLựa chọn: ${(scene.choices || []).map((choice) => `${choice.text} -> ${choice.target}`).join(" | ")}`
  ).join("\n");
  return `Bạn là narrative designer (${w.label}). Đây là KỊCH BẢN HOÀN CHỈNH ĐÃ NHẬP. Chỉ phân tích để tạo Game Bible; TUYỆT ĐỐI không đổi tên, cốt truyện, số cảnh, lựa chọn hay ending.

# GAME: ${title}
# Thể loại: ${genre || "?"}
# Player hiện có: ${playerName || "?"}
# Nhiệm vụ hiện có: ${mainQuest || "?"}
# Ending bắt buộc giữ nguyên mã và loại
${(endings || []).map((ending) => `- ${ending.name} [${ending.type || "NORMAL_END"}]: ${ending.description || ""}`).join("\n")}

# TOÀN BỘ STORY OUTLINE
${outline}

Trả JSON đúng PLAN_CORE_SCHEMA. characters/settings/invariants phải được SUY RA từ nội dung có sẵn. branches chỉ dùng một nhánh tên "Kịch bản gốc". endings giữ nguyên mã đã cho. Không sáng tác một kịch bản mới.`;
}

export const IMPORTED_CONTRACTS_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          scene_order: { type: "number" },
          location: { type: "string" },
          characters: { type: "string" },
          foreshadow: { type: "string" },
          state_contract: PLAN_SCENES_CHUNK_SCHEMA.properties.scenes.items.properties.state_contract,
          chapter_index: { type: "number" },
          is_checkpoint: { type: "boolean" },
        },
        required: ["scene_order", "state_contract"],
      },
    },
  },
  required: ["scenes"],
};

export function buildImportedContractsPrompt({ workshop, title, coreBlock, scenes, previousScenes = [] }) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  const render = (scene) => JSON.stringify({
    scene_order: scene.scene_order, title: scene.title, description: scene.description,
    choices: scene.choices,
  });
  return `Bạn là narrative logic analyst (${w.label}). Bổ sung metadata và state_contract cho các cảnh ĐÃ CÓ. Không viết lại title/description/choices/target/effect.

# GAME BIBLE
${coreBlock}

${previousScenes.length ? `# CẢNH NGAY TRƯỚC (chỉ để nối state)\n${previousScenes.map(render).join("\n")}` : ""}
# CÁC CẢNH CẦN PHÂN TÍCH
${scenes.map(render).join("\n")}

Mỗi cảnh trả đúng scene_order cùng location, characters, foreshadow, chapter_index, is_checkpoint và state_contract:
- requires: trạng thái thực sự bắt buộc trước cảnh; không bịa điều kiện.
- reveals: sự thật được người chơi biết trong cảnh.
- forbids: sự thật chưa được phép lộ.
- handoff: items/flags/knowledge chắc chắn có khi rời cảnh trên MỌI lựa chọn; trạng thái chỉ có ở một lựa chọn không được đưa vào handoff.
Giữ nguyên tên vật phẩm/cờ như trong lựa chọn. Trả JSON đúng schema.`;
}

/** @deprecated dùng buildPlanCorePrompt + buildPlanScenesChunkPrompt */
export function buildPlanPrompt(args) {
  return buildPlanCorePrompt(args);
}

export const PLAN_SCHEMA = PLAN_CORE_SCHEMA;

export function formatCoreBlock(core) {
  if (!core) return "(trống)";
  const lines = [];
  lines.push(`Player: ${core.player_name || "?"} — ${core.player_desc || ""}`);
  lines.push(`Main quest: ${core.main_quest || "?"}`);
  if (core.characters?.length) {
    lines.push("## Nhân vật");
    for (const c of core.characters) {
      lines.push(`- ${c.name} (${c.role || "?"}): ${c.personality || ""} · ${c.motive || ""}`);
    }
  }
  if (core.settings?.length) {
    lines.push("## Bối cảnh");
    for (const s of core.settings) lines.push(`- ${s.name}: ${s.description || ""}`);
  }
  if (core.branches?.length) {
    lines.push("## Nhánh");
    core.branches.forEach((b, i) => lines.push(`- [${i}] ${b.name}: ${b.description || ""}`));
  }
  if (core.endings?.length) {
    lines.push("## Kết thúc");
    for (const e of core.endings) lines.push(`- ${e.name} [${e.type || "NORMAL_END"}]: ${e.description || ""}`);
  }
  if (core.invariants?.length) {
    lines.push("## Luật bất biến");
    for (const rule of core.invariants) lines.push(`- ${rule.description || `${rule.type}: ${rule.field || "knowledge"}=${rule.value || "?"}`}`);
  }
  if (core.notes) lines.push(`## Ghi chú gameplay\n${core.notes}`);
  return lines.join("\n");
}

// ---------- Sửa 1 mục của bộ cốt lõi theo góp ý (nhân vật/bối cảnh/kết thúc/nhánh) ----------
const CORE_SECTION_LABEL = { characters: "nhân vật", settings: "bối cảnh/địa điểm", endings: "kết thúc", branches: "nhánh truyện" };
const CORE_SECTION_ITEM_SCHEMA = {
  characters: { name: { type: "string" }, role: { type: "string" }, personality: { type: "string" }, motive: { type: "string" } },
  settings: { name: { type: "string" }, description: { type: "string" } },
  endings: { name: { type: "string" }, type: { type: "string" }, description: { type: "string" } },
  branches: { name: { type: "string" }, description: { type: "string" } },
};

export function coreSectionRevisionSchema(section) {
  return {
    type: "object",
    properties: { items: { type: "array", items: { type: "object", properties: CORE_SECTION_ITEM_SCHEMA[section] || {} } } },
    required: ["items"],
  };
}

/**
 * Sửa/góp ý sửa MỘT mục trong bộ cốt lõi (vd chỉ riêng danh sách "kết thúc")
 * theo phản hồi của tác giả — dùng cho nút "Nhờ AI sửa" ở mỗi MetaCard, thay
 * vì phải tự tay sửa JSON. Giữ nguyên các mục khác, chỉ trả lại đúng mục này.
 */
export function buildCoreSectionRevisionPrompt({ workshop, idea, title, section, currentValue, feedback }) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  const label = CORE_SECTION_LABEL[section] || section;
  return `Bạn là BIÊN KỊCH CHÍNH (${w.label}) của game "${title}". Tác giả muốn sửa lại phần "${label}" trong bộ cốt lõi theo góp ý dưới đây.

${stickToIdeaRules(idea)}

# PHẦN "${label.toUpperCase()}" HIỆN TẠI
${JSON.stringify(currentValue || [], null, 2)}

# GÓP Ý CỦA TÁC GIẢ
"""${feedback}"""

# YÊU CẦU
- CHỈ sửa đúng theo góp ý — không đổi những gì không liên quan tới góp ý.
- Vẫn phải khớp ý tưởng nguồn (tên nhân vật/hệ thống/tuyến đã nêu ở ý tưởng).
- Trả lại TOÀN BỘ danh sách "${label}" đã sửa (không chỉ phần tử bị sửa).

Trả JSON: { items: [...] } đúng schema.`;
}

// ---------- Sửa/góp ý sửa 1 cảnh trong dàn cảnh (bộ khung) ----------
export const PLAN_SCENE_REVISION_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    location: { type: "string" },
    characters: { type: "string" },
    foreshadow: { type: "string" },
    state_contract: {
      type: "object",
      properties: {
        requires: { type: "object", properties: { items: { type: "array", items: { type: "string" } }, flags: { type: "array", items: { type: "string" } }, knowledge: { type: "array", items: { type: "string" } }, stats: { type: "object" } } },
        reveals: { type: "array", items: { type: "string" } },
        forbids: { type: "array", items: { type: "string" } },
        handoff: { type: "object", properties: { items: { type: "array", items: { type: "string" } }, flags: { type: "array", items: { type: "string" } }, knowledge: { type: "array", items: { type: "string" } } } },
      },
    },
    choices: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, effect: { type: "string" }, target: { type: "string" } },
        required: ["text"],
      },
    },
  },
  required: ["title", "description"],
};

export function buildPlanSceneRevisionPrompt({ workshop, idea, coreBlock, scene, feedback }) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  return `Bạn là BIÊN KỊCH CHÍNH (${w.label}). Sửa lại MỘT cảnh trong dàn cảnh theo góp ý của tác giả — chỉ trả lại đúng cảnh này (đã sửa), không viết cảnh khác.

${stickToIdeaRules(idea)}

# BỘ CỐT LÕI
${coreBlock}

# CẢNH ${scene.scene_order} HIỆN TẠI
${JSON.stringify({ title: scene.title, description: scene.description, location: scene.location, characters: scene.characters, foreshadow: scene.foreshadow, state_contract: scene.state_contract, choices: scene.choices }, null, 2)}

# GÓP Ý CỦA TÁC GIẢ
"""${feedback}"""

Đồng bộ state_contract (requires/reveals/forbids/handoff) với nội dung sau khi sửa.
Trả JSON đúng schema (title, description, location, characters, foreshadow, state_contract, choices[]).`;
}

// ---------- Bản thảo 1 nhánh (chia lô nếu nhiều cảnh) ----------
export function buildBranchDraftPrompt({ workshop, title, idea, planBlock, branch, scenes, allScenes = [], playerName, playerDesc, mainQuest, gameBible = null, previousDraftSummary = "" }) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  const sceneBlock = scenes
    .map(
      (s) =>
        `- [cảnh ${s.scene_order}] ${s.title}\n  Mô tả: ${s.description}\n  Địa điểm: ${s.location || "-"}\n  NV: ${s.characters || "-"}\n  Lựa chọn: ${(s.choices || []).map((c) => `"${c.text}"`).join(" | ") || "-"}`
    )
    .join("\n");
  const graphBlock = (allScenes || []).map((s) => {
    const links = (s.choices || []).map((c) => `${c.text || "?"} → ${c.target || "?"}`).join(" | ");
    return `C${s.scene_order} ${s.title || ""}${s.is_branch_point ? ` [nhánh ${Number(s.branch_index) + 1}]` : " [chung]"}: ${links || "chưa có đích"}`;
  }).join("\n");
  return `Bạn là BIÊN KỊCH xưởng (${w.label}). Viết BẢN THẢO VĂN XUÔI cho NHÁNH "${branch.name}" của "${title}" — để tác giả đọc thử, KHÔNG phải cú pháp kịch bản game.

${stickToIdeaRules(idea)}

# Player: ${playerName || "?"} — ${playerDesc || ""}
# Main quest: ${mainQuest || "?"}

# BỘ KHUNG
${planBlock}

# GAME BIBLE NỘI BỘ (NGUỒN SỰ THẬT — không được mâu thuẫn)
${gameBible ? JSON.stringify(gameBible) : "(dùng Bộ khung ở trên)"}

# STORY GRAPH TOÀN GAME (đọc để hiểu cảnh chung/điểm hội tụ; CHỈ viết các cảnh được giao bên dưới)
${graphBlock || "(trống)"}

# NHÁNH: ${branch.name} — ${branch.description || ""}

# CÁC CẢNH CỦA NHÁNH
${sceneBlock}

${previousDraftSummary ? `# HANDOFF TỪ CÁC CẢNH ĐÃ VIẾT TRƯỚC\n${previousDraftSummary}` : "# HANDOFF\nĐây là lô đầu của tuyến."}

# YÊU CẦU
- Đủ từng cảnh theo scene_order; mỗi draft 150–280 từ; player là trung tâm; bám tên/tuyến/hệ thống trong ý tưởng.
- Mạch liền mạch giữa các cảnh.
- Không viết nhánh này như một truyện độc lập: cảnh chung phải giữ cùng sự kiện/sự thật với các nhánh khác; chỉ khác sau lựa chọn rẽ nhánh.
- Mỗi cảnh phải bắt đầu đúng trạng thái mà cảnh trước bàn giao. Nhân vật chỉ được biết thông tin đã được tiết lộ ở cảnh trước hoặc ngay trong cảnh này.
- Quan hệ, chỉ số, vật phẩm, cờ và thương tích không được tự thay đổi ngoài lựa chọn/hiệu ứng ghi trong Story Graph.
- Phục bút chỉ được payoff sau khi đã được gieo. Không tiết lộ twist sớm hơn scene contract.
- Kết thúc lô phải để lại handoff rõ ràng cho cảnh kế tiếp; không tự kết thúc tuyến nếu graph chưa tới ending.

Trả JSON: { scenes: [{ scene_order, title, draft }] }.`;
}

export const BRANCH_DRAFT_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          scene_order: { type: "number" },
          title: { type: "string" },
          draft: { type: "string" },
        },
        required: ["scene_order", "draft"],
      },
    },
  },
  required: ["scenes"],
};

// ---------- Sửa/góp ý sửa bản thảo 1 cảnh của 1 nhánh ----------
export const BRANCH_DRAFT_REVISION_SCHEMA = {
  type: "object",
  properties: { draft: { type: "string" } },
  required: ["draft"],
};

export function buildBranchDraftRevisionPrompt({ workshop, title, idea, planBlock, branch, scene, currentDraft, feedback }) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  return `Bạn là BIÊN KỊCH (${w.label}). Viết lại bản thảo văn xuôi của MỘT cảnh theo góp ý của tác giả — không phải cú pháp kịch bản game, vẫn là bản thảo để đọc thử.

${stickToIdeaRules(idea)}

# GAME: ${title} — NHÁNH: ${branch.name}
# BỘ KHUNG
${planBlock}

# CẢNH ${scene.scene_order}: ${scene.title}

# BẢN THẢO HIỆN TẠI
"""${currentDraft}"""

# GÓP Ý CỦA TÁC GIẢ
"""${feedback}"""

Trả JSON: { draft: "..." } — chỉ bản thảo cảnh này đã sửa, 150-280 từ.`;
}

// ---------- Kịch bản chuẩn form 1 cảnh ----------
export function buildSceneScriptPrompt({
  workshop,
  title,
  idea,
  planBlock,
  branch,
  scene,
  prevScript,
  nextScene,
  isFirst,
  isLast,
  totalScenes,
  playerName,
  playerDesc,
  mainQuest,
  knownItems,
  knownFlags,
  sceneMap,
  endingLabels,
  approvedDraft,
  gameBible,
}) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  const sceneNumber = scene.scene_order;
  const choicesBlock = (scene.choices || [])
    .map((c) => `- "${c.text}"${c.effect ? ` → ${c.effect}` : ""}${c.target ? ` → ${c.target}` : ""}`)
    .join("\n");
  // Sổ theo dõi toàn cục — chống 2 lỗi hay gặp nhất khi mỗi cảnh được viết
  // RIÊNG LẺ bằng 1 lệnh AI độc lập: (1) "vật phẩm/cờ mồ côi" do đặt tên khác
  // đi ở mỗi cảnh cho cùng 1 thứ, (2) "cảnh mồ côi"/"→ Đến cảnh N" trỏ vào số
  // cảnh không có thật do AI đoán mò số cảnh chưa từng thấy.
  const registryBlock = [
    `# SỔ THEO DÕI TOÀN CỤC (BẮT BUỘC tuân thủ — đây là NGUỒN SỰ THẬT duy nhất về số cảnh/vật phẩm/cờ đã có)`,
    `- Toàn bộ số cảnh HỢP LỆ trong kịch bản: chỉ được dùng "→ Đến cảnh N" với N nằm trong danh sách sau, TUYỆT ĐỐI không bịa số khác:\n${(sceneMap || []).map((s) => `  ${s.scene_order} — ${s.title}`).join("\n") || "  (chưa có cảnh nào khác)"}`,
    endingLabels?.length ? `- Nhãn kết thúc hợp lệ (dùng đúng chữ khi "→ Kết thúc <nhãn>"): ${endingLabels.join(", ")}` : "",
    knownItems?.length
      ? `- Vật phẩm ĐÃ TỒN TẠI (nếu cảnh này cần dùng lại thứ đã có, PHẢI chép đúng nguyên văn tên sau, không đổi cách viết): ${knownItems.join(", ")}`
      : "- Chưa có vật phẩm nào được tạo trước đó.",
    knownFlags?.length
      ? `- Cờ ĐÃ TỒN TẠI (dùng lại đúng nguyên văn nếu cần kiểm tra lại): ${knownFlags.join(", ")}`
      : "- Chưa có cờ nào được tạo trước đó.",
    `- Nếu cảnh này ĐẶT ĐIỀU KIỆN "→ Cần vật phẩm: X" hoặc "→ Cần cờ: X", X PHẢI là 1 trong danh sách "ĐÃ TỒN TẠI" ở trên (đã được cấp ở cảnh trước) — KHÔNG được yêu cầu vật phẩm/cờ chưa từng xuất hiện.`,
    `- Nếu cảnh này CẦN 1 vật phẩm/cờ MỚI hoàn toàn chưa có trong danh sách, PHẢI tự cấp nó bằng "→ Vật phẩm: <tên mới>" / "→ Cờ: <tên mới>" NGAY TRONG CHÍNH CẢNH NÀY hoặc một cảnh trước đó — không được vừa yêu cầu vừa không cấp.`,
  ].filter(Boolean).join("\n");
  return `Bạn là BIÊN KỊCH CHÍNH (${w.label}). Viết PHÂN CẢNH KỊCH BẢN GAME hoàn chỉnh — đúng cú pháp xưởng. Không meta.

${buildSyntaxBlock(workshop)}

${stickToIdeaRules(idea)}

# GAME: ${title}
# Player: ${playerName || "?"} — ${playerDesc || ""}
# Main quest: ${mainQuest || "?"}
# NHÁNH: ${branch.name}

# BỘ KHUNG
${planBlock}

# GAME BIBLE NỘI BỘ (NGUỒN SỰ THẬT)
${gameBible ? JSON.stringify(gameBible) : "(dùng Bộ khung)"}

${registryBlock}

# CẢNH ${sceneNumber}/${totalScenes}: ${scene.title}
- Sự kiện: ${scene.description}
- Địa điểm: ${scene.location || "?"}
- NV: ${scene.characters || "?"}
- Phục bút: ${scene.foreshadow || "-"}
- Lựa chọn:
${choicesBlock || "- (tiếp tục)"}

${approvedDraft?.trim() ? `# BẢN THẢO ĐÃ ĐƯỢC TÁC GIẢ DUYỆT (chuyển thể sang cú pháp game, không thay cốt truyện)\n"""${approvedDraft.trim().slice(0, 7000)}"""` : "# BẢN THẢO ĐÃ DUYỆT\n(chưa có — bám tuyệt đối scene contract)"}

${isFirst ? `BẮT BUỘC mở bằng ## GIỚI THIỆU (player ${playerName || ""} + nhiệm vụ ${mainQuest || ""}) rồi ## CẢNH ${sceneNumber} — ${scene.title}.` : ""}
${!isFirst && prevScript ? `# Cảnh trước (nối mạch)\n"""${prevScript.slice(-1200)}"""` : ""}
${isLast ? "CẢNH CUỐI: lựa chọn dẫn ## KẾT THÚC <nhãn> — <Tên> [LOẠI] viết kèm trong bài trả lời." : `Cảnh kế: ## CẢNH ${nextScene?.scene_order} — ${nextScene?.title || ""}. Dùng → Đến cảnh ${nextScene?.scene_order} khi cần.`}

Chỉ trả nội dung kịch bản phân cảnh.`;
}

// Trích tên vật phẩm/cờ ĐÃ ĐƯỢC CẤP từ 1 đoạn kịch bản vừa AI viết ra — dùng để
// cộng dồn "sổ theo dõi toàn cục" (knownItems/knownFlags) truyền cho các cảnh
// VIẾT SAU, để AI tái dùng đúng tên thay vì bịa tên khác cho cùng 1 thứ.
export function extractItemsAndFlags(scriptText) {
  const text = String(scriptText || "");
  const items = new Set();
  const flags = new Set();
  for (const m of text.matchAll(/(?:→|->|=>)\s*(?:Nhận\s+)?Vật phẩm\s*:\s*(.+)$/gim)) {
    const name = m[1].trim();
    if (name) items.add(name);
  }
  for (const m of text.matchAll(/(?:→|->|=>)\s*Cờ\s*:\s*(.+)$/gim)) {
    const name = m[1].trim();
    if (name) flags.add(name);
  }
  return { items: [...items], flags: [...flags] };
}

export function buildSceneScriptRevisionPrompt({ workshop, title, planBlock, branch, scene, currentContent, feedback, idea }) {
  const w = WORKSHOPS[workshop] || WORKSHOPS.studio;
  return `Bạn là BIÊN KỊCH CHÍNH (${w.label}). Sửa TOÀN BỘ phân cảnh theo góp ý. Không meta.

${buildSyntaxBlock(workshop)}
${idea?.trim() ? stickToIdeaRules(idea) : ""}

# GAME: ${title} — NHÁNH ${branch?.name || "?"}
# CẢNH: ${scene?.title || "?"} — ${scene?.description || ""}

# KỊCH BẢN HIỆN TẠI
"""${currentContent}"""

# GÓP Ý
${feedback}

Giữ cú pháp xưởng ${w.label}. Chỉ trả kịch bản.`;
}
