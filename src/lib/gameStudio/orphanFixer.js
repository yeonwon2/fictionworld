// "Xoá" 1 click cho gợi ý vật phẩm/cờ mồ côi (finding.orphan từ gameTestReport.js,
// suy ra bằng extractOrphanName() có sẵn ở postprocess.js) — an toàn vì gợi ý
// này CHỈ xuất hiện khi KHÔNG lựa chọn nào đang cần tới vật phẩm/cờ đó, nên
// xoá nguồn cấp không đổi cách chơi ở đâu cả. Cùng triết lý với removeGrantLines
// trong scriptTextEdits.js (ScriptImporter.jsx dùng cho kịch bản TEXT của Xưởng
// Offline), nhưng thao tác trên gameData.nodes (Canonical Script Model) để dùng
// chung được cho cả 5 xưởng, giống cách balanceFixer.js/RouteExplorerTab.jsx
// đã sửa dữ liệu game.

/**
 * Xoá mọi nơi đang CẤP (không phải yêu cầu) vật phẩm/cờ mồ côi khỏi gameData.nodes.
 * @param {Object} gameData - { nodes, meta } đang mở.
 * @param {{kind:"item"|"flag", name:string}} orphan
 * @returns {Object} gameData mới (bất biến) — trả về NGUYÊN gameData nếu không tìm thấy gì để xoá.
 */
export function removeOrphanGrant(gameData, orphan) {
  if (!orphan || !orphan.name) return gameData;
  const { kind, name } = orphan;
  const nodes = { ...(gameData.nodes || {}) };
  let changed = false;

  for (const [id, node] of Object.entries(nodes)) {
    let nextNode = node;

    if (kind === "item" && node.grantItem === name) {
      nextNode = { ...nextNode, grantItem: null };
      changed = true;
    }
    if (kind === "flag" && Array.isArray(node.setFlags) && node.setFlags.includes(name)) {
      nextNode = { ...nextNode, setFlags: node.setFlags.filter((f) => f !== name) };
      changed = true;
    }

    if (Array.isArray(node.choices)) {
      const nextChoices = node.choices.map((c) => {
        if (kind === "item" && c.grantItem === name) {
          changed = true;
          return { ...c, grantItem: null };
        }
        if (kind === "flag" && Array.isArray(c.grantFlags) && c.grantFlags.includes(name)) {
          changed = true;
          return { ...c, grantFlags: c.grantFlags.filter((f) => f !== name), grantFlag: c.grantFlag === name ? null : c.grantFlag };
        }
        return c;
      });
      if (nextChoices.some((c, i) => c !== node.choices[i])) nextNode = { ...nextNode, choices: nextChoices };
    }

    if (nextNode !== node) nodes[id] = nextNode;
  }

  return changed ? { ...gameData, nodes } : gameData;
}
