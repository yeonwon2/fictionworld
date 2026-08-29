import { buildGameBible, buildSceneContracts } from "./narrativeCompiler.js";

const norm = (value) => String(value || "").trim();
const fold = (value) => norm(value).toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
const words = (value) => fold(value).match(/[a-z0-9]{4,}/g) || [];
const finding = (severity, code, message, sceneIds = [], suggestion = "") => ({ severity, code, message, sceneIds, suggestion });

function splitCharacters(value) {
  return norm(value).split(/[,;/|·]+/).map((name) => norm(name).replace(/\s*\([^)]*\)\s*$/, "")).filter(Boolean);
}

export function analyzeNarrativeContinuity({ project = {}, meta = {}, scenes = [] } = {}) {
  project = project || {};
  meta = meta || {};
  const bible = buildGameBible(project, meta);
  const contracts = buildSceneContracts(scenes);
  const findings = [];
  const knownCharacters = new Set((bible.characters || []).map((character) => fold(character.name)).filter(Boolean));
  if (bible.player.name) knownCharacters.add(fold(bible.player.name));
  const imported = String(project.notes || "").includes("[IMPORTED_SCRIPT]");
  const missingLocations = [];
  const missingCasts = [];

  const seenOrders = new Set();
  for (const scene of contracts) {
    if (seenOrders.has(scene.id)) findings.push(finding("error", "DUPLICATE_SCENE", `Số cảnh ${scene.id} xuất hiện nhiều hơn một lần.`, [scene.id], "Đánh lại số để mỗi scene contract có ID duy nhất."));
    seenOrders.add(scene.id);
    if (!scene.title) findings.push(finding("warning", "TITLE_MISSING", `Cảnh ${scene.id} chưa có tiêu đề.`, [scene.id], "Đặt tên theo biến cố chính của cảnh."));
    if (scene.purpose.length < 20) findings.push(finding("warning", "PURPOSE_WEAK", `Cảnh ${scene.id} chưa nêu rõ biến cố và tác dụng đối với mạch chính.`, [scene.id], "Viết 1–3 câu: player muốn gì, gặp trở ngại gì và trạng thái nào thay đổi."));
    if (!scene.location) imported ? missingLocations.push(scene.id) : findings.push(finding("info", "LOCATION_MISSING", `Cảnh ${scene.id} chưa xác định địa điểm.`, [scene.id], "Chọn một địa điểm trong Game Bible hoặc bổ sung địa điểm mới có chủ đích."));
    if (!scene.characters) imported ? missingCasts.push(scene.id) : findings.push(finding("warning", "CAST_MISSING", `Cảnh ${scene.id} chưa xác định nhân vật tham gia.`, [scene.id], "Ghi rõ player và NPC có mặt để AI không tự cho nhân vật xuất hiện."));
    for (const name of splitCharacters(scene.characters)) {
      if (knownCharacters.size && !knownCharacters.has(fold(name))) findings.push(finding("warning", "UNKNOWN_CHARACTER", `Cảnh ${scene.id} dùng nhân vật “${name}” chưa có trong Game Bible.`, [scene.id], "Thêm nhân vật vào Bible hoặc sửa lại đúng tên đã đăng ký."));
    }
  }
  if (missingLocations.length) findings.push(finding("info", "IMPORTED_LOCATIONS_PENDING", `${missingLocations.length} cảnh nhập chưa được trích địa điểm vào Game Bible.`, missingLocations.slice(0, 8), "Bấm “Hoàn thiện Game Bible & contract” để AI trích dữ liệu này; đây không phải lỗi của bản TXT."));
  if (missingCasts.length) findings.push(finding("info", "IMPORTED_CAST_PENDING", `${missingCasts.length} cảnh nhập chưa được trích danh sách nhân vật tham gia.`, missingCasts.slice(0, 8), "Bấm “Hoàn thiện Game Bible & contract” để AI trích dữ liệu này; đây không phải lỗi của bản TXT."));

  // Một game có nhiều nút bấm nhưng mọi nút luôn hội tụ ngay về cùng một cảnh
  // vẫn tạo cảm giác “đọc truyện có nút Next”. Báo theo tỷ lệ toàn kịch bản để
  // tránh làm ngập báo cáo bằng 100 cảnh giống nhau.
  const multiChoice = contracts.filter((scene) => scene.choices.length > 1);
  const converging = multiChoice.filter((scene) => {
    const targets = new Set(scene.choices.map((choice) => `${choice.target.kind}:${fold(choice.target.id)}`));
    return targets.size === 1;
  });
  if (multiChoice.length >= 4 && converging.length / multiChoice.length >= 0.65) {
    const sample = converging.slice(0, 8).map((scene) => scene.id);
    findings.push(finding("warning", "CHOICE_CONVERGENCE_OVERUSE", `${converging.length}/${multiChoice.length} cảnh nhiều lựa chọn nhưng mọi lựa chọn cùng dẫn tới một đích; lựa chọn dễ có cảm giác không làm đổi câu chuyện.`, sample, "Giữ hội tụ ở cảnh đệm, nhưng tại các quyết định lớn hãy mở tuyến, hậu quả hoặc cảnh riêng kéo dài ít nhất 2–3 cảnh trước khi nhập lại."));
  }

  // Dò năm rõ ràng trong tiêu đề/mô tả. Nếu năm lớn nhất của cảnh sau nhỏ hơn
  // năm lớn nhất đã kể trước đó, timeline có khả năng bị lùi mà không giải thích.
  let latestYear = null;
  let latestScene = null;
  for (const scene of contracts) {
    // Chỉ dùng tiêu đề làm mốc chính. Văn cảnh thường nhắc “năm tới” hoặc ôn
    // lại quá khứ; lấy mọi năm trong mô tả sẽ tạo cảnh báo giả.
    const years = scene.title.match(/\b(?:19|20)\d{2}\b/g)?.map(Number) || [];
    if (!years.length) continue;
    const year = Math.max(...years);
    if (latestYear != null && year < latestYear) findings.push(finding("warning", "TIMELINE_YEAR_REGRESSION", `Cảnh ${scene.id} nhắc năm ${year} sau khi cảnh ${latestScene} đã ở năm ${latestYear}; có thể sai thứ tự thời gian hoặc thiếu câu chuyển hồi tưởng.`, [latestScene, scene.id], "Sắp lại cảnh theo niên đại, hoặc ghi rõ đây là hồi tưởng/đối chiếu quá khứ."));
    if (latestYear == null || year >= latestYear) { latestYear = year; latestScene = scene.id; }
  }

  // The main quest need not be repeated verbatim. Significant quest keywords
  // count as anchors; only a long run with no anchor is flagged.
  const questTerms = [...new Set(words(bible.player.mainQuest))].slice(0, 12);
  if (questTerms.length && contracts.length >= 6) {
    const anchored = contracts.map((scene) => {
      const haystack = fold(`${scene.title} ${scene.purpose} ${scene.foreshadow}`);
      return questTerms.some((term) => haystack.includes(term));
    });
    const maxGap = Math.max(4, Math.ceil(contracts.length * 0.2));
    let start = -1;
    for (let index = 0; index <= anchored.length; index++) {
      if (index < anchored.length && !anchored[index]) { if (start < 0) start = index; continue; }
      if (start >= 0 && index - start > maxGap) {
        const ids = contracts.slice(start, index).map((scene) => scene.id);
        findings.push(finding("warning", "QUEST_DRIFT", `Nhiệm vụ chính không được nhắc hoặc thúc đẩy trong ${ids.length} cảnh liên tiếp (${ids[0]}–${ids.at(-1)}).`, ids, "Cài một manh mối, hậu quả hoặc lựa chọn nhắc người chơi vì sao họ đang tiếp tục hành trình."));
      }
      start = -1;
    }
  }

  // A foreshadow is considered paid off when a later scene repeats either its
  // full normalized phrase or at least two meaningful terms.
  for (let index = 0; index < contracts.length; index++) {
    const seed = contracts[index];
    if (!seed.foreshadow || /^[-—–]|không|none$/i.test(seed.foreshadow)) continue;
    const terms = [...new Set(words(seed.foreshadow))];
    const paid = contracts.slice(index + 1).some((later) => {
      const haystack = fold(`${later.title} ${later.purpose} ${later.foreshadow}`);
      return haystack.includes(fold(seed.foreshadow)) || terms.filter((term) => haystack.includes(term)).length >= Math.min(2, terms.length);
    });
    if (!paid) findings.push(finding("warning", "FORESHADOW_UNPAID", `Phục bút ở cảnh ${seed.id} chưa thấy được nhắc lại hoặc giải đáp về sau: “${seed.foreshadow}”.`, [seed.id], "Gắn payoff vào một cảnh sau, hoặc bỏ phục bút nếu không còn dùng."));
  }

  const branchTarget = Number(project.branch_count) || 0;
  const branchIndexes = new Set(contracts.filter((scene) => scene.isBranchPoint).map((scene) => scene.branchIndex));
  for (const scene of contracts.filter((entry) => entry.isBranchPoint)) if ((!imported && scene.branchIndex == null) || scene.branchIndex < 0 || (branchTarget && scene.branchIndex != null && scene.branchIndex >= branchTarget)) findings.push(finding("error", "BRANCH_INDEX_INVALID", `Cảnh ${scene.id} trỏ tới nhánh số ${scene.branchIndex}, ngoài cấu hình dự án.`, [scene.id], "Chọn lại nhánh hợp lệ trong Scene Editor."));
  for (let index = 0; index < branchTarget; index++) if (!branchIndexes.has(index) && !(imported && contracts.every((scene) => scene.branchIndex == null))) findings.push(finding("warning", "BRANCH_UNUSED", `Nhánh ${index + 1} chưa có scene contract nào đánh dấu điểm rẽ.`, [], "Chọn ít nhất một cảnh làm điểm rẽ cho nhánh này."));

  const penalty = findings.reduce((sum, item) => sum + (item.severity === "error" ? 12 : item.severity === "warning" ? 5 : 1), 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  return {
    version: 1, score, findings,
    summary: {
      errors: findings.filter((item) => item.severity === "error").length,
      warnings: findings.filter((item) => item.severity === "warning").length,
      notes: findings.filter((item) => item.severity === "info").length,
      label: score >= 85 ? "Vững" : score >= 65 ? "Cần biên tập" : "Lỏng lẻo",
    },
  };
}
