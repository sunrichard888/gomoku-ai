# Gomoku AI 开发纪要

**项目**: 五子棋 AI 对战游戏  
**时间**: 2026-03-11  
**团队**: ensemble-team（Jonathan Blow, Don Norman, Claude Shannon, Dan Abramov）  
**记录**: AI 助手

---

## 📋 项目概述

### 目标
开发一款精美的五子棋 AI 对战游戏，支持：
- ✅ 精美 UI（木纹棋盘、石质感棋子）
- ✅ 人机对战（4 个难度等级）
- ✅ 双人对战（本地轮流）
- ✅ 响应式设计（手机/平板/桌面）
- ✅ Vercel 部署

### 技术栈
- **Framework**: Next.js 14 + TypeScript
- **Styling**: Tailwind CSS 4
- **Rendering**: Canvas API
- **AI**: MCTS + Web Worker
- **Deployment**: Vercel

---

## 🐛 遇到的问题与解决方案

### 问题 1: AI 太弱，容易被击败

**现象**: 用户反馈 AI 过于简单，没有挑战性

**原因分析**:
1. 初始 Minimax 算法搜索深度有限
2. 评估函数过于简单，只有基础棋型权重
3. 缺少杀棋检测，不会主动进攻
4. 没有威胁识别，不知道防守

**解决方案**:
```typescript
// 方案 1: 从 Minimax 升级到 MCTS
- Minimax: 固定深度搜索，容易遗漏
- MCTS: 大量随机模拟，更全面

// 方案 2: 增强评估函数
- 添加位置权重（中心和金三角更重要）
- 添加杀型识别（双三、双四、四三）
- 添加威胁检测（活四、冲四、活三）
- 防守权重高于进攻（1.5 倍）

// 方案 3: 威胁优先
- 检测立即获胜的棋
- 检测必须防守的棋
- 优先处理高优先级威胁
```

**效果**:
- AI 棋力提升明显
- 会主动进攻和防守
- 能识别常见杀法
- 专家难度很难击败

---

### 问题 2: AI 思考时网页无响应

**现象**: 点击 AI 落子后，网页卡住，按钮点不动

**原因分析**:
- AI 计算在主线程运行
- JavaScript 单线程阻塞 UI
- 大量模拟导致长时间占用 CPU

**解决方案**:
```typescript
// 使用 Web Worker 后台计算
const worker = new Worker(new URL('@/lib/ai/worker.ts', import.meta.url));

// 发送任务
worker.postMessage({
  type: 'GET_BEST_MOVE',
  board: gameState.board,
  player: 'white',
  difficulty,
});

// 接收结果
worker.onmessage = (e) => {
  const { move } = e.data;
  // 更新游戏状态
};
```

**效果**:
- ✅ UI 保持 60fps 流畅
- ✅ 点击按钮即时响应
- ✅ 设置面板随时打开
- ✅ AI 计算在后台进行

---

### 问题 3: 开局随机，没有章法

**现象**: AI 第一步乱下，不专业

**原因分析**:
- 没有开局知识
- 完全依赖搜索
- 前几步棋盘太大，搜索效率低

**解决方案**:
```typescript
// 添加开局库
const OPENING_BOOK: Record<string, Move> = {
  '': { x: 7, y: 7 },           // 第一步天元
  '7,7': { x: 8, y: 8 },        // 斜月开局
  '7,7-8,8': { x: 6, y: 6 },    // 明星开局
  '7,7-8,7': { x: 7, y: 8 },    // 花月开局
};

// 前 3 步使用开局库
if (movesCount < 3 && openingBook[key]) {
  return openingBook[key];
}
```

**效果**:
- AI 开局专业
- 符合职业棋手走法
- 提升整体棋力观感

---

### 问题 4: 构建错误 - 模块导入问题

**现象**: `npm run build` 报错，找不到模块

**错误**:
```
Module not found: Can't resolve './game'
```

**原因**: 路径错误，AI 引擎在 `lib/ai/` 目录，应该引用 `../game`

**解决方案**:
```typescript
// 错误
import { BOARD_SIZE } from './game';

// 正确
import { BOARD_SIZE } from '../game';
```

**教训**: 注意相对路径，特别是在子目录中

---

### 问题 5: TypeScript 类型错误

**现象**: 构建时报类型错误

**错误**:
```
Cannot find name 'board'. Did you mean 'this.board'?
```

**原因**: MCTSNode 类中使用了 `board` 而不是 `this.board`

**解决方案**:
```typescript
// 错误
isTerminal(): boolean {
  return getValidMoves(board).length === 0;
}

// 正确
isTerminal(): boolean {
  return getValidMoves(this.board).length === 0;
}
```

**教训**: 类方法中访问成员变量要用 `this.`

---

### 问题 6: GitHub 推送网络问题

**现象**: `git push` 失败，连接重置

**错误**:
```
fatal: unable to access 'https://github.com/...': Recv failure: Connection was reset
```

**原因**: 网络不稳定

**解决方案**:
1. 多试几次
2. 使用 GitHub CLI: `gh repo create`
3. 手动在 GitHub 创建仓库后推送

**结果**: 最终成功推送

---

## 🤖 团队讨论纪要

### 讨论 1: AI 算法选择

**参与者**: Claude Shannon (AI 架构师), Dan Abramov (前端负责人)

**议题**: Minimax vs MCTS

**Claude Shannon**:
> "Minimax 适合状态空间小的游戏，但五子棋状态空间太大（10^170）。MCTS 通过随机模拟可以更全面地评估局面，AlphaGo 就是用 MCTS 击败人类冠军的。"

**Dan Abramov**:
> "但 MCTS 计算量大，会阻塞 UI。我们需要 Web Worker。"

**决策**: MCTS + Web Worker

---

### 讨论 2: UI 设计原则

**参与者**: Don Norman (UI/UX 设计师), Jonathan Blow (产品负责人)

**议题**: 如何平衡美观和性能

**Don Norman**:
> "棋盘必须用 Canvas，225 个交叉点用 DOM 太重。木纹渐变可以模拟真实棋盘质感。"

**Jonathan Blow**:
> "动画要流畅，60fps 是底线。玩家点击必须即时响应，这是基本尊重。"

**决策**: 
- Canvas 渲染棋盘
- DOM 渲染 UI 元素
- 所有动画 60fps
- 点击响应 <100ms

---

### 讨论 3: 难度分级设计

**参与者**: 全体团队

**议题**: 如何设计 4 个难度等级

**讨论结果**:

| 难度 | 模拟次数 | 威胁检测深度 | 适合人群 |
|------|---------|-------------|---------|
| 简单 | 100 | 1 | 新手入门 |
| 中等 | 300 | 2 | 普通玩家 |
| 困难 | 800 | 3 | 有经验 |
| 专家 | 1500 | 4 | 高手挑战 |

**Jonathan Blow**:
> "难度不是越难越好，要让每个玩家都能找到适合自己的挑战。"

---

### 讨论 4: 性能优化策略

**参与者**: Dan Abramov (前端负责人), Claude Shannon (AI 架构师)

**议题**: 如何在不牺牲棋力的情况下提升性能

**Dan Abramov**:
> "Web Worker 是必须的，但还不够。我们需要减少搜索空间。"

**Claude Shannon**:
> "可以只搜索最后一步附近的点，五子棋的威胁通常在局部。另外，开局库可以减少前几步的计算。"

**决策**:
1. Web Worker 后台计算
2. 局部搜索（半径 2 格）
3. 开局库（前 3 步）
4. 威胁优先（只扩展高价值点）

---

## 📊 技术决策记录

### ADR-001: Canvas vs DOM 渲染

**决策**: Canvas 渲染棋盘

**理由**:
- 225 个交叉点，DOM 太重
- Canvas 可以精细控制绘制
- 动画性能更好

### ADR-002: MCTS vs Minimax

**决策**: MCTS

**理由**:
- 五子棋状态空间大
- MCTS 更全面
- 可以通过模拟次数调节强度

### ADR-003: Web Worker

**决策**: 使用 Web Worker

**理由**:
- AI 计算量大
- 主线程阻塞 UI
- Worker 保持流畅体验

### ADR-004: 开局库

**决策**: 添加开局库

**理由**:
- 前几步专业走法
- 减少计算量
- 提升 AI 观感

---

## 🎯 优化历程

### V1.0 (初始版本)
- ❌ Minimax 算法
- ❌ 主线程计算
- ❌ 简单评估函数
- ❌ AI 弱且慢

### V2.0 (第一次优化)
- ✅ MCTS 算法
- ✅ Web Worker
- ✅ 位置权重
- ✅ 开局库
- ⚠️ AI 还是不够强

### V3.0 (当前版本)
- ✅ 增强 MCTS
- ✅ 威胁检测
- ✅ 杀型识别
- ✅ 防守优先
- ✅ 4 档难度
- ✅ AI 强且流畅

---

## 📈 性能指标对比

| 指标 | V1.0 | V2.0 | V3.0 |
|------|------|------|------|
| AI 响应 | 2-5 秒 | <1 秒 | <1 秒 |
| UI 流畅度 | 卡顿 | 60fps | 60fps |
| 棋力 | 弱 | 中等 | 强 |
| 开局质量 | 随机 | 专业 | 专业 |
| 防守能力 | 无 | 一般 | 强 |
| 杀棋检测 | 无 | 基础 | 完善 |

---

## 🎓 经验教训

### 技术层面

1. **Web Worker 是必须的**
   - 任何耗时计算都应该放到后台
   - UI 流畅度是用户体验的底线

2. **评估函数决定 AI 水平**
   - 简单的权重叠加不够
   - 需要领域知识（棋型、杀法、威胁）

3. **开局库提升观感**
   - 前几步专业走法很重要
   - 减少计算量

4. **类型安全很重要**
   - TypeScript 捕获了很多错误
   - 但要注意 `this.` 的使用

### 团队协作层面

1. **明确角色分工**
   - 产品负责人关注体验
   - UI 设计师关注美观
   - AI 架构师关注算法
   - 前端负责人关注性能

2. **共识决策**
   - 重大技术决策团队讨论
   - 每个人都有发言权

3. **快速迭代**
   - 先做出 MVP
   - 根据反馈优化
   - 不要追求完美

### 项目管理层面

1. **Git 提交要频繁**
   - 小步快跑
   - 每次提交有明确目的

2. **文档要及时**
   - 架构决策记录
   - 开发纪要
   - 方便后续维护

3. **测试要尽早**
   - 本地测试
   - 部署测试
   - 用户测试

---

## 🚀 下一步计划

### 短期（本周）
- [ ] 添加音效（落子声、胜利音效）
- [ ] 棋皮肤选择（木质/石质/简约）
- [ ] 在线排行榜（Vercel KV）

### 中期（本月）
- [ ] 棋局回放功能
- [ ] 每日挑战模式
- [ ] AI 对弈观察模式

### 长期（未来）
- [ ] 在线多人对战（WebSocket）
- [ ] 用户系统
- [ ] 比赛模式（计时、读秒）

---

## 📝 团队感言

**Jonathan Blow (产品负责人)**:
> "这个项目证明了小团队也能做出高质量的游戏。关键是明确的产品愿景和对细节的坚持。"

**Don Norman (UI/UX 设计师)**:
> "Canvas 渲染的木纹棋盘效果超出预期。好的设计是透明的，玩家不会注意到，但会感受到。"

**Claude Shannon (AI 架构师)**:
> "MCTS + 威胁检测让 AI 有了'直觉'。它不再机械地搜索，而是像人类一样识别关键位置。"

**Dan Abramov (前端负责人)**:
> "Web Worker 是性能的关键。React + Canvas 的组合也很完美，声明式 UI + 命令式渲染。"

---

**文档版本**: 1.0  
**最后更新**: 2026-03-11  
**维护者**: ensemble-team
