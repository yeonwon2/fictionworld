import { buildMindMap } from './mindMap.js';

// Keep the complete game. A route constrains input, never rewrites targets or rules.
export function makeRoutePlaytest(game, trail) {
  if (trail?.[0] !== 'scene:start_node') throw new Error('Để thử đúng điểm số, cờ và vật phẩm, hãy chọn tuyến từ Dẫn truyện bằng nút “Đi từng tuyến từ đầu”. Tuyến bắt đầu giữa truyện chưa có trạng thái của các cảnh trước.');
  const graph = buildMindMap(game.nodes);
  const cards = new Map(graph.cards.map((card) => [card.key, card]));
  const steps = [];
  for (let i = 0; i < trail.length; i++) {
    const card = cards.get(trail[i]);
    if (!card || card.kind === 'missing') throw new Error('Tuyến có ô không tồn tại. Hãy sửa liên kết trước khi chơi thử.');
    if (i && !graph.edges.some((edge) => edge.from === trail[i - 1] && edge.to === trail[i])) throw new Error('Đường đi đã thay đổi. Hãy chọn lại tuyến.');
    if (['intro', 'scene', 'ending'].includes(card.kind)) steps.push({ nodeId: card.sceneId, choiceIndex: null, defeat: false });
    else if (card.kind === 'choice') steps.at(-1).choiceIndex = card.choiceIndex;
    else if (card.kind === 'combat') steps.at(-1).defeat = true;
  }
  if (cards.get(trail.at(-1))?.kind === 'choice') throw new Error('Hãy chọn đích đi tiếp của lựa chọn cuối trước khi chạy thử.');
  if (steps.length < 2 && !steps[0]?.defeat && !game.nodes.start_node.isEnding) throw new Error('Hãy chọn ít nhất một bước đi tiếp để chạy thử tuyến.');
  return { steps };
}

export function routePlaytestProgress(route, runtime, screen) {
  if (!route) return null;
  const index = runtime.history.length;
  const step = route.steps[index];
  const matches = !!step && step.nodeId === runtime.nodeId && runtime.history.every((id, i) => route.steps[i]?.nodeId === id);
  if (!matches) return { index, step, state: 'diverged', message: 'Kết quả thực tế đã đi sang nhánh khác với tuyến đã chọn. Xúc xắc và chiến đấu vẫn dùng kết quả thật; không ép thành công.' };
  if (screen === 'gameover') return { index, step, state: 'stopped', message: 'Lượt chơi đã kết thúc tại đây. Xem nguyên nhân trong màn hình game; chưa thể kết luận tuyến đi hết như dự kiến.' };
  if (index === route.steps.length - 1 && !step.defeat) return { index, step, state: 'complete', message: 'Đã đi tới ô cuối của tuyến đã chọn. Đây là kết quả của lượt thử này, không đảm bảo mọi kết quả ngẫu nhiên đều giống nhau.' };
  return { index, step, state: 'playing', message: step.choiceIndex !== null ? `Bước ${index + 1}/${route.steps.length} · Chọn lựa chọn ${step.choiceIndex + 1} theo tuyến.` : `Bước ${index + 1}/${route.steps.length} · Tiếp tục trận đấu theo luật game.` };
}
