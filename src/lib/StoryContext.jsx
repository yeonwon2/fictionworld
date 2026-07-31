import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { listStories, createStory, updateStory } from "@/lib/worldcrud";

const StoryContext = createContext(null);
const LS_KEY = "fw_current_story_id";

// Provider toàn cục: nạp danh sách bộ truyện + quản lý story đang chọn.
export function StoryProvider({ children }) {
  const [stories, setStories] = useState([]);
  const [currentStoryId, setCurrentStoryId] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      let list = (await listStories()) || [];
      if (!list.length) {
        const def = await createStory({ name: "Bộ truyện đầu tiên" });
        list = [def];
      }
      setStories(list);

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

  // Cập nhật cấu hình trường theo bộ truyện (form_schema) — optimistic + persist.
  const updateStorySchema = useCallback(
    async (formType, updater) => {
      if (!currentStory) return;
      const cur = currentStory.form_schema || {};
      const curForm = cur[formType] || { labelOverrides: {}, customFields: [] };
      const nextForm = updater(curForm);
      const next = { ...cur, [formType]: nextForm };
      setStories((ss) => ss.map((s) => (s.id === currentStory.id ? { ...s, form_schema: next } : s)));
      try {
        await updateStory(currentStory.id, { form_schema: next });
      } catch (e) {
        console.error(e);
      }
    },
    [currentStory]
  );

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
        updateStorySchema,
      }}
    >
      {children}
    </StoryContext.Provider>
  );
}

export function useStory() {
  const ctx = useContext(StoryContext);
  if (!ctx) {
    return { stories: [], currentStory: null, currentStoryId: null, setCurrentStoryId: () => {}, refresh: async () => {}, ready: false, setStories: () => {}, updateStorySchema: async () => {} };
  }
  return ctx;
}