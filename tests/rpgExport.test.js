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

test("standalone keeps the previous choice only inside history", () => {
  const html = generateStandaloneHTML({
    meta: { title: "Timeline", statsConfig: [], playbackLayout: "timeline" },
    nodes: { start_node: { id: "start_node", text: "Mở", choices: [], isEnding: true } },
  });

  assert.match(html, /recapHtml=""/);
  assert.match(html, /Bạn đã chọn ·/);
});

test("standalone mobile layout does not pin controls over game content", () => {
  const html = generateStandaloneHTML({
    meta: { title: "Mobile", statsConfig: [], playbackLayout: "timeline" },
    nodes: { start_node: { id: "start_node", text: "Mở", choices: [], isEnding: true } },
  });

  assert.match(html, /\.rpg-topbar\{position:relative;top:auto;z-index:2/);
  assert.match(html, /\.rpg-vn-choices\{position:relative;bottom:auto;z-index:2;max-height:none;overflow:visible/);
});

test("standalone skip keeps long scene text inside its scroll area", () => {
  const html = generateStandaloneHTML({
    meta: { title: "Long scene", statsConfig: [], playbackLayout: "timeline" },
    nodes: { start_node: { id: "start_node", text: "Nội dung dài", choices: [] } },
  });

  assert.doesNotMatch(html, /rpg-vn-text-scroll expanded/);
  assert.match(html, /syncTextScrollExpand\(node\)\{[^}]*classList\.toggle\("expanded", hidden\)/);
  assert.match(html, /\.rpg-vn-text-scroll\.expanded\{max-height:calc\(100dvh - 190px/);
});

test("standalone stat chips stay above long scene content", () => {
  const html = generateStandaloneHTML({
    meta: { title: "Stats", statsConfig: [{ key: "trust", label: "Tin tưởng" }] },
    nodes: { start_node: { id: "start_node", text: "Nội dung dài", choices: [] } },
  });

  assert.match(html, /\.rpg-stats-compact\{position:relative;z-index:4;isolation:isolate;display:flex;flex:0 0 38px/);
  assert.match(html, /\.rpg-vn-frame\{position:relative;z-index:1/);
});
