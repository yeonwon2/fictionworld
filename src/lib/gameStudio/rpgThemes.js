export const THEMES = {
  'lily-noir': {
    id: 'lily-noir',
    name: 'Lily Noir · Ngự Tỷ',
    description: 'Mực đen, rượu vang và champagne — phong cách đặc trưng LilyHub.',
    vars: {
      '--rpg-bg': '#12090f', '--rpg-panel': '#211019', '--rpg-panel-2': '#321725',
      '--rpg-text': '#f7eee8', '--rpg-muted': '#b99da8', '--rpg-accent': '#d7b078',
      '--rpg-accent2': '#a95872', '--rpg-border': '#d7b07845',
      '--rpg-font': '"Be Vietnam Pro", system-ui, sans-serif',
    },
  },
  'retro-8bit': {
    id: 'retro-8bit',
    name: 'Retro 8-bit',
    description: 'Font monospace, viền pixel, nền đen xanh neon',
    vars: {
      '--rpg-bg': '#0a0a12',
      '--rpg-panel': '#12121e',
      '--rpg-panel-2': '#1a1a2e',
      '--rpg-text': '#39ff14',
      '--rpg-muted': '#5a8a4a',
      '--rpg-accent': '#00ffff',
      '--rpg-accent2': '#ff00ff',
      '--rpg-border': '#39ff14',
      '--rpg-font': '"Courier New", ui-monospace, monospace',
    },
  },
  'fantasy-parchment': {
    id: 'fantasy-parchment',
    name: 'Fantasy Parchment',
    description: 'Màu giấy da cổ, font serif, viền vàng kim',
    vars: {
      '--rpg-bg': '#2b1d10',
      '--rpg-panel': '#f4e4bc',
      '--rpg-panel-2': '#e8d49c',
      '--rpg-text': '#3a2817',
      '--rpg-muted': '#7a5a3a',
      '--rpg-accent': '#b8860b',
      '--rpg-accent2': '#8b0000',
      '--rpg-border': '#b8860b',
      '--rpg-font': 'Georgia, "Times New Roman", serif',
    },
  },
  'cyberpunk-2077': {
    id: 'cyberpunk-2077',
    name: 'Cyberpunk 2077',
    description: 'Hiệu ứng glitch, viền neon hồng/cyan, nền tối kim loại',
    vars: {
      '--rpg-bg': '#0a0014',
      '--rpg-panel': '#14001f',
      '--rpg-panel-2': '#1f002d',
      '--rpg-text': '#f0f0f0',
      '--rpg-muted': '#9a7ab0',
      '--rpg-accent': '#ff0080',
      '--rpg-accent2': '#00ffff',
      '--rpg-border': '#ff0080',
      '--rpg-font': '"Segoe UI", "Rajdhani", system-ui, sans-serif',
    },
  },
  'aaa-dark': {
    id: 'aaa-dark',
    name: 'AAA Dark Glass',
    description: 'Obsidian tối, kính mờ, viền neon Cyan/Purple — chuẩn AAA Gaming',
    vars: {
      '--rpg-bg': '#0F172A',
      '--rpg-panel': '#1E293B',
      '--rpg-panel-2': '#334155',
      '--rpg-text': '#f1f5f9',
      '--rpg-muted': '#94a3b8',
      '--rpg-accent': '#22d3ee',
      '--rpg-accent2': '#a855f7',
      '--rpg-border': '#22d3ee55',
      '--rpg-font': 'Inter, system-ui, sans-serif',
    },
  },
  'midnight-velvet': {
    id: 'midnight-velvet',
    name: 'Midnight Velvet',
    description: 'Tím nhung đêm, vàng kim — cho ngôn tình, huyết tộc, gothic',
    vars: {
      '--rpg-bg': '#0b0613',
      '--rpg-panel': '#160a26',
      '--rpg-panel-2': '#241140',
      '--rpg-text': '#f5e9ff',
      '--rpg-muted': '#a98fcf',
      '--rpg-accent': '#c084fc',
      '--rpg-accent2': '#f59e0b',
      '--rpg-border': '#c084fc55',
      '--rpg-font': 'Georgia, "Times New Roman", serif',
    },
  },
  'emerald-myth': {
    id: 'emerald-myth',
    name: 'Emerald Myth',
    description: 'Xanh ngọc rừng sâu, vàng rêu — cho huyền huyễn, tiên hiệp',
    vars: {
      '--rpg-bg': '#04140d',
      '--rpg-panel': '#0a2818',
      '--rpg-panel-2': '#0f3a24',
      '--rpg-text': '#e6fff2',
      '--rpg-muted': '#7fb89a',
      '--rpg-accent': '#34d399',
      '--rpg-accent2': '#fbbf24',
      '--rpg-border': '#34d39955',
      '--rpg-font': 'Georgia, "Times New Roman", serif',
    },
  },
  'crimson-empire': {
    id: 'crimson-empire',
    name: 'Crimson Empire',
    description: 'Đỏ máu hoàng triều, đồng đen — cho lịch sử, chiến tranh, dark fantasy',
    vars: {
      '--rpg-bg': '#1a0606',
      '--rpg-panel': '#2a0d0d',
      '--rpg-panel-2': '#3d1414',
      '--rpg-text': '#ffe8e8',
      '--rpg-muted': '#c79a9a',
      '--rpg-accent': '#ef4444',
      '--rpg-accent2': '#d4a017',
      '--rpg-border': '#ef444455',
      '--rpg-font': 'Georgia, "Times New Roman", serif',
    },
  },
  'sakura-dream': {
    id: 'sakura-dream',
    name: 'Sakura Dream',
    description: 'Hồng anh đào, trắng ngà — cho ngôn tình, đời thường, nhẹ nhàng',
    vars: {
      '--rpg-bg': '#1a0a14',
      '--rpg-panel': '#2a1220',
      '--rpg-panel-2': '#3d1a30',
      '--rpg-text': '#ffe4f3',
      '--rpg-muted': '#c9a0b8',
      '--rpg-accent': '#f472b6',
      '--rpg-accent2': '#fbcfe8',
      '--rpg-border': '#f472b655',
      '--rpg-font': '"Segoe UI", system-ui, sans-serif',
    },
  },
};

export const GENRES = [
  { id: 'tien-hiep', name: 'Tiên Hiệp / Tu Tiên' },
  { id: 'huyen-huyen', name: 'Huyền Huyễn' },
  { id: 'vo-hiep', name: 'Võ Hiệp / Giang Hồ' },
  { id: 'ngon-tinh', name: 'Ngôn Tình / Cổ Đại' },
  { id: 'fantasy', name: 'Fantasy / Kỳ Ảo' },
  { id: 'dark-fantasy', name: 'Dark Fantasy / Ma Pháp' },
  { id: 'cyberpunk', name: 'Cyberpunk / Tương Lai' },
  { id: 'scifi', name: 'Khoa Học Viễn Tưởng' },
  { id: 'steampunk', name: 'Steampunk / Cơ Khí' },
  { id: 'mystery', name: 'Trinh Thám / Án Mạng' },
  { id: 'horror', name: 'Kinh Dị / Tâm Linh' },
  { id: 'post-apocalyptic', name: 'Hậu Tận Thế' },
  { id: 'historical', name: 'Lịch Sử / Cổ Đại' },
  { id: 'drama', name: 'Tâm Lý / Đời Thường' },
];

export const GAME_PRESENTATIONS = {
  adventure: { id: 'adventure', name: 'Phiêu lưu · Chọn hành động', icon: '⚔', description: 'Bố cục điện ảnh, lựa chọn lớn — hợp fantasy, võ hiệp và sinh tồn.', theme: 'emerald-myth', archetype: 'none' },
  dialogue: { id: 'dialogue', name: 'Visual Novel · Trò chuyện NPC', icon: '❝', description: 'Chân dung nhân vật nổi bật, khung thoại thân mật — hợp bách hợp và tâm lý.', theme: 'lily-noir', archetype: 'isekai' },
  transmigration: { id: 'transmigration', name: 'Xuyên sách · Sửa kịch bản', icon: '蝶', description: 'Trang sách, cờ cốt truyện và hảo cảm — dành cho xuyên không/xuyên sách.', theme: 'sakura-dream', archetype: 'isekai' },
  system: { id: 'system', name: 'Hệ thống · Trọng sinh', icon: '◇', description: 'HUD nhiệm vụ, cấp bậc và thông báo hệ thống — hợp LitRPG/trọng sinh.', theme: 'aaa-dark', archetype: 'litrpg' },
  detective: { id: 'detective', name: 'Hồ sơ · Phá án', icon: '⌕', description: 'Bàn điều tra, chứng cứ và tâm trí — hợp trinh thám, kinh dị, bí ẩn.', theme: 'crimson-empire', archetype: 'mystery' },
};

export const PRESENTATION_ART = {
  adventure: '/hero-adventure.png', dialogue: '/lilyhub-muse.png',
  transmigration: '/hero-transmigration.png', system: '/hero-system.png',
  detective: '/hero-detective.png',
};

export const ARCHETYPES = {
  none: {
    id: 'none',
    name: 'Cổ điển (không cơ chế đặc biệt)',
    description: 'Game RPG phân nhánh thuần túy, chỉ có chỉ số và lựa chọn.',
    stats: [],
  },
  litrpg: {
    id: 'litrpg',
    name: 'Hệ Thống (System LitRPG)',
    description: 'System Popup, thanh EXP, Cảnh giới, Điểm Hệ Thống, Nhiệm vụ, Kỹ năng.',
    stats: [],
    config: { ranks: ['Luyện Khí', 'Trúc Cơ', 'Kim Đan', 'Nguyên Anh', 'Hóa Thần'], expPerRank: 100 },
  },
  isekai: {
    id: 'isekai',
    name: 'Xuyên Không / Trọng Sinh (Isekai / Rebirth)',
    description: 'Story Flags (cánh bướm), Tri thức kiếp trước, Độ hảo cảm NPC, lựa chọn [Trọng Sinh]/[Tri Thức Hiện Đại].',
    stats: [{ key: 'pastKnowledge', label: 'Tri thức kiếp trước', default: 0, isVital: false }],
  },
  mystery: {
    id: 'mystery',
    name: 'Trinh thám / Kinh dị',
    description: 'Chỉ số SAN (Tâm trí), Túi đồ giới hạn 4 slot, lựa chọn yêu cầu vật phẩm.',
    stats: [{ key: 'san', label: 'Tâm trí (SAN)', default: 100, isVital: true }],
    config: { inventorySlots: 4 },
  },
};

export const CHOICE_LABELS = {
  rebirth: { text: 'Trọng Sinh', color: '#a855f7' },
  modern: { text: 'Tri Thức Hiện Đại', color: '#0ea5e9' },
};

// Bảng màu trầm, kiểu văn học — tránh tông "kẹo ngọt" quá sáng/bão hoà.
export const STAT_STYLES = {
  hp: { color: '#b0413e', icon: 'heart' },
  mp: { color: '#3d5a80', icon: 'droplet' },
  mana: { color: '#3d5a80', icon: 'droplet' },
  gold: { color: '#a17d2f', icon: 'coins' },
  money: { color: '#a17d2f', icon: 'coins' },
  reputation: { color: '#6b4d8f', icon: 'star' },
  san: { color: '#2f6f6a', icon: 'brain' },
  stamina: { color: '#9a5b2e', icon: 'flame' },
  exp: { color: '#5c7a3a', icon: 'sparkles' },
  pastKnowledge: { color: '#4a6a8a', icon: 'book' },
};
export function statStyle(key) {
  return STAT_STYLES[key] || { color: '#94a3b8', icon: 'circle' };
}

export const DEFAULT_STATS = [
  { key: 'hp', label: 'Sinh lực (HP)', default: 100, isVital: true },
  { key: 'mp', label: 'Nội lực (MP)', default: 50, isVital: false },
  { key: 'gold', label: 'Tiền / Vàng', default: 20, isVital: false },
  { key: 'reputation', label: 'Danh vọng', default: 0, isVital: false },
];

export const ENDING_TYPES = {
  TRUE_END: { label: 'Kết Thúc Thật', color: '#ffd700', icon: '👑' },
  GOOD_END: { label: 'Kết Thúc Tốt', color: '#39d14a', icon: '🌟' },
  NORMAL_END: { label: 'Kết Thúc Thường', color: '#00bcd4', icon: '⚖️' },
  BAD_END: { label: 'Kết Thúc Xấu', color: '#ff4d4d', icon: '💀' },
};

// Dùng ảnh avatar tĩnh đã có sẵn trên LilyHub (public/avatars, WebP nhẹ ~10KB, phục vụ qua
// Vercel CDN) thay vì gọi API DiceBear bên ngoài - nhất quán với avatar bình luận trên chính
// LilyHub, không phụ thuộc dịch vụ ngoài, không rò domain lạ ra file HTML đã xuất.
export const PRESET_AVATARS = [
  'https://www.lilyhub.top/avatars/a13.webp',
  'https://www.lilyhub.top/avatars/a14.webp',
  'https://www.lilyhub.top/avatars/a15.webp',
  'https://www.lilyhub.top/avatars/a16.webp',
  'https://www.lilyhub.top/avatars/a17.webp',
  'https://www.lilyhub.top/avatars/a18.webp',
  'https://www.lilyhub.top/avatars/a19.webp',
  'https://www.lilyhub.top/avatars/a20.webp',
  'https://www.lilyhub.top/avatars/a22.webp',
  'https://www.lilyhub.top/avatars/a23.webp',
  'https://www.lilyhub.top/avatars/a24.webp',
  'https://www.lilyhub.top/avatars/a25.webp',
  'https://www.lilyhub.top/avatars/a26.webp',
  'https://www.lilyhub.top/avatars/a27.webp',
  'https://www.lilyhub.top/avatars/a28.webp',
];

function hashSeed(seed) {
  const s = String(seed || 'Hero');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function dicebearAvatar(seed) {
  return PRESET_AVATARS[hashSeed(seed) % PRESET_AVATARS.length];
}

export function statsArrayToObject(arr) {
  const o = {};
  for (const s of arr || []) o[s.key] = s.default;
  return o;
}

export function makeId(prefix) {
  return (prefix || 'node') + '_' + Math.random().toString(36).slice(2, 8);
}

export function applyArchetypeStats(statsConfig, archetype) {
  const arch = ARCHETYPES[archetype];
  if (!arch || !arch.stats) return statsConfig;
  const existing = new Set((statsConfig || []).map((s) => s.key));
  const merged = [...(statsConfig || [])];
  for (const s of arch.stats) {
    if (!existing.has(s.key)) merged.push({ ...s });
  }
  return merged;
}

export function newEmptyGame() {
  const statsConfig = DEFAULT_STATS.map((s) => ({ ...s }));
  return {
    meta: {
      title: 'Tựa Game Mới',
      author: '',
      genre: 'fantasy',
      theme: 'lily-noir',
      presentation: 'dialogue',
      archetype: 'none',
      player_name: 'Nhân Vật Chính',
      playerAvatar: PRESENTATION_ART.dialogue,
      statsConfig,
      initialStats: statsArrayToObject(statsConfig),
      litrpg: { ranks: ['Luyện Khí', 'Trúc Cơ', 'Kim Đan', 'Nguyên Anh', 'Hóa Thần'], expPerRank: 100 },
      mystery: { inventorySlots: 4 },
    },
    nodes: {
      start_node: {
        id: 'start_node',
        speaker: 'Dẫn Truyện',
        text: 'Câu chuyện bắt đầu... Hãy chỉnh sửa phân cảnh này trong Studio.',
        bgImage: '',
        isEnding: false,
        endingType: null,
        choices: [],
      },
    },
  };
}

export function applyThemeVars(themeId) {
  const theme = THEMES[themeId] || THEMES['fantasy-parchment'];
  const root = document.documentElement;
  for (const k of Object.keys(theme.vars)) {
    root.style.setProperty(k, theme.vars[k]);
  }
}