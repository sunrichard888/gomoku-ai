// 游戏状态枚举
export type Player = 'black' | 'white';
export type CellState = null | Player;
export type BoardState = CellState[][];

export interface GameState {
  board: BoardState;
  currentPlayer: Player;
  winner: Player | 'draw' | null;
  winningLine: [number, number][] | null;
  lastMove: [number, number] | null;
  history: BoardState[];
}

export interface Move {
  x: number;
  y: number;
}

// 棋盘大小
export const BOARD_SIZE = 15;

// 创建空棋盘
export function createEmptyBoard(): BoardState {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
}

// 创建初始游戏状态
export function createInitialState(): GameState {
  return {
    board: createEmptyBoard(),
    currentPlayer: 'black',
    winner: null,
    winningLine: null,
    lastMove: null,
    history: [],
  };
}

// 检查位置是否有效
export function isValidMove(board: BoardState, x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE && board[y][x] === null;
}

// 落子
export function makeMove(state: GameState, x: number, y: number): GameState {
  if (!isValidMove(state.board, x, y)) {
    return state;
  }

  const newBoard = state.board.map(row => [...row]);
  newBoard[y][x] = state.currentPlayer;

  const newHistory = [...state.history, state.board.map(row => [...row])];

  const winInfo = checkWin(newBoard, x, y, state.currentPlayer);

  return {
    board: newBoard,
    currentPlayer: state.currentPlayer === 'black' ? 'white' : 'black',
    winner: winInfo.winner,
    winningLine: winInfo.line,
    lastMove: [x, y],
    history: newHistory,
  };
}

// 悔棋
export function undoMove(state: GameState): GameState {
  if (state.history.length === 0) {
    return state;
  }

  const previousBoard = state.history[state.history.length - 1];
  
  // 找到最后一步的位置
  let lastMove: [number, number] | null = null;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (previousBoard[y][x] !== state.board[y][x]) {
        lastMove = [x, y];
        break;
      }
    }
    if (lastMove) break;
  }

  return {
    board: previousBoard,
    currentPlayer: state.currentPlayer === 'black' ? 'white' : 'black',
    winner: null,
    winningLine: null,
    lastMove: state.history.length > 1 ? lastMove : null,
    history: state.history.slice(0, -1),
  };
}

// 检查胜利
interface WinInfo {
  winner: Player | null;
  line: [number, number][] | null;
}

export function checkWin(board: BoardState, x: number, y: number, player: Player): WinInfo {
  const directions = [
    [1, 0],   // 水平
    [0, 1],   // 垂直
    [1, 1],   // 对角线 \
    [1, -1],  // 对角线 /
  ];

  for (const [dx, dy] of directions) {
    const line: [number, number][] = [[x, y]];
    
    // 向一个方向检查
    let i = 1;
    while (true) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE || board[ny][nx] !== player) {
        break;
      }
      line.push([nx, ny]);
      i++;
    }
    
    // 向相反方向检查
    i = 1;
    while (true) {
      const nx = x - dx * i;
      const ny = y - dy * i;
      if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE || board[ny][nx] !== player) {
        break;
      }
      line.push([nx, ny]);
      i++;
    }

    if (line.length >= 5) {
      return { winner: player, line };
    }
  }

  return { winner: null, line: null };
}

// 检查平局
export function checkDraw(board: BoardState): boolean {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === null) {
        return false;
      }
    }
  }
  return true;
}

// 获取所有合法移动
export function getValidMoves(board: BoardState): Move[] {
  const moves: Move[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === null) {
        moves.push({ x, y });
      }
    }
  }
  return moves;
}

// ==================== 战绩统计系统 ====================

export interface GameStats {
  totalGames: number;      // 总局数
  wins: number;            // 胜场
  losses: number;          // 负场
  draws: number;           // 平局
  winStreak: number;       // 当前连胜
  maxWinStreak: number;    // 最大连胜
  byDifficulty: {          // 按难度统计
    easy: { wins: number; losses: number; draws: number };
    medium: { wins: number; losses: number; draws: number };
    hard: { wins: number; losses: number; draws: number };
    expert: { wins: number; losses: number; draws: number };
  };
  lastUpdated: number;     // 最后更新时间戳
}

export const STATS_STORAGE_KEY = 'gomoku-stats';

// 创建初始战绩数据
export function createInitialStats(): GameStats {
  return {
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winStreak: 0,
    maxWinStreak: 0,
    byDifficulty: {
      easy: { wins: 0, losses: 0, draws: 0 },
      medium: { wins: 0, losses: 0, draws: 0 },
      hard: { wins: 0, losses: 0, draws: 0 },
      expert: { wins: 0, losses: 0, draws: 0 },
    },
    lastUpdated: Date.now(),
  };
}

// 从 localStorage 加载战绩
export function loadStats(): GameStats {
  // 服务端渲染时不访问 localStorage
  if (typeof window === 'undefined') {
    return createInitialStats();
  }
  
  try {
    const saved = localStorage.getItem(STATS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 验证数据结构
      if (parsed.totalGames !== undefined) {
        return { ...createInitialStats(), ...parsed };
      }
    }
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
  return createInitialStats();
}

// 保存战绩到 localStorage
export function saveStats(stats: GameStats): void {
  // 服务端渲染时不访问 localStorage
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Failed to save stats:', error);
  }
}

// 记录游戏结果
export function recordGameResult(
  stats: GameStats,
  result: 'win' | 'loss' | 'draw',
  difficulty: string
): GameStats {
  const newStats: GameStats = {
    ...stats,
    totalGames: stats.totalGames + 1,
    lastUpdated: Date.now(),
  };

  // 更新胜负平统计
  if (result === 'win') {
    newStats.wins += 1;
    newStats.winStreak += 1;
    newStats.maxWinStreak = Math.max(newStats.maxWinStreak, newStats.winStreak);
  } else if (result === 'loss') {
    newStats.losses += 1;
    newStats.winStreak = 0;
  } else {
    newStats.draws += 1;
    newStats.winStreak = 0;
  }

  // 更新按难度统计
  const diffKey = difficulty as keyof typeof newStats.byDifficulty;
  if (newStats.byDifficulty[diffKey]) {
    if (result === 'win') {
      newStats.byDifficulty[diffKey].wins += 1;
    } else if (result === 'loss') {
      newStats.byDifficulty[diffKey].losses += 1;
    } else {
      newStats.byDifficulty[diffKey].draws += 1;
    }
  }

  return newStats;
}

// 计算胜率
export function calculateWinRate(stats: GameStats): string {
  if (stats.totalGames === 0) return '0.0';
  const rate = (stats.wins / stats.totalGames) * 100;
  return rate.toFixed(1);
}
