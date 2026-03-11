// Gomoku AI - Minimax with Alpha-Beta Pruning
import type { BoardState, Player, Move } from '../game';
import { BOARD_SIZE, isValidMove, makeMove, checkWin } from '../game';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface AIConfig {
  difficulty: Difficulty;
  maxDepth: number;
  usePruning: boolean;
}

// 获取难度配置
export function getDifficultyConfig(difficulty: Difficulty): AIConfig {
  switch (difficulty) {
    case 'easy':
      return { difficulty, maxDepth: 2, usePruning: true };
    case 'medium':
      return { difficulty, maxDepth: 4, usePruning: true };
    case 'hard':
      return { difficulty, maxDepth: 6, usePruning: true };
    case 'expert':
      return { difficulty, maxDepth: 8, usePruning: true };
    default:
      return { difficulty: 'medium', maxDepth: 4, usePruning: true };
  }
}

// 评估函数权重
const WEIGHTS = {
  FIVE: 100000,      // 连五
  OPEN_FOUR: 10000,  // 活四
  CLOSED_FOUR: 1000, // 冲四
  OPEN_THREE: 500,   // 活三
  CLOSED_THREE: 100, // 眠三
  OPEN_TWO: 50,      // 活二
};

// 评估棋盘局面
export function evaluateBoard(board: BoardState, aiPlayer: Player): number {
  let score = 0;

  // 评估所有方向的棋型
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = board[y][x];
      if (cell === null) continue;

      const isAI = cell === aiPlayer;

      for (const [dx, dy] of directions) {
        const pattern = evaluatePattern(board, x, y, dx, dy, cell);
        const weight = getPatternWeight(pattern);
        score += isAI ? weight : -weight;
      }
    }
  }

  return score;
}

// 评估某个位置的棋型
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

  // 向正方向检查
  let i = 1;
  while (true) {
    const nx = x + dx * i;
    const ny = y + dy * i;
    if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) {
      break;
    }
    if (board[ny][nx] === player) {
      count++;
    } else {
      if (board[ny][nx] === null) {
        openEnds++;
      }
      break;
    }
    i++;
  }

  // 向反方向检查
  i = 1;
  while (true) {
    const nx = x - dx * i;
    const ny = y - dy * i;
    if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) {
      break;
    }
    if (board[ny][nx] === player) {
      count++;
    } else {
      if (board[ny][nx] === null) {
        openEnds++;
      }
      break;
    }
    i++;
  }

  // 返回棋型
  if (count >= 5) return 'FIVE';
  if (count === 4 && openEnds === 2) return 'OPEN_FOUR';
  if (count === 4 && openEnds === 1) return 'CLOSED_FOUR';
  if (count === 3 && openEnds === 2) return 'OPEN_THREE';
  if (count === 3 && openEnds === 1) return 'CLOSED_THREE';
  if (count === 2 && openEnds === 2) return 'OPEN_TWO';
  return 'NONE';
}

// 获取棋型权重
function getPatternWeight(pattern: string): number {
  return WEIGHTS[pattern as keyof typeof WEIGHTS] || 0;
}

// Minimax with Alpha-Beta Pruning
function minimax(
  board: BoardState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  aiPlayer: Player
): number {
  // 检查游戏是否结束
  const moves = getValidMovesNearLastMove(board, 2);
  if (moves.length === 0) {
    return 0; // 平局
  }

  // 检查是否有胜利
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== null) {
        const winInfo = checkWin(board, x, y, board[y][x]!);
        if (winInfo.winner) {
          return winInfo.winner === aiPlayer ? 100000 : -100000;
        }
      }
    }
  }

  // 深度限制
  if (depth === 0) {
    return evaluateBoard(board, aiPlayer);
  }

  const current = isMaximizing ? aiPlayer : (aiPlayer === 'black' ? 'white' : 'black');

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const newBoard = simulateMove(board, move.x, move.y, current);
      const evalScore = minimax(newBoard, depth - 1, alpha, beta, false, aiPlayer);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break; // 剪枝
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const newBoard = simulateMove(board, move.x, move.y, current);
      const evalScore = minimax(newBoard, depth - 1, alpha, beta, true, aiPlayer);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break; // 剪枝
    }
    return minEval;
  }
}

// 模拟落子（不改变原棋盘）
function simulateMove(board: BoardState, x: number, y: number, player: Player): BoardState {
  const newBoard = board.map(row => [...row]);
  newBoard[y][x] = player;
  return newBoard;
}

// 获取最后一步附近的合法移动（优化搜索范围）
function getValidMovesNearLastMove(board: BoardState, radius: number): Move[] {
  const moves: Move[] = [];
  const center = findLastMove(board);

  if (!center) {
    // 第一步下在中心
    return [{ x: 7, y: 7 }];
  }

  const minX = Math.max(0, center.x - radius);
  const maxX = Math.min(BOARD_SIZE - 1, center.x + radius);
  const minY = Math.max(0, center.y - radius);
  const maxY = Math.min(BOARD_SIZE - 1, center.y + radius);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (board[y][x] === null) {
        moves.push({ x, y });
      }
    }
  }

  return moves;
}

// 找到最后一步的位置
function findLastMove(board: BoardState): { x: number; y: number } | null {
  let lastX = -1, lastY = -1;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== null) {
        lastX = x;
        lastY = y;
      }
    }
  }
  return lastX >= 0 ? { x: lastX, y: lastY } : null;
}

// AI 获取最佳移动
export function getBestMove(
  board: BoardState,
  aiPlayer: Player,
  difficulty: Difficulty
): Move | null {
  const config = getDifficultyConfig(difficulty);
  
  // 如果是第一步，下在中心
  const moves = getValidMovesNearLastMove(board, 2);
  if (moves.length === BOARD_SIZE * BOARD_SIZE) {
    return { x: 7, y: 7 };
  }

  let bestMove: Move | null = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  let beta = Infinity;

  // 随机打乱移动顺序，增加变化
  const shuffledMoves = moves.sort(() => Math.random() - 0.5);

  for (const move of shuffledMoves) {
    const newBoard = simulateMove(board, move.x, move.y, aiPlayer);
    const score = minimax(newBoard, config.maxDepth - 1, alpha, beta, false, aiPlayer);
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    
    alpha = Math.max(alpha, score);
  }

  return bestMove;
}

// 检查 AI 是否可以落子
export function canAIMove(board: BoardState): boolean {
  return getValidMovesNearLastMove(board, 2).length > 0;
}
