// Xưởng Game Pro — PRO 4: PARSER ĐỊNH DẠNG FICTIONWORLD PRO SCRIPT v1
//
// Phân tích kịch bản theo định dạng trao đổi chính thức (DSL) thành AST có vị trí
// dòng (line numbers). Parser 100% CỤC BỘ (pure JS, không gọi AI, 0 token cost).
import { SCRIPT_HEADER_PREFIX, SCRIPT_FORMAT_VERSION, normalizeRole, normalizeTone } from "./scriptFormat.js";

const MAX_SCRIPT_CHARS = 500000;
const MAX_SCENES = 100;
const MAX_CHOICES_PER_SCENE = 12;

const DANGEROUS_KEYS = new Set(["__proto__", "proto", "constructor", "prototype"]);

// Làm sạch một dòng thô: bỏ markdown headings, bold markers, trailing/leading whitespace.
export function cleanLine(raw) {
  if (raw === undefined || raw === null) return "";
  let line = String(raw).trim();
  // Strip code fence markers
  if (/^```(?:markdown|txt|dsl)?\s*$/i.test(line) || /^```\s*$/.test(line)) {
    return "";
  }
  // Strip leading markdown headers: #, ##, ###
  line = line.replace(/^#{1,6}\s+/, "");
  // Strip bold wrappers: **text** -> text
  line = line.replace(/\*\*([^*]+)\*\*/g, "$1");
  // Strip markdown double underscore only when surrounding words
  line = line.replace(/(?<!\w)__([^_]+)__(?!\w)/g, "$1");
  return line.trim();
}

// Bỏ ký tự đầu dòng kiểu danh sách (bullet / dash / asterisk / number dot)
export function stripBullet(line) {
  return String(line || "").replace(/^[-*•]\s+/, "").trim();
}

export function parseProScript(source) {
  const issues = []; // { line, message, type: "error" | "warning" }
  const recordIssue = (line, message, type = "error") => {
    issues.push({ line: Number(line) || 1, message: String(message || ""), type });
  };

  if (!source || typeof source !== "string") {
    recordIssue(1, "Nội dung kịch bản trống.");
    return { ast: null, issues, lines: [] };
  }

  if (source.length > MAX_SCRIPT_CHARS) {
    recordIssue(1, `Kịch bản quá dài (${source.length} ký tự, tối đa ${MAX_SCRIPT_CHARS}).`);
    return { ast: null, issues, lines: [] };
  }

  const rawLines = source.replace(/\r\n?/g, "\n").split("\n");
  const lines = rawLines.map((raw, idx) => ({ raw, clean: cleanLine(raw), lineNum: idx + 1 }));

  // 1. Kiểm tra header phiên bản
  let firstContentLine = null;
  for (const item of lines) {
    if (item.clean) {
      firstContentLine = item;
      break;
    }
  }

  if (!firstContentLine) {
    recordIssue(1, "Kịch bản trống — không có nội dung.");
    return { ast: null, issues, lines: rawLines };
  }

  const headerMatch = firstContentLine.clean.match(new RegExp(`^${SCRIPT_HEADER_PREFIX}(?:\\s+(v\\w+|\\w+))?`, "i"));
  if (!headerMatch) {
    recordIssue(
      firstContentLine.lineNum,
      `Dòng đầu tiên phải là tiêu đề định dạng: "FICTIONWORLD PRO SCRIPT ${SCRIPT_FORMAT_VERSION}".`
    );
  } else {
    const version = (headerMatch[1] || "").toLowerCase();
    if (version !== SCRIPT_FORMAT_VERSION) {
      recordIssue(
        firstContentLine.lineNum,
        `Phiên bản kịch bản "${headerMatch[1] || "không rõ"}" chưa được hỗ trợ. Chỉ hỗ trợ "${SCRIPT_FORMAT_VERSION}".`
      );
      return { ast: null, issues, lines: rawLines };
    }
  }

  // Khung AST
  const ast = {
    version: SCRIPT_FORMAT_VERSION,
    episodeTitle: "",
    stats: [], // { name, initial, isVital, deathThreshold, line }
    flags: [], // { name, line }
    items: [], // { name, line }
    relationships: [], // { name, npc, initial, line }
    scenes: [], // { line, title, role, intent, notes, choices, autoTarget, autoTargetKind, autoTargetLine }
    endings: [], // { line, title, tone, text }
  };

  // State machine context
  let currentSection = "meta"; // "meta" | "stats" | "flags" | "items" | "relationships" | "scene" | "ending"
  let currentScene = null;
  let currentChoice = null; // { line, text, outcomeBlocks: [] }
  let currentOutcomeBlock = null; // { line, conditions: [], effects: [], target, targetKind, targetLine, endingTone }
  let currentEnding = null;
  let readingBlock = null; // "intent" | "notes" | "ending_text" | "choice_text" | "target" | "ending_target" | "conditions" | "effects" | null
  let pendingEndingTone = "neutral";

  function newOutcomeBlock(lineNum = 1) {
    return {
      line: lineNum,
      conditions: [],
      effects: [],
      target: null,
      targetKind: null,
      targetLine: 0,
      endingTone: "neutral",
    };
  }

  function closeCurrentOutcomeBlock() {
    if (currentChoice && currentOutcomeBlock) {
      if (
        currentOutcomeBlock.conditions.length > 0 ||
        currentOutcomeBlock.effects.length > 0 ||
        currentOutcomeBlock.target
      ) {
        currentChoice.outcomeBlocks.push(currentOutcomeBlock);
      }
      currentOutcomeBlock = null;
    }
  }

  function closeCurrentChoice() {
    closeCurrentOutcomeBlock();
    if (currentScene && currentChoice) {
      currentScene.choices.push(currentChoice);
      currentChoice = null;
    }
  }

  function closeCurrentScene() {
    closeCurrentChoice();
    if (currentScene) {
      if (ast.scenes.length >= MAX_SCENES) {
        recordIssue(currentScene.line, `Vượt quá giới hạn ${MAX_SCENES} cảnh mỗi tập.`);
      } else {
        ast.scenes.push(currentScene);
      }
      currentScene = null;
    }
  }

  function closeCurrentEnding() {
    if (currentEnding) {
      ast.endings.push(currentEnding);
      currentEnding = null;
    }
  }

  function sanitizeEntityName(name, line) {
    const trimmed = String(name || "").trim();
    if (DANGEROUS_KEYS.has(trimmed.toLowerCase())) {
      recordIssue(line, `Tên "${trimmed}" không hợp lệ.`);
      return "";
    }
    return trimmed;
  }

  function getActiveOutcomeBlock(lineNum) {
    if (!currentOutcomeBlock) {
      currentOutcomeBlock = newOutcomeBlock(lineNum);
    }
    return currentOutcomeBlock;
  }

  for (let i = 0; i < lines.length; i++) {
    const { clean, raw, lineNum } = lines[i];

    // Bỏ qua dòng header nếu vừa kiểm tra xong
    if (firstContentLine && lineNum === firstContentLine.lineNum && clean.toUpperCase().startsWith(SCRIPT_HEADER_PREFIX)) {
      continue;
    }

    if (!clean) {
      // Dòng trống: nếu đang trong block intent/notes/ending_text nhiều dòng, tiếp tục nhưng không ép ngắt
      if (readingBlock === "target" || readingBlock === "ending_target" || readingBlock === "choice_text") {
        // Đợi dòng nội dung thực
      } else {
        readingBlock = null;
      }
      continue;
    }

    // --- Top-level Section Headers ---
    let m;

    // TẬP / EPISODE: <Tên>
    if ((m = clean.match(/^(?:TẬP|EPISODE|TẬP PHIM|TẬP TRUYỆN)\s*:\s*(.*)$/i))) {
      closeCurrentScene();
      closeCurrentEnding();
      currentSection = "meta";
      readingBlock = null;
      ast.episodeTitle = m[1].trim();
      continue;
    }

    // CHỈ SỐ / STATS:
    if ((m = clean.match(/^(?:CHỈ SỐ|STATS|STATISTICS|ĐIỂM SỐ)\s*:\s*(.*)$/i))) {
      closeCurrentScene();
      closeCurrentEnding();
      currentSection = "stats";
      readingBlock = null;
      if (m[1].trim()) {
        parseStatLine(m[1].trim(), lineNum);
      }
      continue;
    }

    // CỜ / FLAGS:
    if ((m = clean.match(/^(?:CỜ|FLAGS|CỜ TRUYỆN|FLAG)\s*:\s*(.*)$/i))) {
      closeCurrentScene();
      closeCurrentEnding();
      currentSection = "flags";
      readingBlock = null;
      if (m[1].trim()) {
        parseFlagLine(m[1].trim(), lineNum);
      }
      continue;
    }

    // VẬT PHẨM / ITEMS:
    if ((m = clean.match(/^(?:VẬT PHẨM|ITEMS|ITEM|ĐỒ VẬT|TRANG BỊ)\s*:\s*(.*)$/i))) {
      closeCurrentScene();
      closeCurrentEnding();
      currentSection = "items";
      readingBlock = null;
      if (m[1].trim()) {
        parseItemLine(m[1].trim(), lineNum);
      }
      continue;
    }

    // QUAN HỆ / RELATIONSHIPS:
    if ((m = clean.match(/^(?:QUAN HỆ|RELATIONSHIPS|RELATIONSHIP|HẢO CẢM|THIỆN CẢM)\s*:\s*(.*)$/i))) {
      closeCurrentScene();
      closeCurrentEnding();
      currentSection = "relationships";
      readingBlock = null;
      if (m[1].trim()) {
        parseRelationshipLine(m[1].trim(), lineNum);
      }
      continue;
    }

    // CẢNH: <Tên cảnh>
    if ((m = clean.match(/^(?:CẢNH|SCENE|PHÂN CẢNH)\s*:\s*(.*)$/i))) {
      closeCurrentScene();
      closeCurrentEnding();
      currentSection = "scene";
      readingBlock = null;
      currentScene = {
        line: lineNum,
        title: m[1].trim(),
        role: "story",
        intent: "",
        notes: "",
        choices: [],
        autoTarget: null,
        autoTargetKind: null,
        autoTargetLine: 0,
      };
      continue;
    }

    // KẾT THÚC: <Tiêu đề> (Khối Ending riêng hoặc đích kết thúc)
    if ((m = clean.match(/^(?:KẾT THÚC|ENDING)\s*(?:\[(.*?)\])?\s*:\s*(.*)$/i))) {
      const toneTag = m[1] ? normalizeTone(m[1].trim()) : "neutral";
      const endingTitle = m[2].trim();

      // Nếu đang trong Choice hoặc Scene và đây là đích kết thúc
      if (currentChoice || (currentScene && currentScene.choices.length === 0 && !currentEnding)) {
        if (currentChoice) {
          const block = getActiveOutcomeBlock(lineNum);
          if (endingTitle) {
            block.target = endingTitle;
            block.targetKind = "ending";
            block.endingTone = toneTag;
            block.targetLine = lineNum;
            readingBlock = null;
          } else {
            readingBlock = "ending_target";
            pendingEndingTone = toneTag;
          }
        } else if (currentScene) {
          if (endingTitle) {
            currentScene.autoTarget = endingTitle;
            currentScene.autoTargetKind = "ending";
            currentScene.autoEndingTone = toneTag;
            currentScene.autoTargetLine = lineNum;
            readingBlock = null;
          } else {
            readingBlock = "ending_target";
            pendingEndingTone = toneTag;
          }
        }
        continue;
      }

      // Khối Ending độc lập
      closeCurrentScene();
      closeCurrentEnding();
      currentSection = "ending";
      readingBlock = "ending_text";
      currentEnding = {
        line: lineNum,
        title: endingTitle,
        tone: toneTag,
        text: "",
      };
      continue;
    }

    // --- Xử lý bên trong các Section ---

    if (currentSection === "stats") {
      parseStatLine(clean, lineNum);
      continue;
    }
    if (currentSection === "flags") {
      parseFlagLine(clean, lineNum);
      continue;
    }
    if (currentSection === "items") {
      parseItemLine(clean, lineNum);
      continue;
    }
    if (currentSection === "relationships") {
      parseRelationshipLine(clean, lineNum);
      continue;
    }

    if (currentSection === "ending" && currentEnding) {
      if ((m = clean.match(/^(?:LOẠI|TONE|TÍNH CHẤT)\s*:\s*(.+)$/i))) {
        currentEnding.tone = normalizeTone(m[1].trim());
        continue;
      }
      if ((m = clean.match(/^(?:NỘI DUNG|MÔ TẢ|TEXT|CONTENT)\s*:\s*(.*)$/i))) {
        readingBlock = "ending_text";
        if (m[1].trim()) {
          currentEnding.text = (currentEnding.text ? currentEnding.text + "\n" : "") + m[1].trim();
        }
        continue;
      }
      if (readingBlock === "ending_text") {
        currentEnding.text = (currentEnding.text ? currentEnding.text + "\n" : "") + clean;
        continue;
      }
    }

    if (currentSection === "scene" && currentScene) {
      // LOẠI / ROLE:
      if ((m = clean.match(/^(?:LOẠI|ROLE|VAI TRÒ|LOẠI CẢNH)\s*:\s*(.+)$/i))) {
        currentScene.role = normalizeRole(m[1].trim());
        readingBlock = null;
        continue;
      }

      // NỘI DUNG / Ý ĐỒ / CONTENT:
      if ((m = clean.match(/^(?:NỘI DUNG|Ý ĐỒ|CONTENT|INTENT|SUMMARY|TÓM TẮT|DIỄN BIẾN)\s*:\s*(.*)$/i))) {
        readingBlock = "intent";
        if (m[1].trim()) {
          currentScene.intent = (currentScene.intent ? currentScene.intent + "\n" : "") + m[1].trim();
        }
        continue;
      }

      // GHI CHÚ / NOTES:
      if ((m = clean.match(/^(?:GHI CHÚ|NOTES|NOTE)\s*:\s*(.*)$/i))) {
        readingBlock = "notes";
        if (m[1].trim()) {
          currentScene.notes = (currentScene.notes ? currentScene.notes + "\n" : "") + m[1].trim();
        }
        continue;
      }

      // LỰA CHỌN [A-Z0-9]*:
      if ((m = clean.match(/^(?:LỰA CHỌN|CHOICE|ĐÁP ÁN|PHƯƠNG ÁN)(?:\s+[A-Z0-9]+)?\s*:\s*(.*)$/i))) {
        closeCurrentChoice();
        if (currentScene.choices.length >= MAX_CHOICES_PER_SCENE) {
          recordIssue(lineNum, `Cảnh "${currentScene.title}" vượt quá ${MAX_CHOICES_PER_SCENE} lựa chọn.`);
        }
        currentChoice = {
          line: lineNum,
          text: m[1].trim(),
          outcomeBlocks: [],
        };
        currentOutcomeBlock = newOutcomeBlock(lineNum);
        if (!m[1].trim()) {
          readingBlock = "choice_text";
        } else {
          readingBlock = null;
        }
        continue;
      }

      // NẾU / ĐIỀU KIỆN / IF / HOẶC NẾU (trong Scene hoặc Choice)
      if ((m = clean.match(/^(?:NẾU|ĐIỀU KIỆN|IF|CONDITION|CHỈ KHI|KHI|HOẶC NẾU|ELSE IF)\s*:\s*(.*)$/i))) {
        readingBlock = "conditions";
        if (!currentChoice) {
          recordIssue(lineNum, "Điều kiện NẾU nên đặt dưới từng lựa chọn cụ thể.", "warning");
        } else {
          // Nếu block hiện tại đã có conditions hoặc target hoặc effects, bắt đầu một block outcome mới
          if (
            currentOutcomeBlock &&
            (currentOutcomeBlock.conditions.length > 0 || currentOutcomeBlock.target || currentOutcomeBlock.effects.length > 0)
          ) {
            closeCurrentOutcomeBlock();
            currentOutcomeBlock = newOutcomeBlock(lineNum);
          }
          if (m[1].trim()) {
            addConditionClause(m[1].trim(), lineNum);
          }
        }
        continue;
      }

      // HỆ QUẢ / KẾT QUẢ / EFFECTS:
      if ((m = clean.match(/^(?:HỆ QUẢ|KẾT QUẢ|EFFECTS|EFFECT|HẬU QUẢ|BIẾN ĐỘNG)\s*:\s*(.*)$/i))) {
        readingBlock = "effects";
        if (m[1].trim()) {
          addEffectClause(m[1].trim(), lineNum);
        }
        continue;
      }

      // ĐẾN / TỚI / CHUYỂN ĐẾN / TO / GOTO:
      if ((m = clean.match(/^(?:ĐẾN|TỚI|CHUYỂN ĐẾN|TO|GOTO|SANG CẢNH|ĐẾN CẢNH)\s*:\s*(.*)$/i))) {
        const targetTitle = m[1].trim();
        if (currentChoice) {
          const block = getActiveOutcomeBlock(lineNum);
          if (targetTitle) {
            block.target = targetTitle;
            block.targetKind = "scene";
            block.targetLine = lineNum;
            readingBlock = null;
          } else {
            readingBlock = "target";
          }
        } else if (currentScene) {
          if (targetTitle) {
            currentScene.autoTarget = targetTitle;
            currentScene.autoTargetKind = "scene";
            currentScene.autoTargetLine = lineNum;
            readingBlock = null;
          } else {
            readingBlock = "target";
          }
        }
        continue;
      }

      // Xử lý các dòng đọc đa dòng theo readingBlock
      if (readingBlock === "target") {
        const dest = stripBullet(clean);
        if (currentChoice) {
          const block = getActiveOutcomeBlock(lineNum);
          block.target = dest;
          block.targetKind = "scene";
          block.targetLine = lineNum;
        } else if (currentScene) {
          currentScene.autoTarget = dest;
          currentScene.autoTargetKind = "scene";
          currentScene.autoTargetLine = lineNum;
        }
        readingBlock = null;
        continue;
      }

      if (readingBlock === "ending_target") {
        const dest = stripBullet(clean);
        if (currentChoice) {
          const block = getActiveOutcomeBlock(lineNum);
          block.target = dest;
          block.targetKind = "ending";
          block.endingTone = pendingEndingTone;
          block.targetLine = lineNum;
        } else if (currentScene) {
          currentScene.autoTarget = dest;
          currentScene.autoTargetKind = "ending";
          currentScene.autoEndingTone = pendingEndingTone;
          currentScene.autoTargetLine = lineNum;
        }
        readingBlock = null;
        continue;
      }

      if (readingBlock === "choice_text") {
        if (currentChoice && !currentChoice.text) {
          currentChoice.text = clean;
        }
        readingBlock = null;
        continue;
      }

      if (readingBlock === "intent") {
        currentScene.intent = (currentScene.intent ? currentScene.intent + "\n" : "") + clean;
        continue;
      }
      if (readingBlock === "notes") {
        currentScene.notes = (currentScene.notes ? currentScene.notes + "\n" : "") + clean;
        continue;
      }
      if (readingBlock === "conditions") {
        addConditionClause(stripBullet(clean), lineNum);
        continue;
      }
      if (readingBlock === "effects") {
        addEffectClause(stripBullet(clean), lineNum);
        continue;
      }

      // Nếu đang trong choice và text của choice chưa có
      if (currentChoice && !currentChoice.text) {
        currentChoice.text = clean;
        continue;
      }

      // Ngược lại, gom vào intent của cảnh
      if (currentScene && !currentChoice) {
        currentScene.intent = (currentScene.intent ? currentScene.intent + "\n" : "") + clean;
        continue;
      }
    }
  }

  // Đóng cảnh và kết thúc cuối cùng
  closeCurrentScene();
  closeCurrentEnding();

  // Helper functions cho việc parse từng dòng thực thể
  function parseStatLine(str, lineNum) {
    const parts = str.split(/[,;]\s*(?=[^,;]*=)/);
    for (const part of parts) {
      const rawItem = stripBullet(part).trim();
      if (!rawItem) continue;
      const match = rawItem.match(/^(.+?)\s*=\s*(-?\d+(?:[.,]\d+)?)(?:\s*\[(.*?)\])?$/);
      if (match) {
        const name = sanitizeEntityName(match[1], lineNum);
        if (!name) continue;
        const initial = Number(match[2].replace(",", "."));
        const tag = (match[3] || "").toLowerCase();
        const isVital = /sinh tồn|sinh tử|vital|death/i.test(tag);
        let deathThreshold = 0;
        const threshMatch = tag.match(/(?:ngưỡng|threshold)\s*[:=]?\s*(-?\d+(?:[.,]\d+)?)/i);
        if (threshMatch) {
          deathThreshold = Number(threshMatch[1].replace(",", "."));
        }
        ast.stats.push({ line: lineNum, name, initial, isVital, deathThreshold });
      } else {
        recordIssue(lineNum, `Khai báo chỉ số "${rawItem}" không đúng mẫu "Tên = số".`, "warning");
      }
    }
  }

  function parseFlagLine(str, lineNum) {
    const parts = str.split(/[,;]\s*/);
    for (const part of parts) {
      const name = sanitizeEntityName(stripBullet(part), lineNum);
      if (name) {
        ast.flags.push({ line: lineNum, name });
      }
    }
  }

  function parseItemLine(str, lineNum) {
    const parts = str.split(/[,;]\s*/);
    for (const part of parts) {
      const name = sanitizeEntityName(stripBullet(part), lineNum);
      if (name) {
        ast.items.push({ line: lineNum, name });
      }
    }
  }

  function parseRelationshipLine(str, lineNum) {
    const parts = str.split(/[,;]\s*(?=[^,;]*=)/);
    for (const part of parts) {
      const rawItem = stripBullet(part).trim();
      if (!rawItem) continue;
      const match = rawItem.match(/^(.+?)\s*=\s*(-?\d+(?:[.,]\d+)?)(?:\s*\((?:NPC\s*:\s*)?(.*?)\))?$/i);
      if (match) {
        const name = sanitizeEntityName(match[1], lineNum);
        if (!name) continue;
        const initial = Number(match[2].replace(",", "."));
        const npc = (match[3] || name).trim();
        ast.relationships.push({ line: lineNum, name, initial, npc });
      } else {
        recordIssue(lineNum, `Khai báo quan hệ "${rawItem}" không đúng mẫu "Tên = số (NPC: Tên NPC)".`, "warning");
      }
    }
  }

  function addConditionClause(clauseText, lineNum) {
    const cleanClause = stripBullet(clauseText);
    if (!cleanClause) return;
    if (currentChoice) {
      const block = getActiveOutcomeBlock(lineNum);
      block.conditions.push({ line: lineNum, raw: cleanClause });
    }
  }

  function addEffectClause(clauseText, lineNum) {
    const cleanClause = stripBullet(clauseText);
    if (!cleanClause) return;
    if (currentChoice) {
      const block = getActiveOutcomeBlock(lineNum);
      block.effects.push({ line: lineNum, raw: cleanClause });
    }
  }

  return { ast, issues, lines: rawLines };
}
