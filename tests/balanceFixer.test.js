import test from "node:test";
import assert from "node:assert/strict";
import { computeBalanceFixOptions, replayStatAlongRoute } from "../src/lib/gameStudio/balanceFixer.js";

function gameDataFixture() {
  return {
    nodes: {
      scene_1: {
        id: "scene_1",
        choices: [
          { text: "An toàn", statModifiers: { hp: -2 } },
          { text: "Liều lĩnh", statModifiers: { hp: -45 } },
        ],
      },
      scene_2: {
        id: "scene_2",
        choices: [{ text: "Cũng liều", statModifiers: { hp: -30 } }],
      },
    },
    meta: {
      statsConfig: [{ key: "hp", label: "HP", default: 50, isVital: true, deathThreshold: 9 }],
    },
  };
}

test("replayStatAlongRoute cộng dồn đúng statModifiers theo đúng thứ tự route", () => {
  const gd = gameDataFixture();
  const value = replayStatAlongRoute(gd.nodes, 50, [{ sceneId: "scene_1", choiceIndex: 1 }], "hp");
  assert.equal(value, 5); // 50 - 45
});

test("computeBalanceFixOptions tính đúng phương án nới nhẹ (giảm một nửa) và tăng vốn (dựa trên tuyến chết thật)", () => {
  const gd = gameDataFixture();
  const finding = {
    category: "balance",
    deadStat: "hp",
    route: [{ sceneId: "scene_1", choiceIndex: 1 }], // 50 - 45 = 5 <= 9 → chết
  };
  const result = computeBalanceFixOptions(gd, finding);
  assert.equal(result.statKey, "hp");
  assert.equal(result.affectedCount, 3); // -2, -45, -30 trên toàn kịch bản

  const halve = result.options.find((o) => o.id === "halve");
  const edits = halve.preview.reduce((m, e) => ({ ...m, [e.current]: e.next }), {});
  assert.equal(edits[-2], -1);
  assert.equal(edits[-45], -23); // round(45/2)=23
  assert.equal(edits[-30], -15);

  // Tuyến chết thật dừng ở 5, ngưỡng chết là 9 → cần thêm 9-5+1=5 điểm khởi đầu để vượt qua.
  const buffer = result.options.find((o) => o.id === "buffer");
  assert.equal(buffer.preview[0].next, 55);

  const keep = result.options.find((o) => o.id === "keep");
  assert.equal(keep.apply, null);
});

test("apply của phương án halve chỉ sửa đúng các lựa chọn đang trừ chỉ số đó, giữ nguyên phần còn lại", () => {
  const gd = gameDataFixture();
  const finding = { category: "balance", deadStat: "hp", route: [{ sceneId: "scene_1", choiceIndex: 1 }] };
  const result = computeBalanceFixOptions(gd, finding);
  const next = result.options.find((o) => o.id === "halve").apply(gd);
  assert.equal(next.nodes.scene_1.choices[0].statModifiers.hp, -1);
  assert.equal(next.nodes.scene_1.choices[1].statModifiers.hp, -23);
  assert.equal(next.nodes.scene_2.choices[0].statModifiers.hp, -15);
  assert.equal(next.nodes.scene_1.choices[0].text, "An toàn"); // không đổi phần khác
  assert.notEqual(next, gd); // bất biến (immutable), không sửa object gốc
  assert.equal(gd.nodes.scene_1.choices[1].statModifiers.hp, -45);
});

test("apply của phương án buffer chỉ đổi statsConfig.default, không đụng nodes", () => {
  const gd = gameDataFixture();
  const finding = { category: "balance", deadStat: "hp", route: [{ sceneId: "scene_1", choiceIndex: 1 }] };
  const result = computeBalanceFixOptions(gd, finding);
  const next = result.options.find((o) => o.id === "buffer").apply(gd);
  assert.equal(next.meta.statsConfig[0].default, 55);
  assert.equal(next.nodes, gd.nodes);
});

test("computeBalanceFixOptions trả về null nếu finding không phải loại balance hoặc chỉ số không tồn tại", () => {
  const gd = gameDataFixture();
  assert.equal(computeBalanceFixOptions(gd, { category: "static", deadStat: "hp" }), null);
  assert.equal(computeBalanceFixOptions(gd, { category: "balance", deadStat: "khong_ton_tai" }), null);
});
