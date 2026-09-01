// Compiler/Adapter: Pro Model (proModel.js) -> dữ liệu game mà GamePlayer /
// ExportCenter / rpgExport hiện tại đã hiểu (`{meta, nodes}` giống hệt Xưởng
// Game cũ). Cố tình viết mỏng — không tự làm lại việc vá/chuẩn hoá node graph
// mà gọi thẳng `normalizeAndRepair` (đã dùng bởi mọi parser của Xưởng Game
// cũ), để Pro không có một bản sao logic runtime riêng.
import { normalizeAndRepair } from "@/lib/gameStudio/postprocess";

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
