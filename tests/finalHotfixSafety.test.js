import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LEGACY_GAME_FILTER, isLegacyGameBuilder } from "../src/lib/gameListFilters.js";

test("Legacy game filter excludes only builder=pro and keeps null/other builders", () => {
  assert.equal(LEGACY_GAME_FILTER, "meta->>builder.neq.pro,meta->>builder.is.null");
  assert.equal(isLegacyGameBuilder("pro"), false);
  assert.equal(isLegacyGameBuilder(null), true);
  assert.equal(isLegacyGameBuilder(undefined), true);
  assert.equal(isLegacyGameBuilder("legacy"), true);
  assert.equal(isLegacyGameBuilder("ai-workshop"), true);
});

test("web app manifest keeps every internal route inside standalone scope", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.ok(manifest.name && manifest.short_name && manifest.theme_color && manifest.background_color);
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
});
