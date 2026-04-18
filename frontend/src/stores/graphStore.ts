import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Entity, Relation } from '../types/chat';

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
  mergeGraphData: (
    entities: Entity[],
    relations: Relation[],
    keywords?: string[]
  ) => void;
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

      updateGraphData: (
        entities,
        relations,
        keywords,
        sessionId,
        messageId,
        source
      ) => {
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
        
        const existingEntityIds = new Set(state.entities.map((e) => e.id));
        const mergedEntities = [
          ...state.entities,
          ...newEntities.filter((e) => !existingEntityIds.has(e.id)),
        ];

        const existingRelationKeys = new Set(
          state.relations.map((r) => `${r.source}-${r.target}-${r.type}`)
        );
        const mergedRelations = [
          ...state.relations,
          ...newRelations.filter(
            (r) => !existingRelationKeys.has(`${r.source}-${r.target}-${r.type}`)
          ),
        ];

        const existingKeywords = new Set(state.keywords);
        const mergedKeywords = [
          ...state.keywords,
          ...(newKeywords || []).filter((k) => !existingKeywords.has(k)),
        ];

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
      partialize: (state) => ({
        entities: state.entities,
        relations: state.relations,
        keywords: state.keywords,
      }),
      version: 1,
    }
  )
);
