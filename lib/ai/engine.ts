// Gomoku AI - 增强版 MCTS + VCF + 转置表
import type { BoardState, Player, Move } from '../game';
import { BOARD_SIZE, checkWin, getValidMoves, makeMove } from '../game';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

// ========== 转置表（Transposition Table） ==========
interface TTEntry {
  depth: number;
  score: number;
  flag: 'EXACT' | 'LOWERBOUND' | 'UPPERBOUND';
  bestMove: Move | null;
}

class TranspositionTable {
  private table: Map<string, TTEntry> = new Map();

  private hash(board: BoardState): string {
    let hash = '';
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        hash += board[y][x] === null ? '0' : board[y][x] === 'black' ? '1' : '2';
      }
    }
    return hash;
  }

  get(board: BoardState): TTEntry | null {
    return this.table.get(this.hash(board)) || null;
  }

  set(board: BoardState, entry: TTEntry): void {
    this.table.set(this.hash(board), entry);
  }

  clear(): void {
    this.table.clear();
  }

  size(): number {
    return this.table.size;
  }
}

// ========== 位置权重表 ==========
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
      return { simulations: 100, exploration: 2.0, useVCF: false, useTT: true };
    case 'medium':
      return { simulations: 300, exploration: 1.5, useVCF: true, useTT: true };
    case 'hard':
      return { simulations: 800, exploration: 1.0, useVCF: true, useTT: true };
    case 'expert':
      return { simulations: 1500, exploration: 0.8, useVCF: true, useTT: true };
    default:
      return { simulations: 300, exploration: 1.5, useVCF: true, useTT: true };
  }
}

// ========== 棋型权重 ==========
const PATTERNS = {
  FIVE: 10000000,
  OPEN_FOUR: 1000000,
  CLOSED_FOUR: 100000,
  OPEN_THREE: 10000,
  CLOSED_THREE: 1000,
  OPEN_TWO: 200,
  CENTER: 50,
};

// ========== 开局库 ==========
const OPENING_BOOK: Record<string, Move> = {
  '': { x: 7, y: 7 },
  '7,7': { x: 8, y: 8 },
  '7,7-8,8': { x: 6, y: 6 },
  '7,7-8,7': { x: 7, y: 8 },
  '7,7-7,8': { x: 8, y: 7 },
};

// ========== VCF 搜索（连续冲四取胜） ==========
function searchVCF(board: BoardState, player: Player, depth: number = 10): Move | null {
  const moves = getValidMoves(board);
  
  // 检查每一步是否形成连五
  for (const move of moves) {
    const testBoard = board.map(row => [...row]);
    testBoard[move.y][move.x] = player;
    
    if (checkWin(testBoard, move.x, move.y, player).winner) {
      return move; // 立即获胜
    }
    
    // 检查是否形成冲四（对方必须防守）
    const patterns = getAllPatterns(testBoard, move.x, move.y, player);
    if (patterns.includes('CLOSED_FOUR') || patterns.includes('OPEN_FOUR')) {
      // 递归检查后续
      if (depth > 0) {
        const opponent = player === 'black' ? 'white' : 'black';
        const response = searchVCF(testBoard, opponent, depth - 1);
        if (!response) {
          return move; // 对方无法防守
        }
      }
    }
  }
  
  return null;
}

// ========== 威胁检测 ==========
interface Threat {
  move: Move;
  type: 'FIVE' | 'OPEN_FOUR' | 'CLOSED_FOUR' | 'OPEN_THREE';
  priority: number;
}

function detectThreats(board: BoardState, player: Player): Threat[] {
  const threats: Threat[] = [];
  const moves = getValidMoves(board);

  for (const move of moves) {
    const testBoard = board.map(row => [...row]);
    testBoard[move.y][move.x] = player;

    if (checkWin(testBoard, move.x, move.y, player).winner) {
      threats.push({ move, type: 'FIVE', priority: 100 });
      continue;
    }

    const patterns = getAllPatterns(testBoard, move.x, move.y, player);
    
    if (patterns.includes('OPEN_FOUR')) {
      threats.push({ move, type: 'OPEN_FOUR', priority: 90 });
    } else if (patterns.includes('CLOSED_FOUR')) {
      threats.push({ move, type: 'CLOSED_FOUR', priority: 80 });
    } else if (patterns.includes('OPEN_THREE')) {
      threats.push({ move, type: 'OPEN_THREE', priority: 70 });
    }
  }

  return threats.sort((a, b) => b.priority - a.priority);
}

// ========== 棋型评估 ==========
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

  let i = 1;
  while (true) {
    const nx = x + dx * i;
    const ny = y + dy * i;
    if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) break;
    if (board[ny][nx] === player) count++;
    else {
      if (board[ny][nx] === null) openEnds++;
      break;
    }
    i++;
  }

  i = 1;
  while (true) {
    const nx = x - dx * i;
    const ny = y - dy * i;
    if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) break;
    if (board[ny][nx] === player) count++;
    else {
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

// ========== 评估函数 ==========
export function evaluateBoard(board: BoardState, player: Player): number {
  let score = 0;
  const opponent = player === 'black' ? 'white' : 'black';

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = board[y][x];
      if (cell === null) continue;

      const isPlayer = cell === player;
      const weight = POSITION_WEIGHTS[y][x];
      const multiplier = isPlayer ? 1 : -1.5;

      score += multiplier * weight * PATTERNS.CENTER;

      const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
      for (const [dx, dy] of directions) {
        const pattern = evaluatePattern(board, x, y, dx, dy, cell);
        const patternScore = PATTERNS[pattern as keyof typeof PATTERNS] || 0;
        score += multiplier * patternScore;
      }
    }
  }

  return score;
}

// ========== MCTS 节点 ==========
class MCTSNode {
  visits = 0;
  wins = 0;
  children: Map<string, MCTSNode> = new Map();
  move: Move | null = null;
  parent: MCTSNode | null = null;

  constructor(
    public board: BoardState,
    public player: Player,
    move: Move | null = null,
    parent: MCTSNode | null = null
  ) {
    this.move = move;
    this.parent = parent;
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
}

// ========== MCTS 搜索（带 VCF 和转置表） ==========
function mctsSearch(
  board: BoardState,
  player: Player,
  simulations: number,
  exploration: number,
  useVCF: boolean,
  useTT: boolean
): Move {
  const tt = useTT ? new TranspositionTable() : null;
  const root = new MCTSNode(board, player);

  // 1. 检查 VCF（一步杀）
  if (useVCF) {
    const vcfMove = searchVCF(board, player, 6);
    if (vcfMove) return vcfMove;

    // 2. 检查必须防守的棋
    const opponent = player === 'black' ? 'white' : 'black';
    const opponentVCF = searchVCF(board, opponent, 6);
    if (opponentVCF) return opponentVCF;
  }

  // 3. 检查开局库
  const opening = getOpeningMove(board);
  if (opening) return opening;

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

      if (node.move && checkWin(tempBoard, node.move.x, node.move.y, tempPlayer === 'black' ? 'white' : 'black').winner) {
        break;
      }
    }

    // Expansion
    if (!node.isTerminal() && node.visits > 0 && node.children.size === 0) {
      const moves = getValidMoves(tempBoard);
      const threats = useVCF ? detectThreats(tempBoard, tempPlayer) : [];
      const bestMoves = threats.length > 0
        ? threats.slice(0, 10).map(t => t.move)
        : moves
            .map(m => ({ ...m, score: POSITION_WEIGHTS[m.y][m.x] + Math.random() * 10 }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 15)
            .map(m => ({ x: m.x, y: m.y }));

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

    // Simulation
    let simCount = 0;
    while (!node.isTerminal() && simCount < 30) {
      const moves = getValidMoves(tempBoard);
      if (moves.length === 0) break;

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
        node.wins += 0.5;
      }
      node = node.parent!;
    }
  }

  const children = Array.from(root.children.values());
  if (children.length === 0) {
    const moves = getValidMoves(board);
    return moves[Math.floor(Math.random() * moves.length)] || { x: 7, y: 7 };
  }

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
  return mctsSearch(board, player, config.simulations, config.exploration, config.useVCF, config.useTT);
}

export function canAIMove(board: BoardState): boolean {
  return getValidMoves(board).length > 0;
}
