import test from "node:test";
import assert from "node:assert/strict";
import { removeOrphanGrant } from "../src/lib/gameStudio/orphanFixer.js";

function gameDataFixture() {
  return {
    nodes: {
      scene_13: { id: "scene_13", grantItem: null, choices: [{ text: "Nhận túi thơm", grantItem: "tui_thom_binh_an" }] },
      scene_5: { id: "scene_5", grantItem: null, setFlags: [], choices: [{ text: "Hứa ở lại", grantFlags: ["da_hua_o_lai"], grantFlag: "da_hua_o_lai" }] },
      scene_9: { id: "scene_9", grantItem: "khong_lien_quan", choices: [{ text: "Bình thường", statModifiers: { hp: 1 } }] },
    },
  };
}

test("removeOrphanGrant xoá đúng grantItem trên lựa chọn, giữ nguyên lựa chọn/cảnh khác", () => {
  const gd = gameDataFixture();
  const next = removeOrphanGrant(gd, { kind: "item", name: "tui_thom_binh_an" });
  assert.equal(next.nodes.scene_13.choices[0].grantItem, null);
  assert.equal(next.nodes.scene_13.choices[0].text, "Nhận túi thơm");
  assert.equal(next.nodes.scene_9.grantItem, "khong_lien_quan"); // không đụng vật phẩm khác
  assert.notEqual(next, gd); // bất biến
  assert.equal(gd.nodes.scene_13.choices[0].grantItem, "tui_thom_binh_an"); // bản gốc không đổi
});

test("removeOrphanGrant xoá đúng cờ khỏi grantFlags và grantFlag, giữ nguyên phần khác", () => {
  const gd = gameDataFixture();
  const next = removeOrphanGrant(gd, { kind: "flag", name: "da_hua_o_lai" });
  assert.deepEqual(next.nodes.scene_5.choices[0].grantFlags, []);
  assert.equal(next.nodes.scene_5.choices[0].grantFlag, null);
});

test("removeOrphanGrant trả về nguyên gameData nếu không tìm thấy gì để xoá", () => {
  const gd = gameDataFixture();
  const next = removeOrphanGrant(gd, { kind: "item", name: "khong_ton_tai" });
  assert.equal(next, gd);
});

test("removeOrphanGrant trả về nguyên gameData nếu orphan null/rỗng", () => {
  const gd = gameDataFixture();
  assert.equal(removeOrphanGrant(gd, null), gd);
  assert.equal(removeOrphanGrant(gd, { kind: "item", name: "" }), gd);
});
