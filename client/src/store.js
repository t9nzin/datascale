import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // Projects
  projects: [],
  currentProject: null,
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (project) => set({ currentProject: project }),

  // Images
  images: [],
  currentImage: null,
  setImages: (images) => set({ images }),
  setCurrentImage: (image) => set({ currentImage: image }),

  // Annotations for current image
  annotations: [],
  selectedAnnotation: null,
  setAnnotations: (annotations) => set({ annotations }),
  addAnnotation: (ann) => set(s => ({ annotations: [...s.annotations, ann] })),
  updateAnnotation: (id, data) => set(s => ({
    annotations: s.annotations.map(a => a.id === id ? { ...a, ...data } : a)
  })),
  removeAnnotation: (id) => set(s => ({
    annotations: s.annotations.filter(a => a.id !== id)
  })),
  setSelectedAnnotation: (ann) => set({ selectedAnnotation: ann }),

  // Label classes
  labelClasses: [],
  activeLabel: null,
  setLabelClasses: (classes) => set({ labelClasses: classes }),
  setActiveLabel: (label) => set({ activeLabel: label }),

  // Tool state
  activeTool: 'select', // 'select', 'click-segment', 'box-segment', 'pan', 'zoom'
  setActiveTool: (tool) => set({ activeTool: tool }),

  // Canvas state
  zoom: 1,
  pan: { x: 0, y: 0 },
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),

  // AI state
  isAiProcessing: false,
  aiResults: [], // pending AI suggestions
  setAiProcessing: (v) => set({ isAiProcessing: v }),
  setAiResults: (results) => set({ aiResults: results }),
  clearAiResults: () => set({ aiResults: [] }),

  // Chat messages (NL annotation)
  chatMessages: [],
  addChatMessage: (msg) => set(s => ({ chatMessages: [...s.chatMessages, msg] })),
  clearChat: () => set({ chatMessages: [] }),

  // Review issues
  reviewIssues: [],
  setReviewIssues: (issues) => set({ reviewIssues: issues }),

  // Dataset health
  datasetHealth: null,
  setDatasetHealth: (health) => set({ datasetHealth: health }),

  // Connected users (presence) — array of username strings
  connectedUsers: [],
  setConnectedUsers: (users) => set({
    connectedUsers: users.map(u => typeof u === 'string' ? u : u.user || '?')
  }),

  // User cursors
  cursors: {},
  setCursor: (user, pos) => set(s => ({
    cursors: { ...s.cursors, [user]: pos }
  })),
  removeCursor: (user) => set(s => {
    const { [user]: _, ...rest } = s.cursors;
    return { cursors: rest };
  }),

  // Current user
  currentUser: 'local-user',
  setCurrentUser: (user) => set({ currentUser: user }),
}))
