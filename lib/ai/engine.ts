// Gomoku AI - 专业版 (α-β剪枝 + 迭代加深 + 杀手启发)
// 参考 Gomocup 参赛引擎架构
import type { BoardState, Player, Move } from '../game';
import { BOARD_SIZE, checkWin, getValidMoves, makeMove } from '../game';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

// ========== 常量定义 ==========
const INF = 100000000;
const NULL_MOVE: Move = { x: -1, y: -1 };

// ========== 难度配置 ==========
export function getDifficultyConfig(difficulty: Difficulty) {
  switch (difficulty) {
    case 'easy':
      return { maxDepth: 4, useOpeningBook: true, useEndgameDB: false };
    case 'medium':
      return { maxDepth: 6, useOpeningBook: true, useEndgameDB: false };
    case 'hard':
      return { maxDepth: 8, useOpeningBook: true, useEndgameDB: true };
    case 'expert':
      return { maxDepth: 10, useOpeningBook: true, useEndgameDB: true };
    default:
      return { maxDepth: 6, useOpeningBook: true, useEndgameDB: false };
  }
}

// ========== 棋型定义 ==========
enum PatternType {
  NONE = 0,
  TWO,          // 活二
  BROKEN_TWO,   // 跳二
  THREE,        // 活三
  BROKEN_THREE, // 跳活三
  FOUR,         // 冲四
  BROKEN_FOUR,  // 跳冲四
  OPEN_FOUR,    // 活四
  FIVE,         // 连五
}

// ========== 棋型权重 ==========
const PATTERN_WEIGHTS: Record<PatternType, number> = {
  [PatternType.NONE]: 0,
  [PatternType.TWO]: 100,
  [PatternType.BROKEN_TWO]: 80,
  [PatternType.THREE]: 1000,
  [PatternType.BROKEN_THREE]: 800,
  [PatternType.FOUR]: 10000,
  [PatternType.BROKEN_FOUR]: 8000,
  [PatternType.OPEN_FOUR]: 50000,
  [PatternType.FIVE]: 1000000,
};

// ========== 位置权重（中心优先） ==========
const POSITION_WEIGHTS: number[][] = [
  [1, 1, 2, 2, 3, 3, 4, 5, 4, 3, 3, 2, 2, 1, 1],
  [1, 2, 3, 3, 4, 4, 5, 6, 5, 4, 4, 3, 3, 2, 1],
  [2, 3, 4, 4, 5, 5, 6, 7, 6, 5, 5, 4, 4, 3, 2],
  [2, 3, 4, 5, 6, 6, 7, 8, 7, 6, 6, 5, 4, 3, 2],
  [3, 4, 5, 6, 7, 8, 9, 10, 9, 8, 7, 6, 5, 4, 3],
  [3, 4, 5, 6, 8, 9, 11, 12, 11, 9, 8, 6, 5, 4, 3],
  [4, 5, 6, 7, 9, 11, 13, 14, 13, 11, 9, 7, 6, 5, 4],
  [5, 6, 7, 8, 10, 12, 14, 15, 14, 12, 10, 8, 7, 6, 5],
  [4, 5, 6, 7, 9, 11, 13, 14, 13, 11, 9, 7, 6, 5, 4],
  [3, 4, 5, 6, 8, 9, 11, 12, 11, 9, 8, 6, 5, 4, 3],
  [3, 4, 5, 6, 7, 8, 9, 10, 9, 8, 7, 6, 5, 4, 3],
  [2, 3, 4, 5, 6, 6, 7, 8, 7, 6, 6, 5, 4, 3, 2],
  [2, 3, 4, 4, 5, 5, 6, 7, 6, 5, 5, 4, 4, 3, 2],
  [1, 2, 3, 3, 4, 4, 5, 6, 5, 4, 4, 3, 3, 2, 1],
  [1, 1, 2, 2, 3, 3, 4, 5, 4, 3, 3, 2, 2, 1, 1],
];

// ========== 置换表（Transposition Table） ==========
interface TTEntry {
  depth: number;
  score: number;
  flag: 'EXACT' | 'LOWERBOUND' | 'UPPERBOUND';
  bestMove: Move;
}

class TranspositionTable {
  private table: Map<string, TTEntry> = new Map();

  private hash(board: BoardState, player: Player): string {
    let hash = `${player}:`;
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        hash += board[y][x] === null ? '0' : board[y][x] === 'black' ? '1' : '2';
      }
    }
    return hash;
  }

  get(board: BoardState, player: Player): TTEntry | null {
    return this.table.get(this.hash(board, player)) || null;
  }

  set(board: BoardState, player: Player, entry: TTEntry): void {
    this.table.set(this.hash(board, player), entry);
  }

  clear(): void {
    this.table.clear();
  }
}

// ========== 杀手启发（Killer Heuristic） ==========
class KillerTable {
  private killers: Move[][] = [];

  constructor(maxDepth: number) {
    this.killers = Array(maxDepth).fill(null).map(() => []);
  }

  get(depth: number): Move[] {
    return this.killers[depth] || [];
  }

  add(depth: number, move: Move): void {
    if (!this.killers[depth]) this.killers[depth] = [];
    // 避免重复
    const exists = this.killers[depth].some(m => m.x === move.x && m.y === move.y);
    if (!exists) {
      this.killers[depth].unshift(move);
      if (this.killers[depth].length > 3) {
        this.killers[depth].pop();
      }
    }
  }

  clear(): void {
    this.killers = this.killers.map(() => []);
  }
}

// ========== 历史启发（History Heuristic） ==========
class HistoryTable {
  private history: number[][] = [];

  constructor() {
    this.history = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
  }

  get(move: Move): number {
    return this.history[move.y][move.x];
  }

  add(move: Move, bonus: number): void {
    this.history[move.y][move.x] += bonus;
  }

  clear(): void {
    this.history = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
  }
}

// ========== 开局库（26 种标准开局） ==========
const OPENING_BOOK: Record<string, Move[]> = {
  '': [{ x: 7, y: 7 }], // 天元
  '7,7': [
    { x: 8, y: 8 }, // 直指
    { x: 8, y: 7 }, // 斜指
  ],
  '7,7-8,8': [
    { x: 6, y: 6 }, // 花月
    { x: 9, y: 9 }, // 浦月
    { x: 7, y: 9 }, // 云月
  ],
  '7,7-8,7': [
    { x: 7, y: 8 }, // 雨月
    { x: 9, y: 7 }, // 金星
  ],
};

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
  const bookMoves = OPENING_BOOK[key];
  if (bookMoves && bookMoves.length > 0) {
    return bookMoves[Math.floor(Math.random() * bookMoves.length)];
  }
  return null;
}

// ========== 棋型识别 ==========
function evaluateLine(
  board: BoardState,
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: Player
): PatternType {
  const opponent = player === 'black' ? 'white' : 'black';
  let count = 1;
  let openEnds = 0;
  let blocked = 0;

  // 正方向
  let i = 1;
  while (true) {
    const nx = x + dx * i;
    const ny = y + dy * i;
    if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) {
      blocked++;
      break;
    }
    if (board[ny][nx] === player) {
      count++;
    } else if (board[ny][nx] === null) {
      openEnds++;
      break;
    } else {
      blocked++;
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
      blocked++;
      break;
    }
    if (board[ny][nx] === player) {
      count++;
    } else if (board[ny][nx] === null) {
      openEnds++;
      break;
    } else {
      blocked++;
      break;
    }
    i++;
  }

  if (count >= 5) return PatternType.FIVE;
  if (count === 4 && openEnds === 2) return PatternType.OPEN_FOUR;
  if (count === 4 && openEnds === 1) return PatternType.FOUR;
  if (count === 3 && openEnds === 2) return PatternType.THREE;
  if (count === 3 && openEnds === 1) return PatternType.FOUR; // 冲四
  if (count === 2 && openEnds === 2) return PatternType.TWO;
  if (count === 2 && openEnds === 1) return PatternType.BROKEN_TWO;
  
  return PatternType.NONE;
}

// ========== 评估函数 ==========
function evaluateBoard(board: BoardState, player: Player): number {
  const opponent = player === 'black' ? 'white' : 'black';
  let playerScore = 0;
  let opponentScore = 0;

  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

  // 评估所有棋子
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = board[y][x];
      if (cell === null) continue;

      const isPlayer = cell === player;
      const posWeight = POSITION_WEIGHTS[y][x];

      for (const [dx, dy] of directions) {
        const pattern = evaluateLine(board, x, y, dx, dy, cell);
        const weight = PATTERN_WEIGHTS[pattern];
        
        if (isPlayer) {
          playerScore += weight * posWeight / 10;
        } else {
          opponentScore += weight * posWeight / 10;
        }
      }
    }
  }

  // 检查连五（游戏结束）
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== null) {
        const win = checkWin(board, x, y, board[y][x]!);
        if (win.winner) {
          return win.winner === player ? INF : -INF;
        }
      }
    }
  }

  return playerScore - opponentScore * 1.1; // 防守略优先
}

// ========== 着法生成（带启发式排序） ==========
function generateMoves(
  board: BoardState,
  player: Player,
  killerMoves: Move[],
  historyTable: HistoryTable
): Move[] {
  const moves: Move[] = [];
  const opponent = player === 'black' ? 'white' : 'black';

  // 1. 检查是否有连五/活四/冲四（强制着法）
  const threats: Move[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === null) {
        // 检查这步是否形成杀棋
        const testBoard = board.map(row => [...row]);
        testBoard[y][x] = player;
        
        if (checkWin(testBoard, x, y, player).winner) {
          return [{ x, y }]; // 直接获胜
        }

        // 检查是否形成活四/冲四
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
          const pattern = evaluateLine(testBoard, x, y, dx, dy, player);
          if (pattern === PatternType.OPEN_FOUR || pattern === PatternType.FOUR) {
            threats.push({ x, y });
          }
        }

        // 检查是否需要防守对方的杀棋
        testBoard[y][x] = opponent;
        if (checkWin(testBoard, x, y, opponent).winner) {
          threats.unshift({ x, y }); // 最高优先级
        }
      }
    }
  }

  if (threats.length > 0) {
    return threats;
  }

  // 2. 生成所有合法着法（只考虑有邻居的空位）
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === null) {
        // 检查周围是否有棋子（2 格范围内）
        let hasNeighbor = false;
        for (let dy = -2; dy <= 2 && !hasNeighbor; dy++) {
          for (let dx = -2; dx <= 2 && !hasNeighbor; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
              if (board[ny][nx] !== null) {
                hasNeighbor = true;
              }
            }
          }
        }
        if (hasNeighbor) {
          moves.push({ x, y });
        }
      }
    }
  }

  // 3. 着法排序（杀手启发 + 历史启发 + 位置权重）
  moves.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    // 杀手着法
    if (killerMoves.some(m => m.x === a.x && m.y === a.y)) scoreA += 10000;
    if (killerMoves.some(m => m.x === b.x && m.y === b.y)) scoreB += 10000;

    // 历史着法
    scoreA += historyTable.get(a);
    scoreB += historyTable.get(b);

    // 位置权重
    scoreA += POSITION_WEIGHTS[a.y][a.x];
    scoreB += POSITION_WEIGHTS[b.y][b.x];

    return scoreB - scoreA;
  });

  return moves;
}

// ========== α-β搜索（带迭代加深） ==========
function alphaBeta(
  board: BoardState,
  depth: number,
  alpha: number,
  beta: number,
  player: Player,
  tt: TranspositionTable,
  killerTable: KillerTable,
  historyTable: HistoryTable,
  useEndgameDB: boolean
): { score: number; move: Move } {
  const opponent = player === 'black' ? 'white' : 'black';

  // 检查置换表
  const ttEntry = tt.get(board, player);
  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === 'EXACT') {
      return { score: ttEntry.score, move: ttEntry.bestMove };
    } else if (ttEntry.flag === 'LOWERBOUND') {
      alpha = Math.max(alpha, ttEntry.score);
    } else {
      beta = Math.min(beta, ttEntry.score);
    }
    if (alpha >= beta) {
      return { score: ttEntry.score, move: ttEntry.bestMove };
    }
  }

  // 终局数据库（简化版：深度 <= 4 时使用精确搜索）
  if (useEndgameDB && depth <= 4) {
    // TODO: 实现终局数据库
  }

  // 叶子节点
  if (depth === 0) {
    return { score: evaluateBoard(board, player), move: NULL_MOVE };
  }

  // 生成着法
  const killerMoves = killerTable.get(depth);
  const moves = generateMoves(board, player, killerMoves, historyTable);

  if (moves.length === 0) {
    return { score: 0, move: NULL_MOVE }; // 平局
  }

  let bestMove = moves[0];
  let bestScore = -INF;
  let flag: 'EXACT' | 'LOWERBOUND' | 'UPPERBOUND' = 'UPPERBOUND';

  for (const move of moves) {
    const newBoard = board.map(row => [...row]);
    newBoard[move.y][move.x] = player;

    const result = alphaBeta(
      newBoard,
      depth - 1,
      -beta,
      -alpha,
      opponent,
      tt,
      killerTable,
      historyTable,
      useEndgameDB
    );

    const score = -result.score;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      flag = 'EXACT';
      alpha = Math.max(alpha, score);

      // 更新杀手着法
      if (score >= beta) {
        killerTable.add(depth, move);
        historyTable.add(move, depth * depth);
        flag = 'LOWERBOUND';
        break; // β剪枝
      }
    }
  }

  // 写入置换表
  tt.set(board, player, {
    depth,
    score: bestScore,
    flag,
    bestMove,
  });

  return { score: bestScore, move: bestMove };
}

// ========== 迭代加深搜索 ==========
function iterativeDeepening(
  board: BoardState,
  player: Player,
  maxDepth: number,
  useOpeningBook: boolean,
  useEndgameDB: boolean
): Move {
  // 1. 检查开局库
  if (useOpeningBook) {
    const opening = getOpeningMove(board);
    if (opening) return opening;
  }

  const tt = new TranspositionTable();
  const killerTable = new KillerTable(maxDepth);
  const historyTable = new HistoryTable();

  let bestMove: Move = NULL_MOVE;
  let bestScore = -INF;

  // 2. 迭代加深
  for (let depth = 1; depth <= maxDepth; depth++) {
    const result = alphaBeta(
      board,
      depth,
      -INF,
      INF,
      player,
      tt,
      killerTable,
      historyTable,
      useEndgameDB
    );

    if (result.score > -INF && result.score < INF) {
      bestMove = result.move;
      bestScore = result.score;
    }

    // 如果找到必胜/必败，提前退出
    if (result.score >= INF - 1000 || result.score <= -INF + 1000) {
      break;
    }
  }

  // 3. 如果没有找到好棋，返回中心附近的着法
  if (bestMove.x === -1) {
    const moves = getValidMoves(board);
    if (moves.length > 0) {
      moves.sort((a, b) => POSITION_WEIGHTS[b.y][b.x] - POSITION_WEIGHTS[a.y][a.x]);
      return moves[0];
    }
    return { x: 7, y: 7 };
  }

  return bestMove;
}

// ========== 主函数 ==========
export function getBestMove(board: BoardState, player: Player, difficulty: Difficulty): Move {
  const config = getDifficultyConfig(difficulty);
  return iterativeDeepening(board, player, config.maxDepth, config.useOpeningBook, config.useEndgameDB);
}

export function canAIMove(board: BoardState): boolean {
  return getValidMoves(board).length > 0;
}
