import test from "node:test";
import assert from "node:assert/strict";
import { generateStandaloneHTML } from "../src/lib/gameStudio/rpgExport.js";

test("standalone game menu puts exit directly below restart", () => {
  const html = generateStandaloneHTML({
    meta: { title: "Test", statsConfig: [] },
    nodes: { start_node: { id: "start_node", text: "Mở", choices: [], isEnding: true } },
  });
  const restart = html.indexOf('id="menuReset"');
  const exit = html.indexOf('id="menuExit"');
  assert.ok(restart >= 0);
  assert.ok(exit > restart);
  assert.match(html, /Thoát game/);
  assert.match(html, /function exitGame\(\)/);
});

test("standalone timeline keeps the previous choice inside history instead of the current scene", () => {
  const html = generateStandaloneHTML({
    meta: { title: "Timeline", statsConfig: [], playbackLayout: "timeline" },
    nodes: { start_node: { id: "start_node", text: "Mở", choices: [], isEnding: true } },
  });

  assert.match(html, /recapHtml=\(meta\.playbackLayout\|\|"timeline"\)==="focus"\?renderRecapCard\(\):""/);
  assert.match(html, /Bạn đã chọn ·/);
});
