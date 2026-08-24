const clean = (value) => String(value || "").trim();
const stripMarkdown = (value) => clean(value)
  .replace(/^#{1,6}\s*/, "")
  .replace(/^\*\*(.*?)\*\*$/, "$1")
  .trim();

const SCENE_HEADING = /^\s*#{0,6}\s*CẢNH\s+([0-9]+)(?:\s*[—–-]\s*(.*))?\s*$/iu;
const ENDING_HEADING = /^\s*#{0,6}\s*KẾT\s*THÚC\s+([^\s—–]+)(?:\s*[—–-]\s*(.*?))?(?:\s*\[(TRUE_END|GOOD_END|NORMAL_END|BAD_END)\])?\s*$/iu;
const CHAPTER_HEADING = /^\s*#{0,6}\s*(?:HỒI|CHƯƠNG)\s+([0-9IVXLCDM]+)\s*[:—–-]?\s*(.*)$/iu;
const CHOICE_LINE = /^\s*(?:\*\*)?([A-Z])\s*[—–-]\s*(.*?)(?:\*\*)?\s*$/u;
const EFFECT_LINE = /^\s*(?:→|->|=>)\s*(.+?)\s*$/u;

function titleFromHeader(lines) {
  for (const line of lines) {
    const text = stripMarkdown(line);
    if (!text || /^(?:thể loại|tác giả|chỉ số|thông báo|cấp bậc)\s*:/iu.test(text) || CHAPTER_HEADING.test(line)) continue;
    return text;
  }
  return "Kịch bản nhập từ TXT";
}

function valueAfterLabel(lines, label) {
  const regex = new RegExp(`^(?:\\*\\*)?${label}\\s*:\\s*(.*?)(?:\\*\\*)?$`, "iu");
  for (const line of lines) {
    const match = clean(line).match(regex);
    if (match) return clean(match[1]);
  }
  return "";
}

function endingFromLine(line) {
  const match = clean(line).match(ENDING_HEADING);
  if (!match) return null;
  const tail = clean(match[2]);
  const typeInTail = tail.match(/\[(TRUE_END|GOOD_END|NORMAL_END|BAD_END)\]\s*$/iu)?.[1];
  return {
    name: clean(match[1]),
    title: clean(tail.replace(/\s*\[(?:TRUE_END|GOOD_END|NORMAL_END|BAD_END)\]\s*$/iu, "")),
    type: match[3] || typeInTail || "NORMAL_END",
    description: "",
  };
}

function parseSceneBlock(block, chapterIndex) {
  const heading = clean(block[0]).match(SCENE_HEADING);
  const sceneOrder = Number(heading?.[1]);
  const title = clean(heading?.[2]) || `Cảnh ${sceneOrder}`;
  const choices = [];
  const prose = [];
  let currentChoice = null;

  for (const rawLine of block.slice(1)) {
    const line = clean(rawLine);
    const choiceMatch = line.match(CHOICE_LINE);
    if (choiceMatch) {
      currentChoice = { text: clean(choiceMatch[2]), effectParts: [], target: "" };
      choices.push(currentChoice);
      continue;
    }
    const effectMatch = line.match(EFFECT_LINE);
    if (effectMatch) {
      const effect = clean(effectMatch[1]);
      const sceneTarget = effect.match(/^(?:đến\s+)?cảnh\s+([0-9]+)/iu);
      const endingTarget = effect.match(/^(?:đến\s+)?kết\s*thúc\s+(.+)/iu) || effect.match(/^đến\s+([^\s]+)$/iu);
      if (currentChoice && sceneTarget) currentChoice.target = `cảnh ${sceneTarget[1]}`;
      else if (currentChoice && endingTarget) currentChoice.target = `kết thúc ${clean(endingTarget[1])}`;
      else if (currentChoice) currentChoice.effectParts.push(`→ ${effect}`);
      // Chỉ dụ/Hệ thống ở cấp cảnh được giữ trong raw script, không trộn vào văn xuôi.
      continue;
    }
    if (!currentChoice && line) prose.push(stripMarkdown(line));
  }

  return {
    scene_order: sceneOrder,
    title,
    description: prose.join("\n\n"),
    location: "",
    characters: "",
    foreshadow: "",
    state_contract: {},
    chapter_index: chapterIndex,
    is_checkpoint: false,
    choices: choices.map((choice) => ({ text: choice.text, effect: choice.effectParts.join("; "), target: choice.target })),
    is_branch_point: choices.length > 1,
    branch_index: null,
    rawScript: block.join("\n").trim(),
  };
}

/**
 * Chuyển một kịch bản Xưởng Game có sẵn thành dữ liệu Xưởng Kịch Bản.
 * Hoàn toàn chạy tại máy; không gọi AI và không sửa nội dung nguồn.
 */
export function importExistingScript(scriptText) {
  const source = String(scriptText || "").replace(/\r\n?/g, "\n").trim();
  if (!source) throw new Error("Kịch bản đang trống.");
  const lines = source.split("\n");
  const sceneStarts = [];
  let firstEnding = -1;
  for (let index = 0; index < lines.length; index++) {
    if (SCENE_HEADING.test(lines[index])) sceneStarts.push(index);
    if (firstEnding < 0 && ENDING_HEADING.test(lines[index])) firstEnding = index;
  }
  if (!sceneStarts.length) throw new Error('Không tìm thấy cảnh nào. Mỗi cảnh cần dòng "CẢNH 1 — Tên cảnh".');

  const headerEnd = sceneStarts[0];
  const headerLines = lines.slice(0, headerEnd);
  const title = titleFromHeader(headerLines);
  const genre = valueAfterLabel(headerLines, "Thể loại");
  const author = valueAfterLabel(headerLines, "Tác giả");
  const endings = [];
  if (firstEnding >= 0) {
    for (let index = firstEnding; index < lines.length; index++) {
      const ending = endingFromLine(lines[index]);
      if (!ending) continue;
      const body = [];
      for (let cursor = index + 1; cursor < lines.length && !ENDING_HEADING.test(lines[cursor]); cursor++) body.push(lines[cursor]);
      ending.description = body.join("\n").trim();
      endings.push(ending);
    }
  }

  const scenes = [];
  for (let position = 0; position < sceneStarts.length; position++) {
    const start = sceneStarts[position];
    const end = position + 1 < sceneStarts.length ? sceneStarts[position + 1] : (firstEnding >= 0 ? firstEnding : lines.length);
    const chapterIndex = Math.max(1, lines.slice(0, start).filter((line) => CHAPTER_HEADING.test(line)).length);
    scenes.push(parseSceneBlock(lines.slice(start, end), chapterIndex));
  }
  if (scenes.length) scenes[0].is_checkpoint = true;
  for (let index = 1; index < scenes.length; index++) if (scenes[index].chapter_index !== scenes[index - 1].chapter_index) scenes[index].is_checkpoint = true;

  const intro = headerLines.filter((line) => {
    const text = stripMarkdown(line);
    return text && text !== title && !/^(?:thể loại|tác giả|chỉ số|thông báo|cấp bậc)\s*:/iu.test(text) && !CHAPTER_HEADING.test(line);
  }).join("\n").trim();
  const player = source.match(/\bTa\s*[—–-]\s*([^—–\n]+?)\s*[—–-]/u)?.[1]?.trim()
    || source.match(/(?:nhân vật chính|người chơi)\s*:\s*([^,\n]+)/iu)?.[1]?.trim()
    || "Nhân vật chính";

  const normalizedHeader = [`# ${title}`, ...headerLines.slice(1)].join("\n").trim();
  if (scenes[0]) scenes[0].rawScript = `${normalizedHeader}\n\n${scenes[0].rawScript}`.trim();
  if (scenes.length && firstEnding >= 0) scenes[scenes.length - 1].rawScript += `\n\n${lines.slice(firstEnding).join("\n").trim()}`;

  return {
    source,
    title,
    genre,
    author,
    intro,
    player_name: player,
    player_desc: `Nhân vật chính của “${title}”.`,
    main_quest: `Hoàn thành tuyến truyện chính của “${title}”.`,
    scenes,
    endings: endings.map((ending) => ({ name: ending.name, type: ending.type, description: [ending.title, ending.description].filter(Boolean).join(": ") })),
    chapters: Math.max(...scenes.map((scene) => scene.chapter_index), 1),
    maxChoices: Math.max(...scenes.map((scene) => scene.choices.length), 1),
  };
}
