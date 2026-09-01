// Compiler/Adapter: Pro Model (proModel.js) -> dữ liệu game mà GamePlayer /
// ExportCenter / rpgExport hiện tại đã hiểu (`{meta, nodes}` giống hệt Xưởng
// Game cũ). Cố tình viết mỏng — không tự làm lại việc vá/chuẩn hoá node graph
// mà gọi thẳng `normalizeAndRepair` (đã dùng bởi mọi parser của Xưởng Game
// cũ), để Pro không có một bản sao logic runtime riêng.
import { normalizeAndRepair } from "../gameStudio/postprocess.js";
import { SCENE_ROLES } from "./blueprintModel.js";

export function compileProGame(proDoc) {
  const rawNodes = {
    start_node: {
      id: "start_node",
      speaker: "",
      text: proDoc.startScene?.text || "",
      bgImage: "",
      isEnding: false,
      endingType: null,
      choices: (proDoc.choices || []).map((c) => ({
        text: c.text,
        targetNodeId: c.endingId,
      })),
    },
    ...Object.fromEntries(
      (proDoc.endings || []).map((e) => [
        e.id,
        {
          id: e.id,
          speaker: "",
          text: e.text,
          title: e.title,
          bgImage: "",
          isEnding: true,
          endingType: "neutral",
          choices: [],
        },
      ])
    ),
  };

  const { nodes, warnings } = normalizeAndRepair(rawNodes, [], 1, {
    forceNonEmptyModifiers: false,
  });

  const meta = {
    title: proDoc.title || "Game Pro Mới",
    presentation: "dialogue",
    theme: "lily-noir",
    archetype: "none",
    player_name: "Nhân Vật Chính",
    playerAvatar: "",
    defaultNpcAvatar: "",
    statsConfig: [],
    initialStats: {},
    builder: "pro",
    proSchemaVersion: proDoc.schemaVersion || 1,
    pro: proDoc,
  };

  return { meta, nodes, warnings };
}

// PRO 2: compile MỘT Scene Blueprint (episode.sceneBlueprint, xem
// blueprintModel.js) thành `{meta, nodes}` — dùng cho "Chơi thử tập này" ở
// Smart Mind Map. Cố tình TÁCH khỏi compileProGame() ở trên (không đổi hành
// vi/chữ ký của nó — có test PRO0/PRO1 khẳng định compileProGame() luôn ra
// đúng game demo 2 lựa chọn/2 kết thúc bất kể storyBlueprint chứa gì) nhưng
// vẫn nằm trong cùng module "Pro compiler" và tái dùng đúng normalizeAndRepair
// như compileProGame(), không có logic runtime song song nào khác.
//
// Chỉ compile MỘT tập đã chọn (không gộp nhiều tập cùng lúc) — Global State
// giữa các tập chưa cần ở PRO 2 (xem mục 20/21 yêu cầu PRO 2). Vì scene ID đã
// namespaced theo episode.id (blueprintModel.makeSceneId/makeEndingId) ngay
// từ đầu, việc sau này gộp nhiều blueprint tập vào 1 đồ thị lớn (PRO 5+) sẽ
// không đụng ID — quyết định này KHÔNG cần thiết kế lại data model.
export function compileEpisodeBlueprint(sceneBlueprint, { title } = {}) {
  if (!sceneBlueprint || !sceneBlueprint.scenes?.length) {
    throw new Error("Sơ đồ cảnh trống — chưa có cảnh nào để chơi thử.");
  }

  const rawNodes = {};

  function resolveTarget(choice) {
    if (choice.targetType === "scene" && choice.targetId) return choice.targetId;
    if (choice.targetType === "ending" && choice.targetId) return choice.targetId;
    return null;
  }

  for (const scene of sceneBlueprint.scenes) {
    const isEndingRole = scene.role === SCENE_ROLES.ENDING;
    const choices = isEndingRole
      ? []
      : scene.choices.map((c) => ({
          text: c.text?.trim() || "Tiếp tục",
          targetNodeId: resolveTarget(c),
        }));
    rawNodes[scene.id] = {
      id: scene.id,
      speaker: "",
      text: scene.intent?.trim() || scene.title || "",
      title: scene.title || "",
      bgImage: "",
      isEnding: isEndingRole,
      endingType: isEndingRole ? "NORMAL_END" : null,
      choices,
    };
  }

  for (const ending of sceneBlueprint.endings || []) {
    rawNodes[ending.id] = {
      id: ending.id,
      speaker: "",
      text: ending.text?.trim() || ending.title || "",
      title: ending.title || "",
      bgImage: "",
      isEnding: true,
      endingType: ending.tone === "death" ? "BAD_END" : "NORMAL_END",
      choices: [],
    };
  }

  // start_node là quy ước bắt buộc của normalizeAndRepair/GamePlayer — đổi
  // tên cảnh bắt đầu của blueprint thành đúng id đó thay vì đoán lại từ đầu.
  if (sceneBlueprint.startSceneId && rawNodes[sceneBlueprint.startSceneId] && sceneBlueprint.startSceneId !== "start_node") {
    const start = { ...rawNodes[sceneBlueprint.startSceneId], id: "start_node" };
    delete rawNodes[sceneBlueprint.startSceneId];
    rawNodes["start_node"] = start;
    for (const n of Object.values(rawNodes)) {
      for (const c of n.choices || []) {
        if (c.targetNodeId === sceneBlueprint.startSceneId) c.targetNodeId = "start_node";
      }
    }
  }

  const { nodes, warnings } = normalizeAndRepair(rawNodes, [], 0, { forceNonEmptyModifiers: false });

  const meta = {
    title: title || "Chơi thử tập",
    presentation: "dialogue",
    theme: "lily-noir",
    archetype: "none",
    player_name: "Nhân Vật Chính",
    playerAvatar: "",
    defaultNpcAvatar: "",
    statsConfig: [],
    initialStats: {},
    builder: "pro",
  };

  return { meta, nodes, warnings };
}
