// Sinh game nhập vai phân nhánh bằng AI — thay thế base44 InvokeLLM (server-side,
// 1 lệnh gọi duy nhất) của gamenhapvai bằng nhiều lệnh gọi aiCall() (client-side,
// Gemini key riêng của người dùng), vì aiCall.js giới hạn cứng 8192 output token
// và schema mỗi node (combat/diceRoll/quest/randomEvents...) khá nặng.
//
// Chiến lược 2 tầng:
//   1) Blueprint: 1 lệnh gọi phác thảo CẤU TRÚC cây phân nhánh (id/beat/isEnding/
//      choices→targetNodeId) — nhẹ, không có văn xuôi, luôn nằm gọn trong 8192 token
//      dù game dài 28 node.
//   2) Batch nội dung: chia node theo blueprint thành vài lô (KHÔNG chia nhỏ theo
//      từng node — mỗi lệnh gọi tốn phí riêng) để viết đầy đủ lời văn + cơ chế
//      (combat/dice/random event) cho lô node của mình, chạy song song.
// targetNodeId của mỗi lựa chọn LUÔN lấy từ blueprint (không cho batch tự đổi) —
// đây là lưới an toàn quan trọng nhất: dù 1 batch viết sai/lệch, hình dạng cây
// phân nhánh vẫn đúng như blueprint đã định, và normalizeAndRepair() ở postprocess.js
// sẽ dọn nốt phần còn lại (node không tới được, ending quá nông, dead-end...).

import { aiCall } from "@/lib/aiCall";
import { normalizeAndRepair } from "./postprocess";

const LENGTH_CONFIG = {
  short: { nodeCount: 12, minDepth: 4, batchCount: 1 },
  medium: { nodeCount: 20, minDepth: 5, batchCount: 2 },
  long: { nodeCount: 28, minDepth: 7, batchCount: 3 },
};

function archetypeStructuralHint(archetype) {
  if (archetype === "litrpg") return "Đây là game THỂ LOẠI HỆ THỐNG (LitRPG) — một số node nên là mốc đột phá cảnh giới hoặc nhận nhiệm vụ.";
  if (archetype === "isekai") return "Đây là game XUYÊN KHÔNG/TRỌNG SINH — một số lựa chọn nên tạo hiệu ứng cánh bướm (mở khóa sự kiện sau), có thể có lựa chọn [Trọng Sinh]/[Tri Thức Hiện Đại].";
  if (archetype === "mystery") return "Đây là game TRINH THÁM/KINH DỊ — cần manh mối/vật phẩm để mở khóa một số lựa chọn, không khí rùng rợn, nhiều nhánh dẫn tới BAD_END.";
  return "";
}

function archetypeContentRules(archetype, litrpg) {
  if (archetype === "litrpg") {
    const ranks = (litrpg?.ranks || []).join(" -> ");
    const expPerRank = litrpg?.expPerRank || 100;
    return [
      "【THỂ LOẠI HỆ THỐNG (System LitRPG) — bắt buộc】",
      '- Một số node có "systemPopup" = { "title", "text" } (thông báo hệ thống, vd "Đột phá!", "Nhận nhiệm vụ").',
      '- Một số node có "quest" = { "id", "title", "desc", "reward" }.',
      '- Lựa chọn có thể có "exp" (số), "systemPoints" (số), "unlockSkill" (tên kỹ năng), "completeQuestId".',
      "- Cảnh giới: " + ranks + ". Mỗi rank cần " + expPerRank + " EXP.",
    ].join("\n");
  }
  if (archetype === "isekai") {
    return [
      "【THỂ LOẠI XUYÊN KHÔNG / TRỌNG SINH — bắt buộc】",
      '- "setFlags" trên node (mảng tên cờ) và "grantFlag" trên choice để lưu hiệu ứng cánh bướm.',
      '- Một số lựa chọn có "requiresFlag" (chỉ kích hoạt khi cờ đã đặt).',
      '- Lựa chọn độc quyền có thể gắn "label" = "rebirth" hoặc "modern".',
      '- "npcAffinity" trên choice: { "tênNPC": delta } (âm = nghi ngờ, dương = hảo cảm).',
    ].join("\n");
  }
  if (archetype === "mystery") {
    return [
      "【THỂ LOẠI TRINH THÁM / KINH DỊ — bắt buộc】",
      '- "grantItem" trên node/choice để nhặt đồ; "removeItem" trên choice để tiêu hao.',
      '- Lựa chọn có "requiresItem" — bị khóa nếu thiếu đồ. Túi đồ giới hạn 4 slot.',
      '- Chỉ số "san" (Tâm trí) là SINH TỬ — SAN<=0 → madness. Thay đổi qua statModifiers.',
      "- Bầu không khí rùng rợn, nhiều BAD_END.",
    ].join("\n");
  }
  return "";
}

function chunkArray(arr, parts) {
  const n = Math.max(1, Math.min(parts, arr.length));
  const size = Math.ceil(arr.length / n);
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function generateBlueprint({ prompt, meta, cfg }) {
  const stats = meta.initialStats || { hp: 100, gold: 20, reputation: 0 };
  const statKeys = Object.keys(stats);
  const genre = meta.genre || "fantasy";
  const archetype = meta.archetype || "none";

  const sys = [
    "Bạn là một nhà thiết kế game RPG chuyên nghiệp, bậc thầy kể chuyện phân nhánh (branching narrative).",
    "Nhiệm vụ: từ bối cảnh mở đầu, PHÁC THẢO CẤU TRÚC cây phân nhánh cho một game nhập vai, khoảng " + cfg.nodeCount + " phân cảnh (node). CHỈ phác thảo khung — KHÔNG viết lời văn đầy đủ, mỗi node chỉ cần 1 câu tóm tắt diễn biến (beat).",
    "",
    "【QUY TẮC CẤU TRÚC — BẮT BUỘC, VI PHẠM = HỎNG】",
    '1. Node đầu tiên PHẢI có id "start_node", là gốc của toàn bộ cây.',
    "2. ĐỘ SÂU TỐI THIỂU: KHÔNG được để bất kỳ node kết thúc (isEnding=true) nào ở độ sâu dưới " + cfg.minDepth + " bước tính từ start_node.",
    "3. MỌI node KHÔNG kết thúc PHẢI có ĐÚNG 3 ĐẾN 4 lựa chọn (choices) — không ít hơn, không nhiều hơn.",
    "4. Mỗi lựa chọn là một hướng đi Ý NGHĨA, KHÁC BIỆT: AN TOÀN/KHÔN NGOAN (rủi ro thấp), TÁO BẠO/NGUY HIỂM (rủi ro cao phần thưởng lớn), LỢI KỶ/GIAN XẢO (lợi trước mắt mất danh vọng sau), và nếu 4 lựa chọn thì thêm 1 lựa chọn ĐÒI HỎI CHỈ SỐ.",
    "5. Các lựa chọn của CÙNG một node PHẢI trỏ tới các targetNodeId KHÁC NHAU — rẽ nhánh thật sự, tránh hội tụ hết về 1 node.",
    "6. RẼ NHÁNH LIÊN TỤC, ĐA TUYẾN SONG SONG — không cụt thẳng tới kết thúc sau 1-2 bước, nhiều nhánh riêng biệt mỗi nhánh là một câu chuyện dẫn tới kết thúc riêng.",
    "7. PHẢI có ít nhất 1 kết thúc THÀNH CÔNG (TRUE_END/GOOD_END) và ít nhất 1 THẤT BẠI (BAD_END). Nên có 3-5 kết thúc khác nhau tùy nhánh.",
    '8. Với MỖI lựa chọn, đặt "wantsCombat"=true nếu nó dẫn tới một trận chiến với kẻ thù (cần ít nhất 2-3 node combat dọc game, mạnh dần, có 1 trùm cuối), "wantsDice"=true nếu nó là hành động liều lĩnh/may rủi kiểu D&D (đàm phán nguy hiểm, cú nhảy mạo hiểm, thử vận may) — khoảng 30% lựa chọn nên là wantsDice.',
    "9. Mỗi node gồm: id (snake_case duy nhất), speaker, beat (1 câu ngắn tóm tắt), isEnding (boolean), endingType (null hoặc TRUE_END/GOOD_END/NORMAL_END/BAD_END), choices (mảng {text ngắn gọn, targetNodeId, wantsCombat, wantsDice}). MỌI targetNodeId phải trỏ tới node có thật trong danh sách.",
    "10. Toàn bộ tiếng Việt, đậm chất thể loại " + genre + ".",
    archetypeStructuralHint(archetype),
  ].filter(Boolean).join("\n");

  const userPrompt = 'Bối cảnh & phân cảnh mở đầu:\n"""' + String(prompt) + '"""\n\nHãy phác thảo cấu trúc cây phân nhánh JSON. Đặt tên ngắn gọn, cuốn hút cho game trong trường "title".';

  const choiceSchema = {
    type: "object",
    properties: {
      text: { type: "string" },
      targetNodeId: { type: "string" },
      wantsCombat: { type: "boolean" },
      wantsDice: { type: "boolean" },
    },
    required: ["text", "targetNodeId"],
  };
  const nodeSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      speaker: { type: "string" },
      beat: { type: "string" },
      isEnding: { type: "boolean" },
      endingType: { type: "string" },
      choices: { type: "array", items: choiceSchema },
    },
    required: ["id", "speaker", "beat", "isEnding", "choices"],
  };
  const schema = {
    type: "object",
    properties: {
      title: { type: "string" },
      nodes: { type: "array", items: nodeSchema },
    },
    required: ["title", "nodes"],
  };

  const result = await aiCall(sys + "\n\n" + userPrompt, { jsonSchema: schema });
  const nodes = Array.isArray(result?.nodes) ? result.nodes.filter((n) => n && n.id) : [];
  if (!nodes.length) throw new Error("AI không trả về cấu trúc node nào — hãy thử lại.");
  if (!nodes.some((n) => n.id === "start_node")) nodes[0].id = "start_node";
  return { title: result.title || "", nodes, statKeys, stats };
}

async function fillNodeBatch({ chunkNodes, blueprintNodes, meta, prompt }) {
  const stats = meta.initialStats || { hp: 100, gold: 20, reputation: 0 };
  const statKeys = Object.keys(stats);
  const genre = meta.genre || "fantasy";
  const archetype = meta.archetype || "none";
  const ids = chunkNodes.map((n) => n.id);

  const sys = [
    "Bạn là một nhà văn game nhập vai bậc thầy. Một game đã có sẵn CẤU TRÚC cây phân nhánh (xem JSON bên dưới) — nhiệm vụ của bạn là viết ĐẦY ĐỦ nội dung cho MỘT SỐ node được giao, phần còn lại do người khác viết song song.",
    "",
    "BẮT BUỘC: chỉ viết cho ĐÚNG các node id sau, không thêm/bớt node khác: " + ids.join(", ") + ".",
    "BẮT BUỘC: mỗi node giữ ĐÚNG số lượng và ĐÚNG THỨ TỰ lựa chọn (choices) như trong cấu trúc gốc — chỉ được viết lại text cho sinh động và bổ sung các trường hệ quả, KHÔNG được thêm/bớt/đổi thứ tự lựa chọn (targetNodeId sẽ bị bỏ qua nếu bạn đổi, hệ thống tự khớp lại theo cấu trúc gốc).",
    "",
    "【NỘI DUNG BẮT BUỘC MỖI NODE】",
    "- text: lời dẫn truyện sinh động 3-6 câu, có miêu tả cảnh quan/cảm xúc/đối thoại NPC — KHÔNG viết ngắn cụt.",
    "- bgImage: URL ảnh nền Unsplash thực tế (https://images.unsplash.com/photo-...) phù hợp khung cảnh, hoặc để trống nếu không chắc.",
    "- MỌI lựa chọn PHẢI có statModifiers (object) — ÍT NHẤT 1 chỉ số thay đổi, giá trị cảm nhận được (5 đến 30 điểm), tuyệt đối không để trống.",
    "- Một số lựa chọn có statRequirements (yêu cầu chỉ số tối thiểu, bị khóa nếu chưa đủ).",
    '- Với lựa chọn có wantsCombat=true trong cấu trúc gốc: node đích của nó (nếu nằm trong danh sách của bạn) PHẢI có "combat" = { enemy:{name,hp 40-120,attack 8-20,defense 2-8,intro}, winTarget, loseTarget, fleeTarget, fleeChance 0.3-0.5, loot:{statModifiers, grantItem, exp} }.',
    '- Với lựa chọn có wantsDice=true: PHẢI có "diceRoll" = { stat (một trong ' + statKeys.join(", ") + "), difficulty (8-18), successTarget, failTarget, successMods, failMods, critThreshold:5, critFailThreshold:1 } — successTarget/failTarget có thể trỏ tới bất kỳ node id nào xuất hiện trong cấu trúc gốc bên dưới (không nhất thiết trong danh sách của bạn).",
    '- Khoảng 40% node của bạn nên có "randomEvents" (mảng { chance:0.1-0.4, text, statModifiers, grantItem, icon }).',
    "- Chỉ số khả dụng: " + statKeys.join(", ") + ". Giá trị ban đầu: " + JSON.stringify(stats) + ".",
    "- Toàn bộ tiếng Việt, đậm chất thể loại " + genre + ".",
    '- QUAN TRỌNG: mọi tên vật phẩm (grantItem), tên "cờ truyện" (setFlags/grantFlag), tên kỹ năng (unlockSkill), tên nhiệm vụ (quest.title) đều HIỆN THẲNG cho người chơi xem trong thông báo trên màn hình — PHẢI là cụm từ tiếng Việt tự nhiên, có dấu, viết hoa đầu câu bình thường (vd "Đã giết người", "Nhẫn bạc của mẹ", "Né đòn thành thạo"). TUYỆT ĐỐI KHÔNG dùng tiếng Anh, snake_case, hay id kỹ thuật (vd "kill_people", "silver_ring" là SAI).',
    archetypeContentRules(archetype, meta.litrpg),
  ].filter(Boolean).join("\n");

  const blueprintContext = blueprintNodes.map((n) => ({
    id: n.id,
    beat: n.beat,
    isEnding: n.isEnding,
    choices: (n.choices || []).map((c) => ({ text: c.text, targetNodeId: c.targetNodeId, wantsCombat: !!c.wantsCombat, wantsDice: !!c.wantsDice })),
  }));

  const userPrompt = [
    'Bối cảnh gốc của game:\n"""' + String(prompt) + '"""',
    "",
    "Cấu trúc TOÀN BỘ cây phân nhánh (tham khảo để viết mạch lạc, không cần viết cho node ngoài danh sách của bạn):",
    JSON.stringify(blueprintContext),
    "",
    "Danh sách node BẠN phải viết đầy đủ (giữ nguyên targetNodeId từng lựa chọn theo đúng thứ tự):",
    JSON.stringify(chunkNodes.map((n) => ({ id: n.id, beat: n.beat, isEnding: n.isEnding, endingType: n.endingType, choices: n.choices }))),
  ].join("\n");

  const choiceSchema = {
    type: "object",
    properties: {
      text: { type: "string" },
      statRequirements: { type: "object", additionalProperties: { type: "number" } },
      statModifiers: { type: "object", additionalProperties: { type: "number" } },
      requiresItem: { type: "string" },
      requiresFlag: { type: "string" },
      grantFlag: { type: "string" },
      grantItem: { type: "string" },
      removeItem: { type: "string" },
      exp: { type: "number" },
      systemPoints: { type: "number" },
      completeQuestId: { type: "string" },
      unlockSkill: { type: "string" },
      label: { type: "string" },
      npcAffinity: { type: "object", additionalProperties: { type: "number" } },
      systemPopup: { type: "object", properties: { title: { type: "string" }, text: { type: "string" } } },
      diceRoll: { type: "object", properties: { stat: { type: "string" }, difficulty: { type: "number" }, successTarget: { type: "string" }, failTarget: { type: "string" }, successMods: { type: "object", additionalProperties: { type: "number" } }, failMods: { type: "object", additionalProperties: { type: "number" } }, critThreshold: { type: "number" }, critFailThreshold: { type: "number" } } },
    },
  };
  const nodeSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      speaker: { type: "string" },
      text: { type: "string" },
      bgImage: { type: "string" },
      choices: { type: "array", items: choiceSchema },
      systemPopup: { type: "object", properties: { title: { type: "string" }, text: { type: "string" } } },
      grantItem: { type: "string" },
      setFlags: { type: "array", items: { type: "string" } },
      quest: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, desc: { type: "string" }, reward: { type: "string" } } },
      combat: { type: "object", properties: { enemy: { type: "object", properties: { name: { type: "string" }, hp: { type: "number" }, attack: { type: "number" }, defense: { type: "number" }, avatar: { type: "string" }, intro: { type: "string" } } }, winTarget: { type: "string" }, loseTarget: { type: "string" }, fleeTarget: { type: "string" }, fleeChance: { type: "number" }, loot: { type: "object", properties: { statModifiers: { type: "object", additionalProperties: { type: "number" } }, grantItem: { type: "string" }, exp: { type: "number" } } } } },
      randomEvents: { type: "array", items: { type: "object", properties: { chance: { type: "number" }, text: { type: "string" }, statModifiers: { type: "object", additionalProperties: { type: "number" } }, grantItem: { type: "string" }, icon: { type: "string" } } } },
    },
    required: ["id", "text", "choices"],
  };
  const schema = { type: "object", properties: { nodes: { type: "array", items: nodeSchema } }, required: ["nodes"] };

  const result = await aiCall(sys + "\n\n" + userPrompt, { jsonSchema: schema });
  const aiNodesById = {};
  for (const n of (result?.nodes || [])) if (n && n.id) aiNodesById[n.id] = n;
  return chunkNodes.map((blueprintNode) => mergeNode(blueprintNode, aiNodesById[blueprintNode.id]));
}

// Ghép node do AI viết vào khung blueprint — id/isEnding/endingType/targetNodeId
// của từng lựa chọn LUÔN lấy từ blueprint (nguồn thật của hình dạng cây), chỉ
// nhận từ AI phần nội dung/cơ chế (text, bgImage, statModifiers, combat, dice...).
function mergeNode(blueprintNode, aiNode) {
  const bChoices = blueprintNode.choices || [];
  const aChoices = (aiNode && Array.isArray(aiNode.choices)) ? aiNode.choices : [];
  const choices = bChoices.map((bc, i) => {
    const ac = aChoices[i] || {};
    return { ...ac, text: ac.text || bc.text, targetNodeId: bc.targetNodeId };
  });
  return {
    id: blueprintNode.id,
    speaker: (aiNode && aiNode.speaker) || blueprintNode.speaker || "",
    text: (aiNode && aiNode.text) || blueprintNode.beat || "",
    bgImage: (aiNode && aiNode.bgImage) || "",
    isEnding: !!blueprintNode.isEnding,
    endingType: blueprintNode.isEnding ? (blueprintNode.endingType || "NORMAL_END") : null,
    choices,
    systemPopup: aiNode?.systemPopup,
    grantItem: aiNode?.grantItem,
    setFlags: aiNode?.setFlags,
    quest: aiNode?.quest,
    combat: aiNode?.combat,
    randomEvents: aiNode?.randomEvents,
  };
}

function buildMeta(meta, blueprintTitle) {
  const stats = meta.initialStats || { hp: 100, gold: 20, reputation: 0 };
  return {
    title: blueprintTitle || meta.title || "Tựa Game Không Tên",
    author: meta.author || "",
    genre: meta.genre || "fantasy",
    theme: meta.theme || "fantasy-parchment",
    archetype: meta.archetype || "none",
    player_name: meta.player_name || "Nhân Vật Chính",
    playerAvatar: meta.playerAvatar || "",
    statsConfig: meta.statsConfig || null,
    initialStats: stats,
    litrpg: meta.litrpg || { ranks: ["Luyện Khí", "Trúc Cơ", "Kim Đan", "Nguyên Anh"], expPerRank: 100 },
    mystery: meta.mystery || { inventorySlots: 4 },
  };
}

/**
 * Sinh toàn bộ game từ 1 prompt bối cảnh. Thay thế
 * base44.functions.invoke('generateGameScenario', ...) của gamenhapvai.
 */
export async function generateGameScenario({ prompt, length, meta }) {
  const cfg = LENGTH_CONFIG[length] || LENGTH_CONFIG.medium;
  if (!prompt || !String(prompt).trim()) throw new Error("Thiếu bối cảnh / phân cảnh mở đầu.");

  const blueprint = await generateBlueprint({ prompt, meta, cfg });
  const chunks = chunkArray(blueprint.nodes, cfg.batchCount);

  const settled = await Promise.allSettled(
    chunks.map((chunkNodes) => fillNodeBatch({ chunkNodes, blueprintNodes: blueprint.nodes, meta, prompt }))
  );
  const failed = settled.filter((r) => r.status === "rejected");
  if (failed.length) {
    const reasons = failed.map((r) => r.reason?.message || String(r.reason)).join(" | ");
    throw new Error("Một phần nội dung game bị lỗi khi sinh (" + failed.length + "/" + chunks.length + " lô thất bại): " + reasons + ". Hãy thử lại.");
  }

  const rawNodesMap = {};
  for (const batchResult of settled) {
    for (const node of batchResult.value) rawNodesMap[node.id] = node;
  }

  const repaired = normalizeAndRepair(rawNodesMap, blueprint.statKeys, cfg.minDepth);
  if (repaired.warnings.length) console.warn("[Xưởng Game] AI sinh ra targetNodeId lệch blueprint, đã tự vá:", repaired.warnings);
  return { meta: buildMeta(meta, blueprint.title), nodes: repaired.nodes, warnings: repaired.warnings };
}
