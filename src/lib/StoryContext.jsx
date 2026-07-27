import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const StoryContext = createContext(null);
const LS_KEY = "fw_current_story_id";
const MIG_KEY = "fw_story_migrated_v2";

// Provider toàn cục: nạp danh sách bộ truyện + quản lý story đang chọn + gán dữ liệu cũ vào story đầu (một lần).
export function StoryProvider({ children }) {
  const [stories, setStories] = useState([]);
  const [currentStoryId, setCurrentStoryId] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      let list = (await base44.entities.Story.list("-updated_date", 100)) || [];
      if (!list.length) {
        const def = await base44.entities.Story.create({ name: "Bộ truyện đầu tiên" });
        list = [def];
      }
      setStories(list);

      // Gán các record chưa có story_id vào story đầu tiên (chạy 1 lần)
      if (!localStorage.getItem(MIG_KEY)) {
        const targetId = list[0].id;
        await Promise.all([
          base44.entities.Character.updateMany({ story_id: null }, { $set: { story_id: targetId } }).catch(() => {}),
          base44.entities.Location.updateMany({ story_id: null }, { $set: { story_id: targetId } }).catch(() => {}),
          base44.entities.Relationship.updateMany({ story_id: null }, { $set: { story_id: targetId } }).catch(() => {}),
          base44.entities.Event.updateMany({ story_id: null }, { $set: { story_id: targetId } }).catch(() => {}),
        ]);
        localStorage.setItem(MIG_KEY, "1");
      }

      let sid = localStorage.getItem(LS_KEY);
      if (!sid || !list.find((s) => s.id === sid)) sid = list[0]?.id || null;
      setCurrentStoryId(sid);
      if (sid) localStorage.setItem(LS_KEY, sid);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function setCurrentStoryIdPersisted(id) {
    setCurrentStoryId(id);
    if (id) localStorage.setItem(LS_KEY, id);
  }

  const currentStory = stories.find((s) => s.id === currentStoryId) || null;
  const ready = !loading && !!currentStoryId;

  return (
    <StoryContext.Provider
      value={{
        stories,
        setStories,
        currentStory,
        currentStoryId,
        setCurrentStoryId: setCurrentStoryIdPersisted,
        refresh,
        ready,
      }}
    >
      {children}
    </StoryContext.Provider>
  );
}

export function useStory() {
  const ctx = useContext(StoryContext);
  if (!ctx) {
    return { stories: [], currentStory: null, currentStoryId: null, setCurrentStoryId: () => {}, refresh: async () => {}, ready: false, setStories: () => {} };
  }
  return ctx;
}