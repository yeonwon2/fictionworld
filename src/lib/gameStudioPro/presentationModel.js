import { READING_THEMES, READING_EFFECTS } from "../gameStudio/readingThemes.js";

// Chỉ hệ Reading Themes mới; rpgThemes.js vẫn dành cho tương thích Legacy.
export const PRO_THEME_IDS = Object.freeze(Object.keys(READING_THEMES));
export const PRO_EFFECT_IDS = Object.freeze(Object.keys(READING_EFFECTS));
export const DEFAULT_PRO_THEME_ID = "inkwash";
export const DEFAULT_PRO_EFFECT_ID = "none";

export function ensureProPresentation(value) {
  return {
    themeId: PRO_THEME_IDS.includes(value?.themeId) ? value.themeId : DEFAULT_PRO_THEME_ID,
    backgroundEffectId: PRO_EFFECT_IDS.includes(value?.backgroundEffectId) ? value.backgroundEffectId : DEFAULT_PRO_EFFECT_ID,
  };
}
export function updateProPresentation(proDoc, patch) {
  return { ...proDoc, presentation: ensureProPresentation({ ...ensureProPresentation(proDoc?.presentation), ...patch }) };
}
export function presentationRuntimeMeta(source) {
  const value = ensureProPresentation(source?.presentation || source);
  return { readingTheme: value.themeId, readingEffect: value.backgroundEffectId };
}
export function listProThemes() { return PRO_THEME_IDS.map((id) => READING_THEMES[id]); }
export function listProEffects() { return PRO_EFFECT_IDS.map((id) => ({ id, label: id === "none" ? "Không hiệu ứng" : READING_EFFECTS[id] })); }
