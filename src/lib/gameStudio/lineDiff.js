// Diff dòng-theo-dòng (LCS chuẩn) để hiển thị "trước/sau" khi AI sửa kịch
// bản — không thêm thư viện ngoài (fast-diff có trong node_modules chỉ là
// dependency GIÁN TIẾP của một gói khác, không khai báo trong package.json,
// nên không an toàn để import trực tiếp). Kịch bản dài nhất (~60 cảnh, cỡ vài
// trăm dòng) vẫn nằm trong tầm O(n·m) của LCS, không cần thuật toán phức tạp
// hơn (Myers...).

/**
 * @param {string} oldText
 * @param {string} newText
 * @returns {Array<{type: "same"|"add"|"remove", line: string}>}
 */
export function diffLines(oldText, newText) {
  const a = String(oldText || "").split("\n");
  const b = String(newText || "").split("\n");
  const n = a.length;
  const m = b.length;

  const dp = new Array(n + 1);
  for (let i = 0; i <= n; i++) dp[i] = new Int32Array(m + 1);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push({ type: "same", line: a[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "remove", line: a[i] });
      i++;
    } else {
      result.push({ type: "add", line: b[j] });
      j++;
    }
  }
  while (i < n) { result.push({ type: "remove", line: a[i] }); i++; }
  while (j < m) { result.push({ type: "add", line: b[j] }); j++; }
  return result;
}

/** true nếu 2 văn bản giống hệt nhau (dùng để bỏ qua diff khi AI không đổi gì). */
export function isSameText(oldText, newText) {
  return String(oldText || "") === String(newText || "");
}
