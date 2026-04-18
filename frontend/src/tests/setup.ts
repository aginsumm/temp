import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
}

global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock echarts - 完整的 echarts mock 实现
const createMockChartInstance = () => ({
  setOption: vi.fn().mockReturnThis(),
  getOption: vi.fn().mockReturnValue({}),
  resize: vi.fn().mockReturnThis(),
  dispose: vi.fn().mockReturnThis(),
  clear: vi.fn().mockReturnThis(),
  showLoading: vi.fn().mockReturnThis(),
  hideLoading: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
  dispatchAction: vi.fn().mockReturnThis(),
  getDataURL: vi.fn(() => 'data:image/png;base64,mockImageData'),
  getConnectedDataURL: vi.fn(() => 'data:image/png;base64,mockConnectedData'),
  convertFromPixel: vi.fn(() => [0, 0]),
  convertToPixel: vi.fn(() => [100, 100]),
  containPixel: vi.fn(() => true),
  getDom: vi.fn(() => document.createElement('div')),
  isDisposed: vi.fn(() => false),
  appendData: vi.fn().mockReturnThis(),
  clearInstance: vi.fn().mockReturnThis(),
  getModel: vi.fn().mockReturnValue({}),
  getViewOfComponentModel: vi.fn().mockReturnValue({}),
  getViewOfSeriesModel: vi.fn().mockReturnValue({}),
});

vi.mock('echarts', () => {
  const echartsMock = {
    init: vi.fn((dom: HTMLElement) => {
      return createMockChartInstance();
    }),
    registerMap: vi.fn(),
    getMap: vi.fn(() => ({ geoJson: {} })),
    registerTheme: vi.fn(),
    connect: vi.fn(),
    disConnect: vi.fn(),
    getInstanceByDom: vi.fn(),
    getInstanceById: vi.fn(),
    getInstanceByIndex: vi.fn(),
    dispose: vi.fn(),
    use: vi.fn(),
    extendComponentModel: vi.fn(),
    extendComponentView: vi.fn(),
    extendSeriesModel: vi.fn(),
    extendChartView: vi.fn(),
    setCanvasCreator: vi.fn(),
    registerPreprocessor: vi.fn(),
    registerProcessor: vi.fn(),
    registerLayout: vi.fn(),
    registerVisual: vi.fn(),
    registerCoordinateSystem: vi.fn(),
    registerAction: vi.fn(),
    extendComponentLayout: vi.fn(),
  };

  // 添加 default 导出
  (echartsMock as any).default = echartsMock;

  return echartsMock;
});

// Mock IndexedDB - 完整的 IndexedDB mock 实现
const createMockIDBRequest = (result?: any) => {
  const request: any = {
    result: result || null,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  };

  // 模拟异步成功
  setTimeout(() => {
    if (request.onsuccess) request.onsuccess({ target: request, result: request.result });
  }, 0);

  return request;
};

const createMockIDBObjectStore = (name: string) => {
  const store: any = {
    name,
    keyPath: 'id',
    indexNames: [],
    transaction: null,
    autoIncrement: false,
    add: vi.fn((value, key?: any) => createMockIDBRequest({ id: key || Date.now(), ...value })),
    put: vi.fn((value) => createMockIDBRequest(value)),
    get: vi.fn((key) => createMockIDBRequest({ id: key, name: 'Mock Item' })),
    getAll: vi.fn(() => createMockIDBRequest([])),
    delete: vi.fn((key) => createMockIDBRequest(undefined)),
    clear: vi.fn(() => createMockIDBRequest(undefined)),
    count: vi.fn(() => createMockIDBRequest(0)),
    openCursor: vi.fn(() => createMockIDBRequest(null)),
    index: vi.fn((name) => createMockIDBIndex(name)),
    createIndex: vi.fn(),
    deleteIndex: vi.fn(),
  };
  return store;
};

const createMockIDBIndex = (name: string) => ({
  name,
  objectStore: null,
  keyPath: 'id',
  multiEntry: false,
  unique: false,
  get: vi.fn((key) => createMockIDBRequest({ id: key })),
  getAll: vi.fn(() => createMockIDBRequest([])),
  getKey: vi.fn((key) => createMockIDBRequest(key)),
  getAllKeys: vi.fn(() => createMockIDBRequest([])),
  count: vi.fn(() => createMockIDBRequest(0)),
  openCursor: vi.fn(() => createMockIDBRequest(null)),
  openKeyCursor: vi.fn(() => createMockIDBRequest(null)),
});

const createMockIDBTransaction = (storeNames: string[]) => {
  const objectStores = new Map<string, any>();
  storeNames.forEach((name) => {
    objectStores.set(name, createMockIDBObjectStore(name));
  });

  return {
    db: null,
    mode: 'readwrite',
    durability: 'default',
    objectStoreNames: storeNames,
    error: null,
    onabort: null,
    oncomplete: null,
    onerror: null,
    objectStore: vi.fn((name) => {
      if (!objectStores.has(name)) {
        throw new Error(`Object store "${name}" not found`);
      }
      return objectStores.get(name);
    }),
    abort: vi.fn(),
    commit: vi.fn(),
  };
};

const createMockIDBDatabase = (name: string, version: number) => {
  const objectStores = new Map<string, any>();

  return {
    name,
    version,
    oldVersion: 0,
    objectStoreNames: [] as string[],
    onabort: null,
    onclose: null,
    onerror: null,
    onversionchange: null,
    createObjectStore: vi.fn((name, options?: any) => {
      const store = createMockIDBObjectStore(name);
      objectStores.set(name, store);
      return store;
    }),
    deleteObjectStore: vi.fn((name) => {
      objectStores.delete(name);
    }),
    transaction: vi.fn((storeNames, mode?: string) => {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      return createMockIDBTransaction(names);
    }),
    close: vi.fn(),
  };
};

// Mock indexedDB
const mockIndexedDB = {
  open: vi.fn((name: string, version?: number) => {
    const request = createMockIDBRequest();
    const db = createMockIDBDatabase(name, version || 1);

    setTimeout(() => {
      request.result = db;
      if (request.onsuccess) {
        request.onsuccess({ target: request, result: db });
      }
    }, 0);

    return request;
  }),
  deleteDatabase: vi.fn((name: string) => {
    const request = createMockIDBRequest();
    setTimeout(() => {
      if (request.onsuccess) request.onsuccess({ target: request });
    }, 0);
    return request;
  }),
  databases: vi.fn(() => Promise.resolve([])),
  cmp: vi.fn((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
};

Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
  configurable: true,
});

// Mock ResizeObserver
class MockResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock Canvas API - 完整的 Canvas 2D Context mock
const createMockCanvasContext = () => {
  const ctx: any = {
    // 状态
    save: vi.fn(),
    restore: vi.fn(),

    // 变换
    scale: vi.fn(),
    rotate: vi.fn(),
    translate: vi.fn(),
    transform: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),

    // 组合操作
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',

    // 图像平滑
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',

    // 描边和填充
    strokeStyle: '#000000',
    fillStyle: '#000000',
    stroke: vi.fn(),
    fill: vi.fn(),

    // 路径
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),

    // 文本
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    direction: 'ltr',
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({
      width: 100,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 100,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
      fontBoundingBoxAscent: 12,
      fontBoundingBoxDescent: 2,
    })),

    // 线条样式
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    lineDashOffset: 0,
    getLineDash: vi.fn(() => []),
    setLineDash: vi.fn(),
    miterLimit: 10,

    // 阴影
    shadowColor: '#000000',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,

    // 裁剪
    clip: vi.fn(),
    isPointInPath: vi.fn(() => true),
    isPointInStroke: vi.fn(() => false),

    // 图像数据
    createImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    })),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
      colorSpace: 'srgb',
    })),
    putImageData: vi.fn(),

    // 清除
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),

    // 渐变和图案
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createPattern: vi.fn(() => null),

    // 绘制图像
    drawImage: vi.fn(),
    drawFocusIfNeeded: vi.fn(),
    scrollPathIntoView: vi.fn(),

    // 路径 2D
    roundRect: vi.fn(),

    // 过滤器
    filter: 'none',
  };

  return ctx;
};

// Mock HTMLCanvasElement
const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = vi.fn(function (
  this: HTMLCanvasElement,
  contextId: string,
  ...args: any[]
) {
  if (contextId === '2d') {
    return createMockCanvasContext();
  }
  if (contextId === 'webgl' || contextId === 'webgl2') {
    return createMockWebGLContext();
  }
  return originalGetContext.call(this, contextId, ...args);
}) as any;

// Mock WebGL Context
const createMockWebGLContext = () => ({
  canvas: document.createElement('canvas'),
  drawingBufferWidth: 800,
  drawingBufferHeight: 600,
  activeTexture: vi.fn(),
  attachShader: vi.fn(),
  bindAttribLocation: vi.fn(),
  bindBuffer: vi.fn(),
  bindFramebuffer: vi.fn(),
  bindRenderbuffer: vi.fn(),
  bindTexture: vi.fn(),
  blendColor: vi.fn(),
  blendEquation: vi.fn(),
  blendEquationSeparate: vi.fn(),
  blendFunc: vi.fn(),
  blendFuncSeparate: vi.fn(),
  bufferData: vi.fn(),
  bufferSubData: vi.fn(),
  checkFramebufferStatus: vi.fn(() => 0x8cd5),
  clear: vi.fn(),
  clearColor: vi.fn(),
  clearDepth: vi.fn(),
  clearStencil: vi.fn(),
  colorMask: vi.fn(),
  compileShader: vi.fn(),
  compressedTexImage2D: vi.fn(),
  compressedTexSubImage2D: vi.fn(),
  copyTexImage2D: vi.fn(),
  copyTexSubImage2D: vi.fn(),
  createBuffer: vi.fn(() => ({})),
  createFramebuffer: vi.fn(() => ({})),
  createProgram: vi.fn(() => ({})),
  createRenderbuffer: vi.fn(() => ({})),
  createShader: vi.fn(() => ({})),
  createTexture: vi.fn(() => ({})),
  cullFace: vi.fn(),
  deleteBuffer: vi.fn(),
  deleteFramebuffer: vi.fn(),
  deleteProgram: vi.fn(),
  deleteRenderbuffer: vi.fn(),
  deleteShader: vi.fn(),
  deleteTexture: vi.fn(),
  depthFunc: vi.fn(),
  depthMask: vi.fn(),
  depthRange: vi.fn(),
  detachShader: vi.fn(),
  disable: vi.fn(),
  disableVertexAttribArray: vi.fn(),
  drawArrays: vi.fn(),
  drawElements: vi.fn(),
  enable: vi.fn(),
  enableVertexAttribArray: vi.fn(),
  finish: vi.fn(),
  flush: vi.fn(),
  framebufferRenderbuffer: vi.fn(),
  framebufferTexture2D: vi.fn(),
  frontFace: vi.fn(),
  generateMipmap: vi.fn(),
  getActiveAttrib: vi.fn(() => ({
    name: 'attribute',
    size: 1,
    type: 0x1406,
  })),
  getActiveUniform: vi.fn(() => ({
    name: 'uniform',
    size: 1,
    type: 0x1406,
  })),
  getAttachedShaders: vi.fn(() => []),
  getAttribLocation: vi.fn(() => 0),
  getBufferParameter: vi.fn(() => 0),
  getError: vi.fn(() => 0),
  getExtension: vi.fn(() => null),
  getFramebufferAttachmentParameter: vi.fn(() => 0),
  getParameter: vi.fn(() => 0),
  getProgramParameter: vi.fn(() => true),
  getProgramInfoLog: vi.fn(() => ''),
  getRenderbufferParameter: vi.fn(() => 0),
  getShaderParameter: vi.fn(() => true),
  getShaderInfoLog: vi.fn(() => ''),
  getShaderPrecisionFormat: vi.fn(() => ({
    rangeMin: 127,
    rangeMax: 127,
    precision: 23,
  })),
  getShaderSource: vi.fn(() => ''),
  getSupportedExtensions: vi.fn(() => []),
  getTexParameter: vi.fn(() => 0),
  getUniform: vi.fn(() => 0),
  getUniformLocation: vi.fn(() => ({})),
  getVertexAttrib: vi.fn(() => 0),
  getVertexAttribOffset: vi.fn(() => 0),
  hint: vi.fn(),
  isBuffer: vi.fn(() => true),
  isContextLost: vi.fn(() => false),
  isEnabled: vi.fn(() => true),
  isFramebuffer: vi.fn(() => true),
  isProgram: vi.fn(() => true),
  isRenderbuffer: vi.fn(() => true),
  isShader: vi.fn(() => true),
  isTexture: vi.fn(() => true),
  lineWidth: vi.fn(),
  linkProgram: vi.fn(),
  pixelStorei: vi.fn(),
  polygonOffset: vi.fn(),
  readPixels: vi.fn(),
  renderbufferStorage: vi.fn(),
  sampleCoverage: vi.fn(),
  scissor: vi.fn(),
  shaderSource: vi.fn(),
  stencilFunc: vi.fn(),
  stencilFuncSeparate: vi.fn(),
  stencilMask: vi.fn(),
  stencilMaskSeparate: vi.fn(),
  stencilOp: vi.fn(),
  stencilOpSeparate: vi.fn(),
  texImage2D: vi.fn(),
  texParameterf: vi.fn(),
  texParameteri: vi.fn(),
  texSubImage2D: vi.fn(),
  uniform1f: vi.fn(),
  uniform1fv: vi.fn(),
  uniform1i: vi.fn(),
  uniform1iv: vi.fn(),
  uniform2f: vi.fn(),
  uniform2fv: vi.fn(),
  uniform2i: vi.fn(),
  uniform2iv: vi.fn(),
  uniform3f: vi.fn(),
  uniform3fv: vi.fn(),
  uniform3i: vi.fn(),
  uniform3iv: vi.fn(),
  uniform4f: vi.fn(),
  uniform4fv: vi.fn(),
  uniform4i: vi.fn(),
  uniform4iv: vi.fn(),
  uniformMatrix2fv: vi.fn(),
  uniformMatrix3fv: vi.fn(),
  uniformMatrix4fv: vi.fn(),
  useProgram: vi.fn(),
  validateProgram: vi.fn(),
  vertexAttrib1f: vi.fn(),
  vertexAttrib1fv: vi.fn(),
  vertexAttrib2f: vi.fn(),
  vertexAttrib2fv: vi.fn(),
  vertexAttrib3f: vi.fn(),
  vertexAttrib3fv: vi.fn(),
  vertexAttrib4f: vi.fn(),
  vertexAttrib4fv: vi.fn(),
  vertexAttribPointer: vi.fn(),
  viewport: vi.fn(),
});

// Mock requestAnimationFrame
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    return setTimeout(() => callback(Date.now()), 16) as any;
  });
  window.cancelAnimationFrame = vi.fn((id: number) => {
    clearTimeout(id);
  });
}

// Mock Performance API
if (!global.performance) {
  const mockPerformance = {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntries: vi.fn(() => []),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  };

  global.performance = mockPerformance as any;
}

// Mock localStorage
const createMockLocalStorage = () => {
  const store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => store.get(key) || null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((index: number) => {
      const keys = Array.from(store.keys());
      return keys[index] || null;
    }),
  };
};

Object.defineProperty(window, 'localStorage', {
  value: createMockLocalStorage(),
  writable: true,
  configurable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: createMockLocalStorage(),
  writable: true,
  configurable: true,
});

// Mock Blob
if (!global.Blob) {
  global.Blob = class MockBlob {
    constructor(parts?: any[], properties?: any) {
      (this as any).parts = parts || [];
      (this as any).type = properties?.type || '';
      (this as any).size = parts?.reduce((acc, part) => acc + (part?.length || 0), 0) || 0;
    }

    arrayBuffer = vi.fn(() => Promise.resolve(new ArrayBuffer(0)));
    slice = vi.fn(() => new global.Blob());
    stream = vi.fn(() => new ReadableStream());
    text = vi.fn(() => Promise.resolve(''));
  } as any;
}

// Mock URL
if (!global.URL) {
  global.URL = class MockURL {
    static createObjectURL = vi.fn(() => 'blob:mock-url');
    static revokeObjectURL = vi.fn();
  } as any;
}

// Mock fetch
if (!global.fetch) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      url: '',
      redirected: false,
      type: 'basic',
      body: null,
      bodyUsed: false,
      clone: vi.fn(() => ({ ok: true, status: 200 })),
      arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
      blob: vi.fn(() => Promise.resolve(new Blob())),
      formData: vi.fn(() => Promise.resolve(new FormData())),
      json: vi.fn(() => Promise.resolve({})),
      text: vi.fn(() => Promise.resolve('')),
    })
  ) as any;
}

// Mock WebSocket
if (!global.WebSocket) {
  global.WebSocket = class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = 1;
    bufferedAmount = 0;
    extensions = '';
    protocol = '';
    url = '';

    onopen = null;
    onerror = null;
    onclose = null;
    onmessage = null;

    constructor(url: string, protocols?: string | string[]) {
      (this as any).url = url;
      setTimeout(() => {
        if ((this as any).onopen) (this as any).onopen({ type: 'open' });
      }, 0);
    }

    close = vi.fn((code?: number, reason?: string) => {
      this.readyState = 3;
      if ((this as any).onclose) (this as any).onclose({ type: 'close', code, reason });
    });

    send = vi.fn((data: any) => {});
  } as any;
}

// Mock MessageChannel
if (!global.MessageChannel) {
  global.MessageChannel = class MockMessageChannel {
    port1 = {
      postMessage: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
      onmessage: null,
      onmessageerror: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    port2 = {
      postMessage: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
      onmessage: null,
      onmessageerror: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  } as any;
}

// Mock BroadcastChannel
if (!global.BroadcastChannel) {
  global.BroadcastChannel = class MockBroadcastChannel {
    name: string;
    onmessage: any = null;
    onmessageerror: any = null;

    constructor(name: string) {
      this.name = name;
    }

    postMessage = vi.fn();
    close = vi.fn();
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    dispatchEvent = vi.fn();
  } as any;
}

// Mock Worker
if (!global.Worker) {
  global.Worker = class MockWorker {
    onmessage: any = null;
    onerror: any = null;

    constructor(stringUrl: string | URL) {
      // Mock worker constructor
    }

    postMessage = vi.fn();
    terminate = vi.fn();
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    dispatchEvent = vi.fn();
  } as any;
}

// Mock requestIdleCallback
if (!global.requestIdleCallback) {
  global.requestIdleCallback = (callback: IdleRequestCallback) => {
    return setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining: () => 50,
      });
    }, 1);
  };
}

if (!global.cancelIdleCallback) {
  global.cancelIdleCallback = (id: number) => {
    clearTimeout(id);
  };
}

// Mock Performance API - 使用 Object.defineProperty 避免只读属性错误
if (!Object.getOwnPropertyDescriptor(global, 'performance')?.writable) {
  Object.defineProperty(global, 'performance', {
    writable: true,
    configurable: true,
    value: {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntries: vi.fn(() => []),
      getEntriesByName: vi.fn(() => []),
      getEntriesByType: vi.fn(() => []),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
    },
  });
} else {
  global.performance = {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntries: vi.fn(() => []),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  };
}

// Mock LocalDatabase
vi.mock('../data/localDatabase', () => ({
  default: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getStore: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue(null),
      getAll: vi.fn().mockResolvedValue([]),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(0),
      clear: vi.fn().mockResolvedValue(undefined),
    }),
    close: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),
  },
}));

// Mock SyncManager
vi.mock('../data/syncManager', () => ({
  default: {
    start: vi.fn(),
    stop: vi.fn(),
    sync: vi.fn().mockResolvedValue(undefined),
    updatePendingCount: vi.fn().mockResolvedValue(undefined),
    getPendingCount: vi.fn().mockResolvedValue(0),
  },
}));
