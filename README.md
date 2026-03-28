# 非遗数字生命互动引擎

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Python](https://img.shields.io/badge/python-3.9+-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.x-blue.svg)

**基于人工智能与知识图谱的非物质文化遗产数字化平台**

[功能特性](#功能特性) • [快速开始](#快速开始) • [技术架构](#技术架构) • [部署指南](#部署指南) • [文档](#文档)

</div>

---

## 📖 项目简介

非遗数字生命互动引擎是一个基于人工智能与知识组织技术的数字化平台，旨在提升非遗文化的传播效率与交互体验。系统通过知识图谱、智能问答、AI生成等技术，将传统非遗文化从静态展示转变为可交互、可探索、可生成的数字化体验形式。

### 🎯 核心目标

- 解决地方志与非遗知识分散、检索困难的问题
- 提升传统展示方式的交互性，吸引年轻群体
- 帮助用户深入理解非遗文化结构与关联
- 促进非遗文化与现代创意设计的结合

---

## ✨ 功能特性

### 模块一：首页展示
- 🏠 非遗文化概览与导航
- 📊 数据统计与可视化展示
- 🎨 精美的视觉设计与动画效果

### 模块二：智能问答
- 💬 基于大语言模型的智能对话
- 🔍 知识溯源与实体识别
- 📝 会话管理与历史记录
- 🎯 推荐问题与智能提示
- 🌐 离线模式支持

### 模块三：知识图谱
- 🕸️ 知识图谱可视化展示
- 🔎 多维度搜索与筛选
- 📍 地图视图、时间轴视图、列表视图
- 🔗 实体关系探索与路径查找
- 📈 统计分析与数据洞察

### 模块四：AI文创生成
- 🎨 基于非遗元素的创意设计
- 🖼️ AI辅助图案生成
- 💡 设计灵感推荐

---

## 🚀 快速开始

### 环境要求

- **后端**：Python 3.9+
- **前端**：Node.js 16+、npm 或 pnpm
- **数据库**：SQLite（开发）/ PostgreSQL（生产）

### 安装步骤

#### 1. 克隆项目

```bash
git clone <仓库地址>
cd project24798-6754
```

#### 2. 后端配置

```bash
# 进入后端目录
cd backend

# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp ../.env.example .env
# 编辑 .env 文件，配置必要参数

# 初始化数据库和示例数据
python init_data.py

# 启动后端服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 3. 前端配置

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install
# 或使用 pnpm
pnpm install

# 启动开发服务器
npm run dev
```

#### 4. 访问应用

- **前端界面**：http://localhost:5173
- **后端API**：http://localhost:8000
- **API文档**：http://localhost:8000/docs

---

## 🏗️ 技术架构

### 后端技术栈

| 技术 | 用途 | 版本 |
|------|------|------|
| FastAPI | Web框架 | 0.104+ |
| SQLAlchemy | ORM框架 | 2.0+ |
| SQLite/PostgreSQL | 数据库 | - |
| DashScope | AI服务 | 1.14+ |
| Pydantic | 数据验证 | 2.12+ |

### 前端技术栈

| 技术 | 用途 | 版本 |
|------|------|------|
| React | 前端框架 | 18.x |
| TypeScript | 类型系统 | 5.x |
| Vite | 构建工具 | 8.x |
| Zustand | 状态管理 | 5.x |
| ECharts | 图表库 | 6.x |
| TailwindCSS | CSS框架 | 4.x |
| Framer Motion | 动画库 | 10.x |

### 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Mobile Client  │    │   AI Service    │
│   (React + TS)  │    │   (Android)     │    │   (DashScope)   │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Application       │
                    │   Server (FastAPI)  │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
    ┌────▼────┐         ┌─────▼─────┐      ┌───────▼──────┐
    │ Database│         │ Knowledge │      │   Vector     │
    │ (SQLite)│         │   Graph   │      │    Store     │
    └─────────┘         └───────────┘      └──────────────┘
```

---

## 📦 项目结构

```
project24798-6754/
├── backend/                 # 后端代码
│   ├── app/
│   │   ├── api/            # API路由
│   │   ├── core/           # 核心配置
│   │   ├── models/         # 数据模型
│   │   ├── schemas/        # 数据模式
│   │   ├── services/       # 业务逻辑
│   │   └── utils/          # 工具函数
│   ├── requirements.txt    # Python依赖
│   └── init_data.py        # 数据初始化
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── api/           # API客户端
│   │   ├── components/    # React组件
│   │   ├── pages/         # 页面组件
│   │   ├── stores/        # 状态管理
│   │   ├── services/      # 服务层
│   │   └── styles/        # 样式文件
│   ├── package.json       # Node依赖
│   └── vite.config.js     # Vite配置
├── ai-service/            # AI服务
├── docs/                  # 文档
│   ├── 模块设计/          # 模块设计文档
│   └── images/            # 图片资源
├── .env.example           # 环境变量示例
├── docker-compose.yml     # Docker配置
└── README.md              # 项目说明
```

---

## 🔧 配置说明

### 环境变量配置

创建 `.env` 文件并配置以下参数：

```env
# 应用配置
APP_NAME=非遗数字生命互动引擎
APP_VERSION=1.0.0
DEBUG=True

# 数据库配置
DATABASE_URL=sqlite+aiosqlite:///./heritage.db

# CORS配置
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]

# JWT配置
JWT_SECRET_KEY=your-secret-key-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# AI服务配置（可选）
DASHSCOPE_API_KEY=your_dashscope_api_key

# 可选服务配置
REDIS_URL=redis://localhost:6379/0
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password
```

### API密钥获取

- **DashScope API Key**：访问 [阿里云DashScope控制台](https://dashscope.console.aliyun.com/) 获取

---

## 🐳 Docker部署

### 使用Docker Compose

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 单独构建镜像

```bash
# 构建后端镜像
docker build -f backend/backend-node.Dockerfile -t heritage-backend ./backend

# 构建前端镜像
docker build -f frontend/frontend.Dockerfile -t heritage-frontend ./frontend

# 构建AI服务镜像
docker build -f ai-service/ai-service.Dockerfile -t heritage-ai ./ai-service
```

---

## 📚 文档

- [模块二：智能问答页 - 后端接口配置情况文档](./docs/模块设计/模块二_后端接口配置情况文档.md)
- [模块三：知识图谱与知识检索页 - 后端接口配置情况文档](./docs/模块设计/模块三_后端接口配置情况文档.md)
- [非遗数字生命互动引擎任务书](./docs/非遗数字生命互动引擎任务书.md)
- [模块配置需求](./docs/模块配置需求.md)

---

## 🧪 测试

### 后端测试

```bash
cd backend
pytest
```

### 前端测试

```bash
cd frontend
npm run test
```

---

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 👥 团队

- **开发团队**：软件工程课程项目组
- **指导老师**：[指导老师姓名]
- **项目周期**：2026年春季学期

---

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 📧 Email: [项目邮箱]
- 💬 Issue: [GitHub Issues]
- 📖 文档: [项目文档地址]

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给一个星标支持！**

Made with ❤️ by 软件工程课程项目组

</div>
