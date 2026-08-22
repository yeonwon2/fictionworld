const SCENE_RE = /^##\s*CẢNH\s+(\d+)\b/im;

/** Kiểm tra tĩnh những lỗi làm parser Xưởng Game không thể nối thành game. */
export function validateGameScript(text, expectedScenes = 0) {
  const source = String(text || "").replace(/\r\n/g, "\n");
  const errors = [];
  const warnings = [];
  const sceneIds = [...source.matchAll(/^##\s*CẢNH\s+(\d+)\b.*$/gim)].map((m) => Number(m[1]));
  const endings = [...source.matchAll(/^##\s*KẾT THÚC\s+(\S+)\b.*\[(TRUE_END|GOOD_END|NORMAL_END|BAD_END)\]\s*$/gim)].map((m) => m[1]);
  const sceneSet = new Set(sceneIds);
  const endingSet = new Set(endings);

  if (!SCENE_RE.test(source)) errors.push('Không tìm thấy khối "## CẢNH N".');
  if (!/^##\s*GIỚI THIỆU\s*$/im.test(source)) errors.push('Thiếu khối "## GIỚI THIỆU".');
  if (!endings.length) errors.push('Thiếu khối kết thúc hợp lệ và loại [TRUE_END|GOOD_END|NORMAL_END|BAD_END].');
  if (sceneIds.length !== sceneSet.size) errors.push("Có số cảnh bị lặp trong kịch bản cuối.");
  if (expectedScenes && sceneIds.length !== Number(expectedScenes)) errors.push(`Có ${sceneIds.length}/${expectedScenes} cảnh theo thiết lập.`);
  for (let n = 1; n <= Number(expectedScenes || 0); n++) if (!sceneSet.has(n)) errors.push(`Thiếu CẢNH ${n}.`);
  for (const match of source.matchAll(/(?:→|->|=>)\s*Đến\s+cảnh\s+(\d+)\b/gim)) {
    if (!sceneSet.has(Number(match[1]))) errors.push(`Đích "Đến cảnh ${match[1]}" không tồn tại.`);
  }
  for (const match of source.matchAll(/(?:→|->|=>)\s*(?:Đến\s+)?Kết\s+thúc\s+(\S+)\s*$/gim)) {
    if (!endingSet.has(match[1])) errors.push(`Đích "Kết thúc ${match[1]}" không có khối kết thúc khớp.`);
  }
  const blocks = source.split(/(?=^##\s*CẢNH\s+\d+\b)/gim).slice(1);
  for (const block of blocks) {
    const number = block.match(/^##\s*CẢNH\s+(\d+)/i)?.[1] || "?";
    const choices = [...block.matchAll(/^\*\*[A-ZĐ]\s*[—\-:.)]\s*.+\*\*\s*$/gim)].length;
    if (choices < 1) errors.push(`CẢNH ${number} không có lựa chọn hợp lệ.`);
    else if (choices < 2) warnings.push(`CẢNH ${number} chỉ có ${choices} lựa chọn.`);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], sceneCount: sceneIds.length, endingCount: endings.length };
}
