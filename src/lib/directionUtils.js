// Dựng block văn bản "Định hướng bộ truyện" để đưa vào system prompt của mọi lệnh AI.
const ENDING_LABEL = {
  HE: "Viên mãn (HE)",
  SE: "Hơi tiếc nuối (SE)",
  open: "Kết mở",
  undecided: "Chưa quyết định",
};

export function buildDirectionBlock(direction) {
  if (!direction) return "";
  const lines = [];
  if (direction.lengthMode === "custom" && direction.customLength) {
    lines.push(`- Độ dài dự kiến: khoảng ${direction.customLength} chương`);
  } else {
    lines.push("- Độ dài: để AI đề xuất hợp lý");
  }
  lines.push(`- Kiểu kết thúc: ${ENDING_LABEL[direction.ending] || "chưa quyết định"}`);
  if (direction.tones?.length) lines.push(`- Tông truyện: ${direction.tones.join(", ")}`);
  if (direction.emphasis) {
    const e = direction.emphasis.emotion ?? 50;
    const p = direction.emphasis.plot ?? 50;
    const a = direction.emphasis.action ?? 50;
    lines.push(`- Nhấn mạnh: Tình cảm ${e}% · Âm mưu/chính trị ${p}% · Hành động/võ hiệp ${a}%`);
  }
  if (direction.castWants?.length) lines.push(`- Dàn nhân vật phụ mong muốn: ${direction.castWants.join(", ")}`);
  if (direction.want?.trim()) lines.push(`- Điều muốn có: ${direction.want}`);
  if (direction.avoid?.trim()) lines.push(`- Điều muốn tránh: ${direction.avoid}`);
  if (!lines.length) return "";
  return `# Định hướng bộ truyện (tác giả yêu cầu)\n${lines.join("\n")}`;
}