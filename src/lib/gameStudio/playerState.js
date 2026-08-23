const SAVE_VERSION = 1;

export function playerSaveKey(gameKey) {
  return gameKey ? `fictionworld:rpg-save:${gameKey}` : "";
}

export function loadPlayerState(gameKey, nodes, storage = globalThis.localStorage) {
  const key = playerSaveKey(gameKey);
  if (!key || !storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(key));
    if (parsed?.version !== SAVE_VERSION || !parsed.runtime || !nodes?.[parsed.runtime.nodeId]) return null;
    return parsed;
  } catch (_) { return null; }
}

export function savePlayerState(gameKey, runtime, storage = globalThis.localStorage) {
  const key = playerSaveKey(gameKey);
  if (!key || !storage || !runtime?.nodeId) return false;
  try {
    storage.setItem(key, JSON.stringify({ version: SAVE_VERSION, savedAt: new Date().toISOString(), runtime }));
    return true;
  } catch (_) { return false; }
}

export function clearPlayerState(gameKey, storage = globalThis.localStorage) {
  const key = playerSaveKey(gameKey);
  if (!key || !storage) return;
  try { storage.removeItem(key); } catch (_) { /* storage may be unavailable */ }
}

