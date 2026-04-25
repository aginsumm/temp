import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Entity, Relation } from '../types/chat';

const GRAPH_STORAGE_VERSION = 5;

interface GraphState {
  entities: Entity[];
  relations: Relation[];
  keywords: string[];
  sessionId: string | null;
  messageId: string | null;
  lastUpdated: number;
  source: 'chat' | 'knowledge' | 'snapshot' | null;

  setEntities: (entities: Entity[]) => void;
  setRelations: (relations: Relation[]) => void;
  setKeywords: (keywords: string[]) => void;
  updateGraphData: (
    entities?: Entity[],
    relations?: Relation[],
    keywords?: string[],
    sessionId?: string,
    messageId?: string,
    source?: 'chat' | 'knowledge' | 'snapshot'
  ) => void;
  clearGraphData: () => void;
  mergeGraphData: (entities: Entity[], relations: Relation[], keywords?: string[]) => void;
}

export const useGraphStore = create<GraphState>()(
  persist(
    (set, get) => ({
      entities: [],
      relations: [],
      keywords: [],
      sessionId: null,
      messageId: null,
      lastUpdated: 0,
      source: null,

      setEntities: (entities) => {
        set({ entities, lastUpdated: Date.now() });
      },

      setRelations: (relations) => {
        set({ relations, lastUpdated: Date.now() });
      },

      setKeywords: (keywords) => {
        set({ keywords, lastUpdated: Date.now() });
      },

      updateGraphData: (entities, relations, keywords, sessionId, messageId, source) => {
        const updates: Partial<GraphState> = {
          lastUpdated: Date.now(),
        };

        if (entities !== undefined) updates.entities = entities;
        if (relations !== undefined) updates.relations = relations;
        if (keywords !== undefined) updates.keywords = keywords;
        if (sessionId !== undefined) updates.sessionId = sessionId;
        if (messageId !== undefined) updates.messageId = messageId;
        if (source !== undefined) updates.source = source;

        set(updates);
      },

      clearGraphData: () => {
        set({
          entities: [],
          relations: [],
          keywords: [],
          sessionId: null,
          messageId: null,
          lastUpdated: Date.now(),
          source: null,
        });
      },

      mergeGraphData: (newEntities, newRelations, newKeywords) => {
        const state = get();

        // 基于实体 ID 去重，保留最新的数据
        const entityMap = new Map<string, Entity>();
        state.entities.forEach((e) => entityMap.set(e.id, e));
        newEntities.forEach((e) => entityMap.set(e.id, e));
        const mergedEntities = Array.from(entityMap.values());

        // 基于 source-target-type 去重关系
        const relationMap = new Map<string, Relation>();
        state.relations.forEach((r) => {
          const key = `${r.source}-${r.target}-${r.type}`;
          relationMap.set(key, r);
        });
        newRelations.forEach((r) => {
          const key = `${r.source}-${r.target}-${r.type}`;
          relationMap.set(key, r);
        });
        const mergedRelations = Array.from(relationMap.values());

        // 关键词去重
        const keywordSet = new Set([...state.keywords, ...(newKeywords || [])]);
        const mergedKeywords = Array.from(keywordSet);

        set({
          entities: mergedEntities,
          relations: mergedRelations,
          keywords: mergedKeywords,
          lastUpdated: Date.now(),
        });
      },
    }),
    {
      name: 'graph-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        entities: state.entities,
        relations: state.relations,
        keywords: state.keywords,
      }),
      version: GRAPH_STORAGE_VERSION,
      migrate: (persistedState: unknown, version: number) => {
        if (version < 5) {
          return {
            entities: [],
            relations: [],
            keywords: [],
            sessionId: null,
            messageId: null,
            lastUpdated: Date.now(),
            source: null,
          };
        }
        return persistedState;
      },
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.error('图谱数据恢复失败:', error);
            localStorage.removeItem('graph-storage');
          } else {
            const storedData = localStorage.getItem('graph-storage');
            if (storedData) {
              try {
                const parsed = JSON.parse(storedData);
                if (parsed.version && parsed.version < 5) {
                  console.log('检测到旧版本数据，清除中...');
                  localStorage.removeItem('graph-storage');
                  if (state) {
                    state.entities = [];
                    state.relations = [];
                    state.keywords = [];
                  }
                }
              } catch {
                localStorage.removeItem('graph-storage');
              }
            }
            console.log('图谱数据已恢复:', {
              entities: state?.entities?.length || 0,
              relations: state?.relations?.length || 0,
            });
          }
        };
      },
    }
  )
);
