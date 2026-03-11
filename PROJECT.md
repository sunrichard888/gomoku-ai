# Gomoku AI

五子棋 AI 对战游戏 — 精美 UI、多级难度、响应式设计

> **This document contains project owner constraints.** The team must follow these rules. Changes to this document require project owner approval.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS + CSS Modules
- **Rendering**: Canvas API (棋盘) + DOM (UI 元素)
- **Animation**: Framer Motion + requestAnimationFrame
- **State**: React useState/useReducer (无需额外状态管理)
- **AI**: Web Worker (Minimax + αβ剪枝)
- **Storage**: localStorage (存档、战绩)
- **Deployment**: Vercel (GitHub 自动部署)

## Development Mandates

这些是项目的强制要求：

- **Test-Driven Development**: 核心逻辑（胜负判定、AI）必须有测试
- **Mob/Ensemble Programming**: 所有生产代码由群体编写，需 Review 后提交
- **Consensus Decision-Making**: 团队共识决策，10 轮未达成共识则升级给项目所有者
- **Driver-Reviewer Mob Model**: 最多一人（Driver）修改文件，其他人作为 Reviewers
- **Code Quality Gates**:
  - ESLint + Prettier 零错误
  - TypeScript 零类型错误
  - 核心逻辑测试覆盖率 >80%
  - Lighthouse 性能分数 >90

## Environment & Tooling

- **Node.js**: 18+
- **Package Manager**: pnpm (推荐) 或 npm
- **IDE**: VS Code / Cursor / Windsurf
- **Browser**: Chrome/Edge (开发测试)

## Scope

### Must Have (MVP)
- [x] 15×15 标准棋盘（Canvas 渲染）
- [x] 双人对战模式（本地轮流）
- [x] 人机对战模式（AI）
- [x] AI 难度选择（简单/中等/困难/专家）
- [x] 胜负判定（横/竖/斜五子连线）
- [x] 悔棋功能
- [x] 游戏存档（localStorage）
- [x] 响应式设计（手机/平板/桌面）
- [x] 精美 UI（木纹棋盘、石质感棋子）
- [x] 落子动画和音效

### Should Have
- [ ] 战绩统计（胜/负/平）
- [ ] AI 思考可视化（显示搜索深度）
- [ ] 棋盘皮肤选择（木质/石质/简约）
- [ ] 棋子皮肤选择（经典/卡通）
- [ ] 每日挑战模式

### Could Have
- [ ] 在线排行榜（Vercel KV）
- [ ] 分享功能（分享棋谱）
- [ ]  replays（棋局回放）
- [ ] 教程模式（新手引导）

### Out of Scope
- [ ] 在线多人对战（需要 WebSocket 服务器）
- [ ] 用户系统
- [ ] 支付功能
- [ ] 3D 效果

## Design Principles

1. **棋盘是主角** — UI 元素不应该干扰棋盘
2. **60fps 动画** — 所有动画必须流畅
3. **触摸友好** — 最小点击区域 44px
4. **温暖配色** — 木纹色、暖灰色、自然感
5. **无干扰** — 没有弹窗、广告、多余元素

## Performance Targets

- 首屏加载 <2 秒
- 落子动画 60fps
- AI 响应时间：
  - 简单：<100ms
  - 中等：<500ms
  - 困难：<2 秒
  - 专家：<5 秒

---

*Created with ensemble-team skill*
