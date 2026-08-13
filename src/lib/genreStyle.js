// Dòng chỉ dẫn văn phong/bối cảnh dùng chung cho mọi prompt AI trong AI Creative.
// Trước đây các prompt hardcode "Bách Hợp Cổ Đại" + "cổ kính, không dùng từ hiện đại" —
// khiến AI phớt lờ thể loại tác giả nhập. Giờ mọi prompt phải đọc genre qua đây.
export function genreStyleLine(genre) {
  const g = (genre || "").trim();
  if (!g) {
    return 'Tác giả CHƯA chỉ định thể loại cụ thể — dùng văn phong tự nhiên, trung tính; TUYỆT ĐỐI không tự ý thêm yếu tố cổ trang/triều đình/hoàng gia hay bất kỳ đặc trưng thể loại nào khác nếu không được yêu cầu.';
  }
  return `Thể loại truyện: "${g}". Văn phong, từ ngữ, bối cảnh PHẢI bám sát đúng thể loại này; TUYỆT ĐỐI không tự ý chêm đặc trưng của thể loại khác (VD: đừng thêm triều đình/hoàng gia/xưng hô cổ trang nếu thể loại là hiện đại, và ngược lại).`;
}

// Cụm ngắn để chèn vào giữa câu, VD: "biên kịch chuyên nghiệp tiểu thuyết mạng ${genreNoun(genre)}"
export function genreNoun(genre) {
  const g = (genre || "").trim();
  return g ? `thể loại "${g}"` : "đa thể loại";
}
