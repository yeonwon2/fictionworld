// Xưởng Game Pro — PRO 2: kiểm tra cấu trúc (structural validation) cho Scene
// Blueprint. Đây KHÔNG phải QA đầy đủ như PRO 7 (không mô phỏng chạy thử với
// chỉ số/cờ thật — RULE intent chưa compile ở bước này) — chỉ bắt lỗi TOPOLOGY:
// ID trùng, đích không tồn tại, không tới được kết thúc, v.v. Dùng thuần JS,
// không gọi AI, để chạy được ngay khi người dùng sửa tay hoặc trước khi Apply
// kết quả AI (xem mục 23 AI SAFETY trong yêu cầu PRO 2).
import { SCENE_ROLES, MAX_SCENES_PER_EPISODE } from "./blueprintModel.js";

export function validateSceneBlueprint(blueprint) {
  const errors = [];
  const warnings = [];
  const scenes = blueprint?.scenes || [];
  const endings = blueprint?.endings || [];
  const sceneIds = new Set();
  const endingIds = new Set();

  for (const s of scenes) {
    if (sceneIds.has(s.id)) errors.push(`Trùng ID cảnh: "${s.id}".`);
    sceneIds.add(s.id);
  }
  for (const e of endings) {
    if (endingIds.has(e.id)) errors.push(`Trùng ID kết thúc: "${e.id}".`);
    endingIds.add(e.id);
  }

  if (scenes.length === 0) {
    errors.push("Chưa có cảnh nào trong sơ đồ.");
    return { errors, warnings };
  }

  if (!blueprint.startSceneId || !sceneIds.has(blueprint.startSceneId)) {
    errors.push("Chưa xác định được cảnh bắt đầu (start scene) hợp lệ.");
  }

  if (scenes.length > MAX_SCENES_PER_EPISODE) {
    warnings.push(
      `Tập này có ${scenes.length} cảnh, vượt giới hạn an toàn ${MAX_SCENES_PER_EPISODE} — cân nhắc tách bớt sang tập khác hoặc gộp cảnh.`
    );
  }

  const incoming = new Map(scenes.map((s) => [s.id, 0]));

  for (const s of scenes) {
    if (!s.title?.trim()) warnings.push(`Cảnh "${s.id}" chưa có tên.`);

    if (s.role === SCENE_ROLES.DECISION && s.choices.length < 2) {
      warnings.push(`Cảnh "${s.title || s.id}" là cảnh Lựa chọn nhưng chỉ có ${s.choices.length} lựa chọn (nên có ít nhất 2).`);
    }

    if (s.role === SCENE_ROLES.ENDING) continue; // ending-role scenes are terminal, no outgoing choices expected

    if (s.choices.length === 0) {
      warnings.push(`Cảnh "${s.title || s.id}" chưa có lựa chọn/kết nối đi tiếp — cảnh sẽ bị coi là mồ côi khi biên dịch.`);
    }

    s.choices.forEach((c, i) => {
      const label = c.text?.trim() || `Lựa chọn ${i + 1}`;
      if (!c.targetType || !c.targetId) {
        errors.push(`Cảnh "${s.title || s.id}" — ${label}: chưa nối tới cảnh/kết thúc nào.`);
        return;
      }
      if (c.targetType === "scene") {
        if (!sceneIds.has(c.targetId)) {
          errors.push(`Cảnh "${s.title || s.id}" — ${label}: trỏ tới cảnh không tồn tại ("${c.targetId}").`);
        } else {
          incoming.set(c.targetId, (incoming.get(c.targetId) || 0) + 1);
        }
      } else if (c.targetType === "ending") {
        if (!endingIds.has(c.targetId)) {
          errors.push(`Cảnh "${s.title || s.id}" — ${label}: trỏ tới kết thúc không tồn tại ("${c.targetId}").`);
        }
      } else {
        errors.push(`Cảnh "${s.title || s.id}" — ${label}: loại đích không hợp lệ ("${c.targetType}").`);
      }
    });
  }

  // Reachability từ start scene — dùng để phát hiện cảnh mồ côi (không tới
  // được) và để biết có ít nhất 1 đường tới kết thúc.
  const outgoing = new Map(scenes.map((s) => [s.id, []]));
  for (const s of scenes) {
    for (const c of s.choices) {
      if (c.targetType === "scene" && sceneIds.has(c.targetId)) outgoing.get(s.id).push({ type: "scene", id: c.targetId });
      else if (c.targetType === "ending" && endingIds.has(c.targetId)) outgoing.get(s.id).push({ type: "ending", id: c.targetId });
    }
  }
  const reachableScenes = new Set();
  const reachableEndings = new Set();
  if (blueprint.startSceneId && sceneIds.has(blueprint.startSceneId)) {
    const queue = [blueprint.startSceneId];
    reachableScenes.add(blueprint.startSceneId);
    while (queue.length) {
      const id = queue.shift();
      for (const edge of outgoing.get(id) || []) {
        if (edge.type === "scene" && !reachableScenes.has(edge.id)) {
          reachableScenes.add(edge.id);
          queue.push(edge.id);
        } else if (edge.type === "ending") {
          reachableEndings.add(edge.id);
        }
      }
    }
  }

  for (const s of scenes) {
    if (s.id === blueprint.startSceneId) continue;
    if (incoming.get(s.id) === 0 && !reachableScenes.has(s.id)) {
      warnings.push(`Cảnh "${s.title || s.id}" không có lựa chọn nào dẫn vào (mồ côi).`);
    }
  }

  if (endings.length > 0 && reachableEndings.size === 0) {
    warnings.push("Tập này có kết thúc nhưng chưa cảnh nào đi tới được — kiểm tra lại kết nối.");
  }

  const hasEndingRole = scenes.some((s) => s.role === SCENE_ROLES.ENDING && reachableScenes.has(s.id));
  if (endings.length === 0 && !hasEndingRole) {
    warnings.push("Tập này chưa có kết thúc/điểm chuyển tiếp nào — người chơi có thể không bao giờ kết thúc tập.");
  }

  return { errors, warnings };
}
