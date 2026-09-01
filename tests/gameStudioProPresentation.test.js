import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { newEmptyProGame } from "../src/lib/gameStudioPro/proModel.js";
import { compileProGame, compileProDocument } from "../src/lib/gameStudioPro/proCompiler.js";
import { ensureProPresentation, updateProPresentation, PRO_THEME_IDS, PRO_EFFECT_IDS, DEFAULT_PRO_THEME_ID } from "../src/lib/gameStudioPro/presentationModel.js";
import { READING_THEMES, READING_EFFECTS } from "../src/lib/gameStudio/readingThemes.js";
import { generateStandaloneHTML } from "../src/lib/gameStudio/rpgExport.js";

test("old Pro doc gets a safe default from the new theme registry", () => {
  const value = ensureProPresentation(undefined);
  assert.equal(value.themeId, DEFAULT_PRO_THEME_ID);
  assert.ok(READING_THEMES[value.themeId]);
  assert.equal(value.backgroundEffectId, "none");
});

test("selected new theme and effect persist without changing authored content", () => {
  const original = newEmptyProGame();
  const authored = JSON.stringify({ choices: original.choices, endings: original.endings, globalState: original.globalState });
  const changed = updateProPresentation(original, { themeId: "palace", backgroundEffectId: "snow" });
  const reloaded = JSON.parse(JSON.stringify(changed));
  assert.deepEqual(reloaded.presentation, { themeId: "palace", backgroundEffectId: "snow" });
  assert.equal(JSON.stringify({ choices: changed.choices, endings: changed.endings, globalState: changed.globalState }), authored);
});

test("compiler, GamePlayer input and standalone export preserve presentation", () => {
  const proDoc = updateProPresentation(newEmptyProGame(), { themeId: "system", backgroundEffectId: "snow" });
  const direct = compileProGame(proDoc);
  const document = compileProDocument(proDoc).compiled;
  for (const result of [direct, document]) {
    assert.equal(result.meta.readingTheme, "system");
    assert.equal(result.meta.readingEffect, "snow");
    const html = generateStandaloneHTML(result);
    assert.match(html, /"readingTheme":"system"/);
    assert.match(html, /"readingEffect":"snow"/);
  }
});

test("Pro allowlists exactly reuse the new registries and exclude old systems", () => {
  assert.deepEqual(PRO_THEME_IDS, Object.keys(READING_THEMES));
  assert.deepEqual(PRO_EFFECT_IDS, Object.keys(READING_EFFECTS));
  for (const oldId of ["lily-noir", "fantasy-parchment", "imperial-gold", "aaa-dark"]) assert.equal(PRO_THEME_IDS.includes(oldId), false);
  for (const oldId of ["embers", "sparkle", "steam", "dust"]) assert.equal(PRO_EFFECT_IDS.includes(oldId), false);
});

test("presentation changes are local and make zero AI/provider calls", () => {
  let calls = 0;
  const before = newEmptyProGame();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls += 1; throw new Error("unexpected"); };
  try { updateProPresentation(before, { themeId: "palace", backgroundEffectId: "snow" }); }
  finally { globalThis.fetch = previousFetch; }
  assert.equal(calls, 0);
});

test("mobile picker uses a one-column base grid and overflow-safe cards", () => {
  const source = fs.readFileSync(new URL("../src/components/game-studio-pro/PresentationPicker.jsx", import.meta.url), "utf8");
  assert.match(source, /grid-cols-1/);
  assert.match(source, /sm:grid-cols-2/);
  assert.match(source, /min-w-0/);
  assert.match(source, /break-words/);
});
