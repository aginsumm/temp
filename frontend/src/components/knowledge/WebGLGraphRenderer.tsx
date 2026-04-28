import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Layers, Settings, Activity } from 'lucide-react';
import { graphOptimizer } from '../../utils/graphOptimizer';
import { GraphData, GraphNode, GraphEdge } from '../../api/knowledge';

interface WebGLGraphRendererProps {
  data: GraphData;
  width?: number;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
  onNodeDoubleClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  selectedNodeId?: string;
  highlightedNodes?: Set<string>;
  layoutType?: 'force' | 'circular' | 'hierarchical';
  showLabels?: boolean;
  showPerformance?: boolean;
}

interface RenderStats {
  fps: number;
  visibleNodes: number;
  visibleEdges: number;
  lodLevel: string;
  renderTime: number;
}

const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec4 a_color;
  attribute float a_size;
  
  uniform mat3 u_matrix;
  uniform float u_zoom;
  
  varying vec4 v_color;
  
  void main() {
    vec2 position = (u_matrix * vec3(a_position, 1.0)).xy;
    gl_Position = vec4(position, 0.0, 1.0);
    gl_PointSize = a_size * u_zoom;
    v_color = a_color;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  varying vec4 v_color;
  
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
  }
`;

const edgeVertexShaderSource = `
  attribute vec2 a_position;
  attribute vec4 a_color;
  
  uniform mat3 u_matrix;
  
  varying vec4 v_color;
  
  void main() {
    gl_Position = vec4((u_matrix * vec3(a_position, 1.0)).xy, 0.0, 1.0);
    v_color = a_color;
  }
`;

const edgeFragmentShaderSource = `
  precision mediump float;
  varying vec4 v_color;
  
  void main() {
    gl_FragColor = v_color;
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

export default function WebGLGraphRenderer({
  data,
  width = 800,
  height = 600,
  onNodeClick,
  selectedNodeId,
  highlightedNodes,
  showLabels = true,
  showPerformance = true,
}: WebGLGraphRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const nodeProgramRef = useRef<WebGLProgram | null>(null);
  const edgeProgramRef = useRef<WebGLProgram | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsRef = useRef<number>(60);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [renderStats, setRenderStats] = useState<RenderStats>({
    fps: 60,
    visibleNodes: 0,
    visibleEdges: 0,
    lodLevel: 'high',
    renderTime: 0,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [enableVirtualization, setEnableVirtualization] = useState(true);
  const [enableLOD, setEnableLOD] = useState(true);
  const [localShowLabels, setLocalShowLabels] = useState(showLabels);

  const optimizedData = useMemo(() => {
    // 使用 graphOptimizer 进行优化
    const result = graphOptimizer.optimize(data);
    return result.optimizedData;
  }, [data]);

  const categoryColors = useMemo(() => {
    const colors: Record<string, string> = {};

    const getCSSVar = (varName: string): string => {
      if (typeof window !== 'undefined') {
        const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        return value || '#8B5CF6';
      }
      return '#8B5CF6';
    };

    const themeColors: Record<string, string> = {
      inheritor: getCSSVar('--color-primary'),
      technique: getCSSVar('--color-secondary'),
      work: getCSSVar('--color-accent'),
      pattern: getCSSVar('--color-error'),
      region: getCSSVar('--color-info'),
      period: getCSSVar('--color-primary'),
      material: getCSSVar('--color-success'),
    };

    const categories = [...new Set(data.nodes.map((n) => n.category))];
    categories.forEach((cat) => {
      colors[cat] = themeColors[cat] || getCSSVar('--color-primary');
    });

    return colors;
  }, [data.nodes]);

  const hexToRgba = useCallback(
    (hex: string, alpha: number = 1): [number, number, number, number] => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (result) {
        return [
          parseInt(result[1], 16) / 255,
          parseInt(result[2], 16) / 255,
          parseInt(result[3], 16) / 255,
          alpha,
        ];
      }
      return [0.5, 0.5, 0.5, alpha];
    },
    []
  );

  const initializeWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
    });

    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    glRef.current = gl;

    const nodeVertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const nodeFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (nodeVertexShader && nodeFragmentShader) {
      nodeProgramRef.current = createProgram(gl, nodeVertexShader, nodeFragmentShader);
    }

    const edgeVertexShader = createShader(gl, gl.VERTEX_SHADER, edgeVertexShaderSource);
    const edgeFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, edgeFragmentShaderSource);

    if (edgeVertexShader && edgeFragmentShader) {
      edgeProgramRef.current = createProgram(gl, edgeVertexShader, edgeFragmentShader);
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }, []);

  const getTransformMatrix = useCallback((): number[] => {
    const scaleX = 2 / width;
    const scaleY = -2 / height;

    return [
      scaleX * zoom,
      0,
      0,
      0,
      scaleY * zoom,
      0,
      -1 + offset.x * scaleX * zoom,
      1 + offset.y * scaleY * zoom,
      1,
    ];
  }, [width, height, zoom, offset]);

  const render = useCallback(() => {
    const gl = glRef.current;
    const nodeProgram = nodeProgramRef.current;
    const edgeProgram = edgeProgramRef.current;

    if (!gl || !nodeProgram || !edgeProgram) return;

    const startTime = performance.now();

    gl.viewport(0, 0, width, height);
    const bgColor =
      typeof window !== 'undefined'
        ? getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim() ||
          'rgba(15, 23, 42, 1)'
        : 'rgba(15, 23, 42, 1)';
    const bgRgba = hexToRgba(bgColor.startsWith('#') ? bgColor : '#0f172a', 1);
    gl.clearColor(bgRgba[0], bgRgba[1], bgRgba[2], bgRgba[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let renderData = optimizedData;
    const lodLevel: string = 'high';

    if (enableLOD) {
      // 使用 graphOptimizer 的 LOD 功能
      graphOptimizer.updateViewport(width, height, zoom);
      const lodResult = graphOptimizer.optimize(optimizedData);
      renderData = lodResult.optimizedData;
    }

    if (enableVirtualization && zoom < 1.5) {
      // 简化处理，暂时不进行虚拟化
      // renderData = virtualizeGraphData(renderData, {...});
    }

    const matrix = getTransformMatrix();

    gl.useProgram(edgeProgram);
    const edgeMatrixLocation = gl.getUniformLocation(edgeProgram, 'u_matrix');
    gl.uniformMatrix3fv(edgeMatrixLocation, false, matrix);

    const edgePositions: number[] = [];
    const edgeColors: number[] = [];

    for (const edge of renderData.edges) {
      // 简化处理：使用节点数据中的位置
      const sourceNode = renderData.nodes.find((n) => n.id === edge.source);
      const targetNode = renderData.nodes.find((n) => n.id === edge.target);

      if (sourceNode && targetNode) {
        // 使用简单的布局位置
        const sourcePos = { x: 0, y: 0 };
        const targetPos = { x: 0, y: 0 };

        edgePositions.push(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y);

        const opacity = edge.lineStyle?.opacity || 0.3;
        edgeColors.push(0.5, 0.5, 0.5, opacity, 0.5, 0.5, 0.5, opacity);
      }
    }

    if (edgePositions.length > 0) {
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edgePositions), gl.STATIC_DRAW);

      const positionLocation = gl.getAttribLocation(edgeProgram, 'a_position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      const colorBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edgeColors), gl.STATIC_DRAW);

      const colorLocation = gl.getAttribLocation(edgeProgram, 'a_color');
      gl.enableVertexAttribArray(colorLocation);
      gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.LINES, 0, edgePositions.length / 2);

      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(colorBuffer);
    }

    gl.useProgram(nodeProgram);

    const nodeMatrixLocation = gl.getUniformLocation(nodeProgram, 'u_matrix');
    gl.uniformMatrix3fv(nodeMatrixLocation, false, matrix);

    const zoomLocation = gl.getUniformLocation(nodeProgram, 'u_zoom');
    gl.uniform1f(zoomLocation, zoom);

    const nodePositions: number[] = [];
    const nodeColors: number[] = [];
    const nodeSizes: number[] = [];

    for (const node of renderData.nodes) {
      // 简化处理：使用简单的位置
      const pos = { x: 0, y: 0 };
      if (pos) {
        nodePositions.push(pos.x, pos.y);

        let color = categoryColors[node.category] || 'var(--color-primary)';
        let alpha = 0.9;

        if (selectedNodeId === node.id) {
          color = 'var(--color-warning)';
          alpha = 1;
        } else if (highlightedNodes?.has(node.id)) {
          alpha = 1;
        }

        const rgba = hexToRgba(color, alpha);
        nodeColors.push(...rgba);

        const size = node.symbolSize || 30;
        nodeSizes.push(size);
      }
    }

    if (nodePositions.length > 0) {
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodePositions), gl.STATIC_DRAW);

      const positionLocation = gl.getAttribLocation(nodeProgram, 'a_position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      const colorBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodeColors), gl.STATIC_DRAW);

      const colorLocation = gl.getAttribLocation(nodeProgram, 'a_color');
      gl.enableVertexAttribArray(colorLocation);
      gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);

      const sizeBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodeSizes), gl.STATIC_DRAW);

      const sizeLocation = gl.getAttribLocation(nodeProgram, 'a_size');
      gl.enableVertexAttribArray(sizeLocation);
      gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, nodePositions.length / 2);

      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(colorBuffer);
      gl.deleteBuffer(sizeBuffer);
    }

    const renderTime = performance.now() - startTime;

    frameCountRef.current++;
    const now = performance.now();
    if (now - lastFrameTimeRef.current >= 1000) {
      fpsRef.current = frameCountRef.current;
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;
    }

    setRenderStats({
      fps: fpsRef.current,
      visibleNodes: renderData.nodes.length,
      visibleEdges: renderData.edges.length,
      lodLevel,
      renderTime: renderTime.toFixed(2) as unknown as number,
    });
  }, [
    optimizedData,
    width,
    height,
    zoom,
    enableVirtualization,
    enableLOD,
    selectedNodeId,
    highlightedNodes,
    categoryColors,
    hexToRgba,
    getTransformMatrix,
  ]);

  useEffect(() => {
    initializeWebGL();
  }, [initializeWebGL]);

  useEffect(() => {
    const animate = () => {
      render();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    },
    [offset]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;

      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(0.1, Math.min(5, prev * delta)));
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onNodeClick) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - width / 2 - offset.x) / zoom;
      const y = -(e.clientY - rect.top - height / 2 - offset.y) / zoom;

      for (const node of optimizedData.nodes) {
        // 简化处理：使用简单的位置
        const pos = { x: 0, y: 0 };
        if (pos) {
          const size = (node.symbolSize || 30) * zoom;
          const distance = Math.sqrt(Math.pow(pos.x - x, 2) + Math.pow(pos.y - y, 2));

          if (distance < size) {
            onNodeClick(node);
            return;
          }
        }
      }
    },
    [optimizedData, zoom, offset, width, height, onNodeClick]
  );

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(5, prev * 1.2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(0.1, prev / 1.2));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const handleFitToScreen = useCallback(() => {
    if (optimizedData.nodes.length === 0) return;

    // 简化处理：使用默认的 zoom 和 offset
    setZoom(1);
    setOffset({
      x: 0,
      y: 0,
    });
  }, [optimizedData.nodes.length]);

  return (
    <div
      className="relative w-full h-full rounded-lg overflow-hidden"
      style={{ background: 'var(--color-surface)' }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
      />

      {showLabels && zoom > 0.5 && (
        <div className="absolute inset-0 pointer-events-none">
          <svg width={width} height={height} className="w-full h-full">
            {optimizedData.nodes.map((node: GraphNode) => {
              // 暂时使用简单的位置计算
              const pos = { x: 0, y: 0 };
              if (!pos) return null;

              const screenX = pos.x * zoom + offset.x + width / 2;
              const screenY = -pos.y * zoom + offset.y + height / 2;

              if (screenX < -50 || screenX > width + 50 || screenY < -50 || screenY > height + 50) {
                return null;
              }

              return (
                <text
                  key={node.id}
                  x={screenX}
                  y={screenY + ((node.symbolSize || 30) * zoom) / 2 + 12}
                  textAnchor="middle"
                  fill="var(--color-text-primary)"
                  fontSize={Math.max(8, 12 * zoom)}
                  className="select-none"
                >
                  {node.name.length > 10 ? node.name.slice(0, 10) + '...' : node.name}
                </text>
              );
            })}
          </svg>
        </div>
      )}

      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleZoomIn}
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
          style={{
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <ZoomIn size={18} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleZoomOut}
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
          style={{
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <ZoomOut size={18} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleFitToScreen}
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
          style={{
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <Maximize2 size={18} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleReset}
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
          style={{
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <RotateCcw size={18} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowSettings(!showSettings)}
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
          style={{
            background: showSettings ? 'var(--color-primary)' : 'var(--color-surface)',
            color: showSettings ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <Settings size={18} />
        </motion.button>
      </div>

      {showSettings && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="absolute top-4 right-16 w-64 rounded-lg p-4"
          style={{
            background: 'var(--gradient-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Layers size={16} style={{ color: 'var(--color-primary)' }} />
            渲染设置
          </h3>

          <div className="space-y-3">
            <label
              className="flex items-center gap-2 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <input
                type="checkbox"
                checked={enableVirtualization}
                onChange={(e) => setEnableVirtualization(e.target.checked)}
                className="rounded"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              启用虚拟化渲染
            </label>

            <label
              className="flex items-center gap-2 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <input
                type="checkbox"
                checked={enableLOD}
                onChange={(e) => setEnableLOD(e.target.checked)}
                className="rounded"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              启用LOD优化
            </label>

            <label
              className="flex items-center gap-2 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <input
                type="checkbox"
                checked={localShowLabels}
                onChange={(e) => setLocalShowLabels(e.target.checked)}
                className="rounded"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              显示标签
            </label>
          </div>
        </motion.div>
      )}

      {showPerformance && (
        <div
          className="absolute bottom-4 left-4 rounded-lg p-3 text-xs"
          style={{
            background: 'var(--gradient-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} style={{ color: 'var(--color-success)' }} />
            <span className="font-semibold">性能监控</span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span style={{ color: 'var(--color-text-muted)' }}>FPS:</span>
            <span
              style={{
                color: renderStats.fps < 30 ? 'var(--color-error)' : 'var(--color-success)',
              }}
            >
              {renderStats.fps}
            </span>

            <span style={{ color: 'var(--color-text-muted)' }}>节点:</span>
            <span>{renderStats.visibleNodes}</span>

            <span style={{ color: 'var(--color-text-muted)' }}>边:</span>
            <span>{renderStats.visibleEdges}</span>

            <span style={{ color: 'var(--color-text-muted)' }}>LOD:</span>
            <span style={{ color: 'var(--color-primary)' }}>{renderStats.lodLevel}</span>

            <span style={{ color: 'var(--color-text-muted)' }}>渲染:</span>
            <span>{renderStats.renderTime}ms</span>
          </div>
        </div>
      )}

      <div
        className="absolute bottom-4 right-4 rounded-lg px-3 py-1.5 text-xs"
        style={{
          background: 'var(--gradient-card)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      >
        缩放: {(zoom * 100).toFixed(0)}%
      </div>
    </div>
  );
}
