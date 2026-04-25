/**
 * WebGL 知识图谱渲染器（Three.js 增强版）
 * 提供高性能的 3D 图谱渲染
 */

import * as THREE from 'three';
import type { GraphData, GraphNode, GraphEdge } from '../api/knowledge';

/**
 * WebGL 渲染器配置
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export interface WebGLRendererConfig {
  enableShadows: boolean;
  enableLighting: boolean;
  enableAnimations: boolean;
  maxVisibleNodes: number;
  nodeSize: number;
  edgeWidth: number;
  quality: 'low' | 'medium' | 'high' | 'ultra';
}
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * 节点网格数据
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
interface NodeMeshData {
  mesh: THREE.Mesh;
  node: GraphNode;
  originalScale: THREE.Vector3;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * 边线数据
 */
interface EdgeLineData {
  line: THREE.Line;
  edge: GraphEdge;
}

/**
 * WebGL 知识图谱渲染器
 */
export class WebGLGraphRenderer {
  private container: HTMLElement | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animationFrameId: number | null = null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _isInitialized = false;

  // 节点和边
  private nodeMeshes: Map<string, NodeMeshData> = new Map();
  private edgeLines: Map<string, EdgeLineData> = new Map();

  // 配置
  private config: WebGLRendererConfig = {
    enableShadows: true,
    enableLighting: true,
    enableAnimations: true,
    maxVisibleNodes: 1000,
    nodeSize: 1,
    edgeWidth: 0.5,
    quality: 'high',
  };

  // 相机控制
  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private rotationSpeed = 0.005;
  private zoomSpeed = 0.001;

  // 回调
  private onNodeClick?: (nodeId: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _onNodeHover?: (node: GraphNode | null) => void;

  constructor(container: HTMLElement) {
    this.container = container;

    // 创建场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // 创建相机
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 50);

    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = this.config.enableShadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 添加渲染器到容器
    container.appendChild(this.renderer.domElement);

    // 初始化灯光
    this.initLights();

    // 初始化事件监听
    this.initEventListeners();

    // 开始渲染循环
    this.animate();

    this._isInitialized = true;
  }

  /**
   * 初始化灯光
   */
  private initLights(): void {
    if (!this.config.enableLighting) return;

    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // 点光源
    const pointLight = new THREE.PointLight(0xffffff, 1.0);
    pointLight.position.set(50, 50, 50);
    pointLight.castShadow = true;
    this.scene.add(pointLight);

    // 补光
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-50, -50, -50);
    this.scene.add(fillLight);
  }

  /**
   * 初始化事件监听
   */
  private initEventListeners(): void {
    if (!this.container) return;

    // 窗口大小变化
    window.addEventListener('resize', this.handleResize.bind(this));

    // 鼠标事件
    this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.container.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.container.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.container.addEventListener('wheel', this.handleWheel.bind(this));
    this.container.addEventListener('click', this.handleClick.bind(this));

    // 触摸事件（移动端）
    this.container.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.container.addEventListener('touchmove', this.handleTouchMove.bind(this));
    this.container.addEventListener('touchend', this.handleTouchEnd.bind(this));
  }

  /**
   * 处理窗口大小变化
   */
  private handleResize(): void {
    if (!this.container) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * 处理鼠标按下
   */
  private handleMouseDown(event: MouseEvent): void {
    this.isDragging = true;
    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY,
    };
  }

  /**
   * 处理鼠标移动
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;

    const deltaX = event.clientX - this.previousMousePosition.x;
    const deltaY = event.clientY - this.previousMousePosition.y;

    // 旋转场景
    this.scene.rotation.y += deltaX * this.rotationSpeed;
    this.scene.rotation.x += deltaY * this.rotationSpeed;

    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY,
    };
  }

  /**
   * 处理鼠标松开
   */
  private handleMouseUp(): void {
    this.isDragging = false;
  }

  /**
   * 处理滚轮缩放
   */
  private handleWheel(event: WheelEvent): void {
    const zoomFactor = Math.exp(-event.deltaY * this.zoomSpeed);
    this.camera.position.multiplyScalar(zoomFactor);

    // 限制缩放范围
    const distance = this.camera.position.length();
    if (distance < 10) {
      this.camera.position.setLength(10);
    } else if (distance > 200) {
      this.camera.position.setLength(200);
    }
  }

  /**
   * 处理点击事件（用于节点选择）
   */
  private handleClick(event: MouseEvent): void {
    if (!this.container) return;

    // 射线检测
    const rect = this.container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    // 检测与节点的交点
    const meshes = Array.from(this.nodeMeshes.values()).map((nm) => nm.mesh);
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const nodeData = Array.from(this.nodeMeshes.entries()).find(
        ([, nm]) => nm.mesh === clickedMesh
      );

      if (nodeData) {
        const nodeId = nodeData[0];
        this.onNodeClick?.(nodeId);

        // 高亮效果
        this.highlightNode(nodeId);
      }
    }
  }

  /**
   * 处理触摸开始
   */
  private handleTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.isDragging = true;
      this.previousMousePosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    }
  }

  /**
   * 处理触摸移动
   */
  private handleTouchMove(event: TouchEvent): void {
    if (!this.isDragging || event.touches.length !== 1) return;

    const deltaX = event.touches[0].clientX - this.previousMousePosition.x;
    const deltaY = event.touches[0].clientY - this.previousMousePosition.y;

    this.scene.rotation.y += deltaX * this.rotationSpeed;
    this.scene.rotation.x += deltaY * this.rotationSpeed;

    this.previousMousePosition = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  }

  /**
   * 处理触摸结束
   */
  private handleTouchEnd(): void {
    this.isDragging = false;
  }

  /**
   * 高亮节点
   */
  private highlightNode(nodeId: string): void {
    const nodeData = this.nodeMeshes.get(nodeId);
    if (!nodeData) return;

    // 恢复所有节点到原始大小
    this.nodeMeshes.forEach((nm) => {
      nm.mesh.scale.copy(nm.originalScale);
    });

    // 放大选中的节点
    nodeData.mesh.scale.multiplyScalar(1.5);
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<WebGLRendererConfig>): void {
    this.config = { ...this.config, ...config };

    // 更新渲染器设置
    this.renderer.shadowMap.enabled = this.config.enableShadows;
  }

  /**
   * 渲染图谱数据
   */
  public render(graphData: GraphData): void {
    // 清除旧的节点和边
    this.clear();

    // 创建节点
    graphData.nodes.forEach((node: GraphNode) => {
      this.createNode(node);
    });

    // 创建边
    graphData.edges.forEach((edge: GraphEdge) => {
      this.createEdge(edge);
    });
  }

  /**
   * 创建节点网格
   */
  private createNode(node: GraphNode): void {
    // 根据类别选择颜色
    const color = this.getNodeColor(node.category);

    // 创建球体几何
    const geometry = new THREE.SphereGeometry(this.config.nodeSize, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.3,
      roughness: 0.4,
      emissive: color,
      emissiveIntensity: 0.2,
    });

    const mesh = new THREE.Mesh(geometry, material);

    // 设置位置（使用节点坐标或随机分布）
    if (node.x !== undefined && node.y !== undefined) {
      mesh.position.set(node.x, node.y, 0);
    } else {
      // 随机分布在球面上
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 20;
      mesh.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );
    }

    mesh.castShadow = this.config.enableShadows;
    mesh.receiveShadow = this.config.enableShadows;

    // 保存节点数据
    const originalScale = new THREE.Vector3(1, 1, 1);
    this.nodeMeshes.set(node.id, {
      mesh,
      node,
      originalScale,
    });

    // 添加到场景
    this.scene.add(mesh);
  }

  /**
   * 创建边
   */
  private createEdge(edge: GraphEdge): void {
    const sourceData = this.nodeMeshes.get(edge.source);
    const targetData = this.nodeMeshes.get(edge.target);

    if (!sourceData || !targetData) return;

    // 创建线段几何
    const points: THREE.Vector3[] = [];
    points.push(sourceData.mesh.position);
    points.push(targetData.mesh.position);

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x888888,
      linewidth: this.config.edgeWidth,
      opacity: 0.6,
      transparent: true,
    });

    const line = new THREE.Line(geometry, material);

    // 保存边数据
    const edgeId = (edge as any).id || `${edge.source}-${edge.target}`; // eslint-disable-line @typescript-eslint/no-explicit-any
    this.edgeLines.set(edgeId, {
      line,
      edge,
    });

    // 添加到场景
    this.scene.add(line);
  }

  /**
   * 获取节点颜色
   */
  private getNodeColor(category?: string): number {
    const colorMap: Record<string, number> = {
      inheritor: 0x3b82f6, // 蓝色
      technique: 0x10b981, // 绿色
      work: 0xf59e0b, // 橙色
      pattern: 0xef4444, // 红色
      region: 0x8b5cf6, // 紫色
      period: 0x06b6d4, // 青色
      material: 0xec4899, // 粉色
    };

    return colorMap[category || 'inheritor'] || 0x3b82f6;
  }

  /**
   * 清除所有节点和边
   */
  public clear(): void {
    // 移除所有节点
    this.nodeMeshes.forEach(({ mesh }) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    this.nodeMeshes.clear();

    // 移除所有边
    this.edgeLines.forEach(({ line }) => {
      this.scene.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    this.edgeLines.clear();
  }

  /**
   * 动画循环
   */
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    // 自动旋转（如果启用）
    if (this.config.enableAnimations && !this.isDragging) {
      this.scene.rotation.y += 0.002;
    }

    // 节点脉动动画
    if (this.config.enableAnimations) {
      const time = Date.now() * 0.001;
      let index = 0;
      this.nodeMeshes.forEach((nodeData: NodeMeshData) => {
        const scale = 1 + Math.sin(time + index) * 0.05;
        nodeData.mesh.scale.set(scale, scale, scale);
        index++;
      });
    }

    this.renderer.render(this.scene, this.camera);
  };

  /**
   * 设置点击回调
   */
  public setOnNodeClick(callback: (nodeId: string) => void): void {
    this.onNodeClick = callback;
  }

  /**
   * 设置悬停回调
   */
  public setOnNodeHover(callback: (node: GraphNode | null) => void): void {
    this._onNodeHover = callback;
  }

  /**
   * 销毁渲染器
   */
  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.clear();

    // 移除事件监听
    window.removeEventListener('resize', this.handleResize.bind(this));

    if (this.container) {
      this.container.removeChild(this.renderer.domElement);
    }

    this.renderer.dispose();
    this._isInitialized = false;
  }

  /**
   * 获取渲染器实例
   */
  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * 获取场景
   */
  public getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * 获取相机
   */
  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
}

export default WebGLGraphRenderer;
