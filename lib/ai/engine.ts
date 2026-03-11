// Gomoku AI - Advanced MCTS with Threat Detection + Pattern Recognition
import type { BoardState, Player, Move } from '../game';
import { BOARD_SIZE, checkWin, getValidMoves, makeMove } from '../game';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

// ========== 位置权重表（优化版） ==========
const POSITION_WEIGHTS: number[][] = [
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

// ========== 难度配置 ==========
export function getDifficultyConfig(difficulty: Difficulty) {
  switch (difficulty) {
    case 'easy':
      return { simulations: 100, exploration: 2.0, useOpeningBook: false, threatDepth: 1 };
    case 'medium':
      return { simulations: 300, exploration: 1.5, useOpeningBook: true, threatDepth: 2 };
    case 'hard':
      return { simulations: 800, exploration: 1.0, useOpeningBook: true, threatDepth: 3 };
    case 'expert':
      return { simulations: 1500, exploration: 0.8, useOpeningBook: true, threatDepth: 4 };
    default:
      return { simulations: 300, exploration: 1.5, useOpeningBook: true, threatDepth: 2 };
  }
}

// ========== 棋型权重（精细版） ==========
const PATTERNS = {
  // 进攻棋型
  FIVE: 10000000,        // 连五 - 必胜
  OPEN_FOUR: 1000000,    // 活四 - 下一步必胜
  CLOSED_FOUR: 100000,   // 冲四 - 必须防守
  OPEN_THREE: 10000,     // 活三 - 可以发展
  CLOSED_THREE: 1000,    // 眠三
  OPEN_TWO: 200,         // 活二
  
  // 特殊杀型
  DOUBLE_FOUR: 500000,   // 双四 - 必胜
  DOUBLE_THREE: 50000,   // 双三 - 必胜
  FOUR_THREE: 200000,    // 四三 - 必胜
  
  // 防守棋型
  BLOCK_FIVE: 5000000,   //  blocking 对方连五
  BLOCK_FOUR: 500000,    //  blocking 对方活四
  BLOCK_THREE: 50000,    //  blocking 对方活三
  
  // 位置权重
  CENTER: 50,            // 中心控制
};

// ========== 开局库（扩展版） ==========
const OPENING_BOOK: Record<string, Move> = {
  '': { x: 7, y: 7 },
  '7,7': { x: 8, y: 8 },
  '7,7-8,8': { x: 6, y: 6 },
  '7,7-8,7': { x: 7, y: 8 },
  '7,7-7,8': { x: 8, y: 7 },
  '7,7-6,6': { x: 8, y: 8 },
  '7,7-8,6': { x: 6, y: 8 },
  '7,7-6,8': { x: 8, y: 6 },
};

// ========== 威胁检测 ==========
interface Threat {
  move: Move;
  type: 'FIVE' | 'OPEN_FOUR' | 'CLOSED_FOUR' | 'OPEN_THREE' | 'DOUBLE_FOUR' | 'DOUBLE_THREE';
  player: Player;
  priority: number;
}

// 检测威胁（进攻和防守）
function detectThreats(board: BoardState, player: Player): Threat[] {
  const threats: Threat[] = [];
  const opponent = player === 'black' ? 'white' : 'black';

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== null) continue;

      // 检查这个位置是否形成威胁
      const testBoard = board.map(row => [...row]);
      testBoard[y][x] = player;

      // 检查是否获胜
      if (checkWin(testBoard, x, y, player).winner) {
        threats.push({ move: { x, y }, type: 'FIVE', player, priority: 100 });
        continue;
      }

      // 检查棋型
      const patterns = getAllPatterns(testBoard, x, y, player);
      
      if (patterns.includes('OPEN_FOUR')) {
        threats.push({ move: { x, y }, type: 'OPEN_FOUR', player, priority: 90 });
      } else if (patterns.includes('CLOSED_FOUR')) {
        threats.push({ move: { x, y }, type: 'CLOSED_FOUR', player, priority: 80 });
      } else if (patterns.includes('OPEN_THREE')) {
        threats.push({ move: { x, y }, type: 'OPEN_THREE', player, priority: 70 });
      }

      // 检查双杀
      if (patterns.filter(p => p === 'CLOSED_FOUR').length >= 2) {
        threats.push({ move: { x, y }, type: 'DOUBLE_FOUR', player, priority: 95 });
      }
    }
  }

  return threats.sort((a, b) => b.priority - a.priority);
}

// 获取某位置形成的所有棋型
function getAllPatterns(board: BoardState, x: number, y: number, player: Player): string[] {
  const patterns: string[] = [];
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

  for (const [dx, dy] of directions) {
    const pattern = evaluatePattern(board, x, y, dx, dy, player);
    if (pattern !== 'NONE') {
      patterns.push(pattern);
    }
  }

  return patterns;
}

// ========== 评估函数（增强版） ==========
export function evaluateBoard(board: BoardState, player: Player): number {
  let score = 0;
  const opponent = player === 'black' ? 'white' : 'black';

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = board[y][x];
      if (cell === null) continue;

      const isPlayer = cell === player;
      const weight = POSITION_WEIGHTS[y][x];
      const multiplier = isPlayer ? 1 : -1.5; // 防守权重更高

      // 位置分
      score += multiplier * weight * PATTERNS.CENTER;

      // 棋型分
      const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
      for (const [dx, dy] of directions) {
        const pattern = evaluatePattern(board, x, y, dx, dy, cell);
        const patternScore = PATTERNS[pattern as keyof typeof PATTERNS] || 0;
        score += multiplier * patternScore;
      }
    }
  }

  // 检测威胁（进攻和防守）
  const playerThreats = detectThreats(board, player);
  const opponentThreats = detectThreats(board, opponent);

  // 进攻分
  for (const threat of playerThreats) {
    score += threat.priority * 100;
  }

  // 防守分（更重要）
  for (const threat of opponentThreats) {
    score -= threat.priority * 150;
  }

  return score;
}

// ========== 棋型评估 ==========
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
  let blockedEnds = 0;

  // 正方向
  let i = 1;
  while (true) {
    const nx = x + dx * i;
    const ny = y + dy * i;
    if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) {
      blockedEnds++;
      break;
    }
    if (board[ny][nx] === player) {
      count++;
    } else {
      if (board[ny][nx] === null) openEnds++;
      else blockedEnds++;
      break;
    }
    i++;
  }

  // 反方向
  i = 1;
  while (true) {
    const nx = x - dx * i;
    const ny = y - dy * i;
    if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) {
      blockedEnds++;
      break;
    }
    if (board[ny][nx] === player) {
      count++;
    } else {
      if (board[ny][nx] === null) openEnds++;
      else blockedEnds++;
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

// ========== MCTS 节点（增强版） ==========
class MCTSNode {
  visits = 0;
  wins = 0;
  children: Map<string, MCTSNode> = new Map();
  move: Move | null = null;
  parent: MCTSNode | null = null;
  threatMoves: Threat[] = [];

  constructor(
    public board: BoardState,
    public player: Player,
    move: Move | null = null,
    parent: MCTSNode | null = null
  ) {
    this.move = move;
    this.parent = parent;
    // 预计算威胁
    this.threatMoves = detectThreats(board, player);
  }

  get ucb1() {
    if (this.parent === null || this.parent.visits === 0) return Infinity;
    const exploitation = this.wins / this.visits;
    const exploration = Math.sqrt(Math.log(this.parent.visits) / this.visits);
    return exploitation + exploration * 1.414;
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

  getBestMoves(limit: number = 10): Move[] {
    // 优先返回威胁位置
    if (this.threatMoves.length > 0) {
      return this.threatMoves.slice(0, limit).map(t => t.move);
    }

    // 否则返回中心附近的点
    const moves = getValidMoves(this.board);
    const weighted = moves
      .map(m => ({ ...m, score: POSITION_WEIGHTS[m.y][m.x] + Math.random() * 10 }))
      .sort((a, b) => b.score - a.score);
    
    return weighted.slice(0, limit).map(m => ({ x: m.x, y: m.y }));
  }
}

// ========== MCTS 搜索（增强版） ==========
function mctsSearch(
  board: BoardState,
  player: Player,
  simulations: number,
  exploration: number,
  threatDepth: number
): Move {
  const root = new MCTSNode(board, player);

  // 检查是否有立即获胜或必须防守的棋
  const immediateWin = detectThreats(board, player).find(t => t.type === 'FIVE');
  if (immediateWin) return immediateWin.move;

  const opponent = player === 'black' ? 'white' : 'black';
  const opponentWin = detectThreats(board, opponent).find(t => t.type === 'FIVE');
  if (opponentWin) return opponentWin.move; // 必须防守

  for (let i = 0; i < simulations; i++) {
    let node = root;
    let tempBoard = board.map(row => [...row]);
    let tempPlayer = player;

    // Selection - 优先选择威胁位置
    while (node.children.size > 0) {
      const threatMoves = node.threatMoves.slice(0, threatDepth).map(t => `${t.move.x},${t.move.y}`);
      const children = Array.from(node.children.values());
      
      // 如果有威胁位置，优先选择
      const threatChildren = children.filter(c => c.move && threatMoves.includes(`${c.move.x},${c.move.y}`));
      if (threatChildren.length > 0) {
        node = threatChildren.reduce((best, child) => 
          child.visits === 0 ? child : (child.ucb1 > best.ucb1 ? child : best)
        );
      } else {
        node = children.reduce((best, child) => 
          child.visits === 0 ? child : (child.ucb1 > best.ucb1 ? child : best)
        );
      }
      
      if (node.move) {
        tempBoard[node.move.y][node.move.x] = tempPlayer;
        tempPlayer = tempPlayer === 'black' ? 'white' : 'black';
      }
      
      // 检查是否结束
      if (node.move && checkWin(tempBoard, node.move.x, node.move.y, tempPlayer === 'black' ? 'white' : 'black').winner) {
        break;
      }
    }

    // Expansion - 只扩展高质量位置
    if (!node.isTerminal() && node.visits > 0 && node.children.size === 0) {
      const bestMoves = node.getBestMoves(15); // 只扩展前 15 个好点
      
      for (const move of bestMoves) {
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

    // Simulation - 偏向威胁位置的随机模拟
    let simCount = 0;
    while (!node.isTerminal() && simCount < 30) {
      const moves = getValidMoves(tempBoard);
      if (moves.length === 0) break;
      
      // 检测当前局面的威胁
      const threats = detectThreats(tempBoard, tempPlayer);
      let selectedMove: Move;
      
      if (threats.length > 0 && Math.random() < 0.7) {
        // 70% 概率选择威胁位置
        selectedMove = threats[0].move;
      } else {
        // 否则加权随机
        const weightedMoves = moves.map(m => ({
          ...m,
          weight: POSITION_WEIGHTS[m.y][m.x]
        }));
        const totalWeight = weightedMoves.reduce((s, m) => s + m.weight, 0);
        let random = Math.random() * totalWeight;
        selectedMove = moves[0];
        
        for (const m of weightedMoves) {
          random -= m.weight;
          if (random <= 0) {
            selectedMove = m;
            break;
          }
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
        node.wins += 0.5;
      }
      node = node.parent!;
    }
  }

  // 选择最佳移动
  const children = Array.from(root.children.values());
  if (children.length === 0) {
    const moves = getValidMoves(board);
    return moves[Math.floor(Math.random() * moves.length)] || { x: 7, y: 7 };
  }
  
  // 选择访问次数最多的
  const best = children.reduce((a, b) => a.visits > b.visits ? a : b);
  return best.move!;
}

// ========== 辅助函数 ==========
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

// ========== 主函数 ==========
export function getBestMove(board: BoardState, player: Player, difficulty: Difficulty): Move {
  const config = getDifficultyConfig(difficulty);

  // 使用开局库
  if (config.useOpeningBook && getValidMoves(board).length > BOARD_SIZE * BOARD_SIZE - 3) {
    const opening = getOpeningMove(board);
    if (opening) return opening;
  }

  // MCTS 搜索
  return mctsSearch(board, player, config.simulations, config.exploration, config.threatDepth);
}

export function canAIMove(board: BoardState): boolean {
  return getValidMoves(board).length > 0;
}
