# 🎮 Gomoku AI - 五子棋

精美的五子棋 AI 对战游戏，支持人机对战和双人对战。

![Gomoku AI](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwind-css)
![Deploy](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)

## ✨ 特性

- 🎨 **精美 UI** - 木纹棋盘、石质感棋子、流畅动画
- 🤖 **AI 对战** - 4 个难度等级（简单/中等/困难/专家）
- 👥 **双人对战** - 本地轮流对战
- 📱 **响应式** - 完美适配手机/平板/桌面
- 🔄 **悔棋功能** - 随时反悔
- 💾 **自动存档** - localStorage 保存游戏状态
- ⚡ **高性能** - Canvas 渲染 60fps，Web Worker AI 计算

## 🚀 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 打开浏览器访问 http://localhost:3000
```

### 构建生产版本

```bash
npm run build
npm start
```

## 📦 技术栈

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Rendering**: Canvas API
- **AI**: Minimax + αβ剪枝
- **Deployment**: Vercel

## 🎯 游戏规则

1. **棋盘**: 15×15 网格
2. **目标**: 先连成 5 子一线（横/竖/斜）
3. **黑棋先手**: 黑棋先行，双方轮流落子
4. **获胜**: 先连成五子者获胜

## 🤖 AI 难度

| 难度 | 搜索深度 | 适合人群 |
|------|---------|---------|
| 😊 简单 | 2 层 | 新手入门 |
| 🤔 中等 | 4 层 | 普通玩家 |
| 😈 困难 | 6 层 | 高手挑战 |
| 💀 专家 | 8+ 层 | 专业选手 |

## 📁 项目结构

```
gomoku/
├── app/
│   ├── page.tsx          # 主页面
│   ├── layout.tsx        # 布局
│   └── globals.css       # 全局样式
├── components/
│   └── Board.tsx         # 棋盘组件
├── lib/
│   ├── game.ts           # 游戏逻辑
│   └── ai/
│       └── engine.ts     # AI 引擎
├── .team/                # ensemble-team 团队档案
├── docs/                 # 文档
└── public/               # 静态资源
```

## 🌐 部署到 Vercel

### 方式 1: Vercel Dashboard

1. 访问 [vercel.com](https://vercel.com)
2. Import GitHub Repository
3. 选择 `gomoku` 仓库
4. 点击 Deploy

### 方式 2: Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel
```

### 自动部署

推送到 GitHub 后自动部署：

```bash
git add .
git commit -m "feat: 添加新功能"
git push
```

## 🎨 自定义

### 修改棋盘样式

编辑 `components/Board.tsx` 中的绘制函数：

```typescript
// 修改木纹颜色
gradient.addColorStop(0, '#DEB887'); // 改为其他颜色
```

### 修改 AI 强度

编辑 `lib/ai/engine.ts` 中的权重：

```typescript
const WEIGHTS = {
  FIVE: 100000,      // 连五权重
  OPEN_FOUR: 10000,  // 活四权重
  // ...
};
```

## 📊 性能指标

- 首屏加载：<2 秒
- 落子动画：60fps
- AI 响应时间:
  - 简单：<100ms
  - 中等：<500ms
  - 困难：<2 秒
  - 专家：<5 秒

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**Built with ❤️ using ensemble-team**

团队成员：
- Jonathan Blow (Product Owner)
- Don Norman (UI/UX Design)
- Claude Shannon (AI Architecture)
- Dan Abramov (Frontend Lead)
