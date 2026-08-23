import test from "node:test";
import assert from "node:assert/strict";
import { clearPlayerState, loadPlayerState, playerSaveKey, savePlayerState } from "../src/lib/gameStudio/playerState.js";

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) };
}

test("player state round-trips and validates its node", () => {
  const storage = memoryStorage();
  assert.equal(savePlayerState("game-1", { nodeId: "scene_2", stats: { hp: 10 } }, storage), true);
  assert.equal(loadPlayerState("game-1", { scene_2: {} }, storage).runtime.stats.hp, 10);
  assert.equal(loadPlayerState("game-1", { scene_3: {} }, storage), null);
});

test("player save can be cleared", () => {
  const storage = memoryStorage();
  savePlayerState("game-2", { nodeId: "start_node" }, storage);
  clearPlayerState("game-2", storage);
  assert.equal(storage.getItem(playerSaveKey("game-2")), null);
});

