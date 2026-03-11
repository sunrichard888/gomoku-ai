// Gomoku AI - Optimized with MCTS + Heuristics + Web Worker
import type { BoardState, Player, Move } from '../game';
import { BOARD_SIZE, checkWin, getValidMoves } from '../game';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

// 位置权重表 - 中心和金三角位置更重要
const POSITION_WEIGHTS = [
  [1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 1],
  [2, 3, 4, 5, 6, 5, 4, 3, 2, 3, 4, 5, 6, 5, 4, 3, 2],
  [3, 4, 5, 6, 7, 6, 5, 4, 3, 4, 5, 6, 7, 6, 5, 4, 3],
  [4, 5, 6, 7, 8, 7, 6, 5, 4, 5, 6, 7, 8, 7, 6, 5, 4],
  [5, 6, 7, 8, 9, 8, 7, 6, 5, 6, 7, 8, 9, 8, 7, 6, 5],
  [4, 5, 6, 7, 8, 9, 8, 7, 6, 7, 8, 9, 10, 9, 8, 7, 6],
  [3, 4, 5, 6, 7, 8, 9, 8, 7, 8, 9, 10, 11, 10, 9, 8, 7],
  [2, 3, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 11, 10, 9, 8],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 10, 9, 8, 7],
  [2, 3, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 11, 10, 9, 8],
  [3, 4, 5, 6, 7, 8, 9, 10, 9, 10, 11, 12, 13, 12, 11, 10, 9],
  [4, 5, 6, 7, 8, 9, 10, 11, 10, 11, 12, 13, 14, 13, 12, 11, 10],
  [5, 6, 7, 8, 9, 10, 11, 12, 11, 12, 13, 14, 15, 14, 13, 12, 11],
  [4, 5, 6, 7, 8, 9, 10, 11, 10, 11, 12, 13, 14, 13, 12, 11, 10],
  [3, 4, 5, 6, 7, 8, 9, 10, 9, 10, 11, 12, 13, 12, 11, 10, 9],
];

// 开局库 - 专业开局走法
const OPENING_BOOK: Record<string, Move> = {
  '': { x: 7, y: 7 }, // 第一步天元
  '7,7': { x: 8, y: 8 }, // 斜月开局
  '7,7-8,8': { x: 6, y: 6 }, // 明星开局
  '7,7-8,7': { x: 7, y: 8 }, // 花月开局
};

// 难度配置
export function getDifficultyConfig(difficulty: Difficulty) {
  switch (difficulty) {
    case 'easy':
      return { simulations: 50, exploration: 1.5, useOpeningBook: false };
    case 'medium':
      return { simulations: 200, exploration: 1.0, useOpeningBook: true };
    case 'hard':
      return { simulations: 500, exploration: 0.8, useOpeningBook: true };
    case 'expert':
      return { simulations: 1000, exploration: 0.7, useOpeningBook: true };
    default:
      return { simulations: 200, exploration: 1.0, useOpeningBook: true };
  }
}

// 棋型评估权重（优化版）
const PATTERNS = {
  FIVE: 1000000,        // 连五
  OPEN_FOUR: 50000,     // 活四
  CLOSED_FOUR: 5000,    // 冲四
  OPEN_THREE: 2000,     // 活三
  CLOSED_THREE: 500,    // 眠三
  OPEN_TWO: 100,        // 活二
  CENTER_CONTROL: 10,   // 中心控制
};

// 评估棋盘（带位置权重）
export function evaluateBoard(board: BoardState, player: Player): number {
  let score = 0;
  const opponent = player === 'black' ? 'white' : 'black';

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === null) continue;

      const isPlayer = board[y][x] === player;
      const weight = POSITION_WEIGHTS[y][x];
      const multiplier = isPlayer ? 1 : -1;

      // 基础分 + 位置分
      score += multiplier * weight * PATTERNS.CENTER_CONTROL;

      // 评估四个方向
      const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
      for (const [dx, dy] of directions) {
        const pattern = evaluatePattern(board, x, y, dx, dy, board[y][x]!);
        score += multiplier * PATTERNS[pattern as keyof typeof PATTERNS];
      }
    }
  }

  return score;
}

// 评估单个方向的棋型
function evaluatePattern(
  board: BoardState,
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: Player
): string {
  let count = 1;
  let openEnds = 0;

  // 正方向
  let i = 1;
  while (true) {
    const nx = x + dx * i;
    const ny = y + dy * i;
    if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) break;
    if (board[ny][nx] === player) {
      count++;
    } else {
      if (board[ny][nx] === null) openEnds++;
      break;
    }
    i++;
  }

  // 反方向
  i = 1;
  while (true) {
    const nx = x - dx * i;
    const ny = y - dy * i;
    if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) break;
    if (board[ny][nx] === player) {
      count++;
    } else {
      if (board[ny][nx] === null) openEnds++;
      break;
    }
    i++;
  }

  if (count >= 5) return 'FIVE';
  if (count === 4 && openEnds === 2) return 'OPEN_FOUR';
  if (count === 4 && openEnds === 1) return 'CLOSED_FOUR';
  if (count === 3 && openEnds === 2) return 'OPEN_THREE';
  if (count === 3 && openEnds === 1) return 'CLOSED_THREE';
  if (count === 2 && openEnds === 2) return 'OPEN_TWO';
  return 'NONE';
}

// MCTS 节点
class MCTSNode {
  visits = 0;
  wins = 0;
  children: Map<string, MCTSNode> = new Map();
  move: Move | null = null;
  parent: MCTSNode | null = null;

  constructor(public board: BoardState, public player: Player, move: Move | null = null, parent: MCTSNode | null = null) {
    this.move = move;
    this.parent = parent;
  }

  get ucb1() {
    if (this.parent === null || this.parent.visits === 0) return Infinity;
    const exploitation = this.wins / this.visits;
    const exploration = Math.sqrt(Math.log(this.parent.visits) / this.visits);
    return exploitation + exploration * 1.414; // √2
  }

  isTerminal(): boolean {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (this.board[y][x] !== null) {
          const win = checkWin(this.board, x, y, this.board[y][x]!);
          if (win.winner) return true;
        }
      }
    }
    return getValidMoves(this.board).length === 0;
  }
}

// MCTS 搜索
function mctsSearch(board: BoardState, player: Player, simulations: number, exploration: number): Move {
  const root = new MCTSNode(board, player);

  for (let i = 0; i < simulations; i++) {
    let node = root;
    let tempBoard = board.map(row => [...row]);
    let tempPlayer = player;

    // Selection
    while (node.children.size > 0) {
      const children = Array.from(node.children.values());
      node = children.reduce((best, child) => 
        child.visits === 0 ? child : (child.ucb1 > best.ucb1 ? child : best)
      );
      
      if (node.move) {
        tempBoard[node.move.y][node.move.x] = tempPlayer;
        tempPlayer = tempPlayer === 'black' ? 'white' : 'black';
      }
      
      if (checkWin(tempBoard, node.move?.x || 0, node.move?.y || 0, tempPlayer === 'black' ? 'white' : 'black').winner) {
        break;
      }
    }

    // Expansion
    if (!node.isTerminal() && node.visits > 0) {
      const moves = getValidMoves(tempBoard);
      const centerMoves = moves
        .map(m => ({ ...m, score: POSITION_WEIGHTS[m.y][m.x] }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // 只扩展最好的 10 个点

      for (const move of centerMoves) {
        if (!node.children.has(`${move.x},${move.y}`)) {
          const child = new MCTSNode(tempBoard.map(r => [...r]), tempPlayer, move, node);
          node.children.set(`${move.x},${move.y}`, child);
          node = child;
          tempBoard[move.y][move.x] = tempPlayer;
          tempPlayer = tempPlayer === 'black' ? 'white' : 'black';
          break;
        }
      }
    }

    // Simulation
    let simCount = 0;
    while (!node.isTerminal() && simCount < 20) {
      const moves = getValidMoves(tempBoard);
      if (moves.length === 0) break;
      
      // 偏向中心的随机选择
      const weightedMoves = moves.map(m => ({
        ...m,
        weight: POSITION_WEIGHTS[m.y][m.x]
      }));
      const totalWeight = weightedMoves.reduce((s, m) => s + m.weight, 0);
      let random = Math.random() * totalWeight;
      let selectedMove = moves[0];
      
      for (const m of weightedMoves) {
        random -= m.weight;
        if (random <= 0) {
          selectedMove = m;
          break;
        }
      }
      
      tempBoard[selectedMove.y][selectedMove.x] = tempPlayer;
      tempPlayer = tempPlayer === 'black' ? 'white' : 'black';
      simCount++;
    }

    // Backpropagation
    const winner = getWinner(tempBoard);
    while (node) {
      node.visits++;
      if (winner === node.player) {
        node.wins++;
      } else if (winner === null) {
        node.wins += 0.5; // 平局算半分
      }
      node = node.parent!;
    }
  }

  // 选择访问次数最多的
  const children = Array.from(root.children.values());
  if (children.length === 0) {
    const moves = getValidMoves(board);
    return moves[Math.floor(Math.random() * moves.length)];
  }
  
  const best = children.reduce((a, b) => a.visits > b.visits ? a : b);
  return best.move!;
}

// 获取赢家
function getWinner(board: BoardState): Player | 'draw' | null {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== null) {
        const win = checkWin(board, x, y, board[y][x]!);
        if (win.winner) return win.winner;
      }
    }
  }
  return getValidMoves(board).length === 0 ? 'draw' : null;
}

// 获取开局库走法
function getOpeningMove(board: BoardState): Move | null {
  const moves: string[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== null) {
        moves.push(`${x},${y}`);
      }
    }
  }
  moves.sort();
  const key = moves.join('-');
  return OPENING_BOOK[key] || null;
}

// 主函数：获取最佳移动
export function getBestMove(board: BoardState, player: Player, difficulty: Difficulty): Move {
  const config = getDifficultyConfig(difficulty);

  // 使用开局库
  if (config.useOpeningBook) {
    const opening = getOpeningMove(board);
    if (opening) return opening;
  }

  // MCTS 搜索
  return mctsSearch(board, player, config.simulations, config.exploration);
}

// 检查是否可以移动
export function canAIMove(board: BoardState): boolean {
  return getValidMoves(board).length > 0;
}
