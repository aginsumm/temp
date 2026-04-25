import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message } from '../types/chat';

interface BranchMessage extends Message {
  branchId: string;
  parentId?: string;
  children: string[];
  isEdited?: boolean;
  isBranchRoot?: boolean;
}

interface Branch {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
  messages: BranchMessage[];
  isActive: boolean;
  description?: string;
}

interface ConversationTree {
  branches: Record<string, Branch>;
  rootBranchId: string;
  activeBranchId: string;
}

interface BranchState {
  trees: Record<string, ConversationTree>;
  
  createBranch: (sessionId: string, fromMessageId?: string, name?: string) => Branch;
  switchBranch: (sessionId: string, branchId: string) => void;
  deleteBranch: (sessionId: string, branchId: string) => boolean;
  renameBranch: (sessionId: string, branchId: string, name: string) => void;
  
  addMessageToBranch: (sessionId: string, branchId: string, message: Message) => void;
  editMessage: (sessionId: string, messageId: string, content: string) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  
  getActiveBranch: (sessionId: string) => Branch | null;
  getBranchMessages: (sessionId: string, branchId: string) => BranchMessage[];
  getBranchTree: (sessionId: string) => Branch[];
  
  initializeTree: (sessionId: string, messages: Message[]) => void;
  mergeBranch: (sessionId: string, sourceBranchId: string, targetBranchId: string) => boolean;
}

const generateBranchName = (index: number): string => {
  return `分支 ${index}`;
};

const generateId = (): string => {
  return `branch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      trees: {},

      initializeTree: (sessionId: string, messages: Message[]) => {
        const branchId = generateId();
        const branchMessages: BranchMessage[] = messages.map((msg, index) => ({
          ...msg,
          branchId,
          parentId: index > 0 ? messages[index - 1].id : undefined,
          children: index < messages.length - 1 ? [messages[index + 1].id] : [],
        }));

        set((state) => ({
          trees: {
            ...state.trees,
            [sessionId]: {
              branches: {
                [branchId]: {
                  id: branchId,
                  name: '主对话',
                  createdAt: new Date().toISOString(),
                  messages: branchMessages,
                  isActive: true,
                },
              },
              rootBranchId: branchId,
              activeBranchId: branchId,
            },
          },
        }));
      },

      createBranch: (sessionId: string, fromMessageId?: string, name?: string) => {
        const state = get();
        const tree = state.trees[sessionId];
        
        if (!tree) {
          const newBranchId = generateId();
          const newBranch: Branch = {
            id: newBranchId,
            name: name || '新分支',
            createdAt: new Date().toISOString(),
            messages: [],
            isActive: false,
          };
          
          set((state) => ({
            trees: {
              ...state.trees,
              [sessionId]: {
                branches: { [newBranchId]: newBranch },
                rootBranchId: newBranchId,
                activeBranchId: newBranchId,
              },
            },
          }));
          
          return newBranch;
        }

        const activeBranch = tree.branches[tree.activeBranchId];
        let sourceMessages: BranchMessage[] = [];
        let parentId: string | undefined;

        if (fromMessageId && activeBranch) {
          const msgIndex = activeBranch.messages.findIndex(m => m.id === fromMessageId);
          if (msgIndex >= 0) {
            sourceMessages = activeBranch.messages.slice(0, msgIndex + 1);
            parentId = fromMessageId;
          }
        }

        const newBranchId = generateId();
        const branchCount = Object.keys(tree.branches).length;
        const newBranch: Branch = {
          id: newBranchId,
          name: name || generateBranchName(branchCount + 1),
          parentId,
          createdAt: new Date().toISOString(),
          messages: sourceMessages.map((msg, i) => ({
            ...msg,
            branchId: newBranchId,
            isBranchRoot: i === sourceMessages.length - 1,
          })),
          isActive: false,
        };

        set((state) => ({
          trees: {
            ...state.trees,
            [sessionId]: {
              ...tree,
              branches: {
                ...tree.branches,
                [newBranchId]: newBranch,
              },
            },
          },
        }));

        return newBranch;
      },

      switchBranch: (sessionId: string, branchId: string) => {
        const state = get();
        const tree = state.trees[sessionId];
        
        if (!tree || !tree.branches[branchId]) return;

        const updatedBranches = { ...tree.branches };
        Object.keys(updatedBranches).forEach(id => {
          updatedBranches[id] = {
            ...updatedBranches[id],
            isActive: id === branchId,
          };
        });

        set((state) => ({
          trees: {
            ...state.trees,
            [sessionId]: {
              ...tree,
              branches: updatedBranches,
              activeBranchId: branchId,
            },
          },
        }));
      },

      deleteBranch: (sessionId: string, branchId: string) => {
        const state = get();
        const tree = state.trees[sessionId];
        
        if (!tree || branchId === tree.rootBranchId) return false;
        if (!tree.branches[branchId]) return false;

        const { [branchId]: _deleted, ...remainingBranches } = tree.branches;
        void _deleted;
        
        let newActiveBranchId = tree.activeBranchId;
        if (tree.activeBranchId === branchId) {
          newActiveBranchId = tree.rootBranchId;
          if (remainingBranches[tree.rootBranchId]) {
            remainingBranches[tree.rootBranchId].isActive = true;
          }
        }

        set((state) => ({
          trees: {
            ...state.trees,
            [sessionId]: {
              ...tree,
              branches: remainingBranches,
              activeBranchId: newActiveBranchId,
            },
          },
        }));

        return true;
      },

      renameBranch: (sessionId: string, branchId: string, name: string) => {
        const state = get();
        const tree = state.trees[sessionId];
        
        if (!tree || !tree.branches[branchId]) return;

        set((state) => ({
          trees: {
            ...state.trees,
            [sessionId]: {
              ...tree,
              branches: {
                ...tree.branches,
                [branchId]: {
                  ...tree.branches[branchId],
                  name,
                },
              },
            },
          },
        }));
      },

      addMessageToBranch: (sessionId: string, branchId: string, message: Message) => {
        const state = get();
        const tree = state.trees[sessionId];
        
        if (!tree || !tree.branches[branchId]) return;

        const branch = tree.branches[branchId];
        const lastMessage = branch.messages[branch.messages.length - 1];
        
        const branchMessage: BranchMessage = {
          ...message,
          branchId,
          parentId: lastMessage?.id,
          children: [],
          isBranchRoot: false,
        };

        if (lastMessage) {
          lastMessage.children.push(message.id);
        }

        set((state) => ({
          trees: {
            ...state.trees,
            [sessionId]: {
              ...tree,
              branches: {
                ...tree.branches,
                [branchId]: {
                  ...branch,
                  messages: [...branch.messages, branchMessage],
                },
              },
            },
          },
        }));
      },

      editMessage: (sessionId: string, messageId: string, content: string) => {
        const state = get();
        const tree = state.trees[sessionId];
        
        if (!tree) return;

        const updatedBranches = { ...tree.branches };
        
        for (const branchId of Object.keys(updatedBranches)) {
          const branch = updatedBranches[branchId];
          const msgIndex = branch.messages.findIndex(m => m.id === messageId);
          
          if (msgIndex >= 0) {
            const messages = [...branch.messages];
            messages[msgIndex] = {
              ...messages[msgIndex],
              content,
              isEdited: true,
            };
            updatedBranches[branchId] = {
              ...branch,
              messages,
            };
            break;
          }
        }

        set((state) => ({
          trees: {
            ...state.trees,
            [sessionId]: {
              ...tree,
              branches: updatedBranches,
            },
          },
        }));
      },

      deleteMessage: (sessionId: string, messageId: string) => {
        const state = get();
        const tree = state.trees[sessionId];
        
        if (!tree) return;

        const updatedBranches = { ...tree.branches };
        
        for (const branchId of Object.keys(updatedBranches)) {
          const branch = updatedBranches[branchId];
          const msgIndex = branch.messages.findIndex(m => m.id === messageId);
          
          if (msgIndex >= 0) {
            const messages = branch.messages.slice(0, msgIndex);
            updatedBranches[branchId] = {
              ...branch,
              messages,
            };
            break;
          }
        }

        set((state) => ({
          trees: {
            ...state.trees,
            [sessionId]: {
              ...tree,
              branches: updatedBranches,
            },
          },
        }));
      },

      getActiveBranch: (sessionId: string) => {
        const state = get();
        const tree = state.trees[sessionId];
        if (!tree) return null;
        return tree.branches[tree.activeBranchId] || null;
      },

      getBranchMessages: (sessionId: string, branchId: string) => {
        const state = get();
        const tree = state.trees[sessionId];
        if (!tree || !tree.branches[branchId]) return [];
        return tree.branches[branchId].messages;
      },

      getBranchTree: (sessionId: string) => {
        const state = get();
        const tree = state.trees[sessionId];
        if (!tree) return [];
        return Object.values(tree.branches);
      },

      mergeBranch: (sessionId: string, sourceBranchId: string, targetBranchId: string) => {
        const state = get();
        const tree = state.trees[sessionId];
        
        if (!tree || !tree.branches[sourceBranchId] || !tree.branches[targetBranchId]) {
          return false;
        }

        const sourceBranch = tree.branches[sourceBranchId];
        const targetBranch = tree.branches[targetBranchId];
        
        const lastTargetMessage = targetBranch.messages[targetBranch.messages.length - 1];
        const mergedMessages = [
          ...targetBranch.messages,
          ...sourceBranch.messages.map((msg, i) => ({
            ...msg,
            branchId: targetBranchId,
            parentId: i === 0 ? lastTargetMessage?.id : sourceBranch.messages[i - 1]?.id,
            isBranchRoot: false,
          })),
        ];

        set((state) => ({
          trees: {
            ...state.trees,
            [sessionId]: {
              ...tree,
              branches: {
                ...tree.branches,
                [targetBranchId]: {
                  ...targetBranch,
                  messages: mergedMessages,
                },
              },
            },
          },
        }));

        return true;
      },
    }),
    {
      name: 'branch-storage',
      partialize: (state) => ({
        trees: state.trees,
      }),
    }
  )
);

export type { Branch, BranchMessage, ConversationTree };
