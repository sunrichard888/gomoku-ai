# 架构决策记录 — Gomoku AI

## ADR-001: 技术栈选择

**日期**: 2026-03-11  
**状态**: 已采纳  
**决策者**: 团队共识

### 上下文

需要选择适合 Vercel 部署、支持精美 UI 和 AI 计算的技术栈。

### 决策

| 层级 | 技术 | 理由 |
|------|------|------|
| Framework | Next.js 14 | Vercel 原生支持、App Router、自动优化 |
| Language | TypeScript 5 | 类型安全、IDE 支持 |
| Styling | Tailwind CSS | 快速开发、响应式、主题定制 |
| Rendering | Canvas API | 225 个交叉点，DOM 太重 |
| Animation | Framer Motion + RAF | 声明式动画 + 手动控制 |
| State | React useState | 简单场景无需 Redux |
| AI | Web Worker | 避免阻塞 UI 线程 |

### 结果

- ✅ Vercel 零配置部署
- ✅ 类型安全
- ✅ 60fps 动画

---

## ADR-002: 棋盘渲染方案

**日期**: 2026-03-11  
**状态**: 已采纳  
**决策者**: Don Norman, Dan Abramov

### 上下文

棋盘渲染有三种方案：
1. DOM + CSS Grid — 225 个 div
2. SVG — 可缩放矢量
3. Canvas — 手动绘制

### 决策

**选择 Canvas**，理由：
- 225 个交叉点 + 动画，DOM 性能不足
- Canvas 可以精细控制绘制（木纹、渐变）
- 动画性能更好（60fps）

### 结果

- 棋盘用 Canvas 绘制
- UI 元素（按钮、信息）用 DOM
- 混合渲染方案

---

## ADR-003: AI 难度分级

**日期**: 2026-03-11  
**状态**: 已采纳  
**决策者**: Claude Shannon

### 上下文

需要设计多个 AI 难度，让不同水平玩家都能享受游戏。

### 决策

| 难度 | 搜索深度 | 响应时间 | 胜率目标 |
|------|---------|---------|---------|
| 简单 | 2 层 | <100ms | 新手可胜 |
| 中等 | 4 层 | <500ms | 50% 胜率 |
| 困难 | 6 层 | <2 秒 | 高手可胜 |
| 专家 | 8+ 层 | <5 秒 | 几乎无敌 |

### 结果

- 四级难度
- 每级有明显差异
- 响应时间在可接受范围

---

*Created with ensemble-team skill*
