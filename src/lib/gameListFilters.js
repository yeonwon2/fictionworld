// PostgREST filter dùng chung cho thư viện Xưởng Game Legacy.
// Fail-safe: chỉ builder "pro" bị loại; mọi builder cũ/khác/không có vẫn là Legacy.
export const LEGACY_GAME_FILTER = "meta->>builder.neq.pro,meta->>builder.is.null";

export function isLegacyGameBuilder(builder) {
  return builder !== "pro";
}
