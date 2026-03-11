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

// ========== 难度配置（增强版） ==========
export function getDifficultyConfig(difficulty: Difficulty) {
  switch (difficulty) {
    case 'easy':
      return { simulations: 100, exploration: 2.0, useVCF: true, useTT: true, vcfDepth: 8 };
    case 'medium':
      return { simulations: 800, exploration: 1.5, useVCF: true, useTT: true, vcfDepth: 10 };
    case 'hard':
      return { simulations: 1500, exploration: 1.0, useVCF: true, useTT: true, vcfDepth: 13 };
    case 'expert':
      return { simulations: 3000, exploration: 0.8, useVCF: true, useTT: true, vcfDepth: 15 };
    default:
      return { simulations: 800, exploration: 1.5, useVCF: true, useTT: true, vcfDepth: 10 };
  }
}

// ========== 棋型权重（增强版） ==========
const PATTERNS = {
  FIVE: 10000000,
  OPEN_FOUR: 1000000,
  CLOSED_FOUR: 100000,
  OPEN_THREE: 10000,
  CLOSED_THREE: 1000,
  OPEN_TWO: 200,
  CENTER: 50,
};

// 组合棋型权重（杀法识别）
const COMBO_PATTERNS = {
  DOUBLE_THREE: 50000,    // 双三杀
  FOUR_THREE: 100000,     // 四三杀
  DOUBLE_FOUR: 200000,    // 双四杀
  THREE_THREE: 30000,     // 三三（禁手检测用）
};

// ========== 开局库 ==========
const OPENING_BOOK: Record<string, Move> = {
  '': { x: 7, y: 7 },
  '7,7': { x: 8, y: 8 },
  '7,7-8,8': { x: 6, y: 6 },
  '7,7-8,7': { x: 7, y: 8 },
  '7,7-7,8': { x: 8, y: 7 },
};

// ========== VCF/VCT 搜索（增强版） ==========
interface VCFCache {
  key: string;
  result: Move | null;
  depth: number;
}

class VCFCacheManager {
  private cache: Map<string, VCFCache> = new Map();
  
  private hash(board: BoardState, player: Player): string {
    let hash = `${player}:`;
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        hash += board[y][x] === null ? '0' : board[y][x] === 'black' ? '1' : '2';
      }
    }
    return hash;
  }
  
  get(board: BoardState, player: Player): Move | null {
    const key = this.hash(board, player);
    const entry = this.cache.get(key);
    return entry ? entry.result : null;
  }
  
  set(board: BoardState, player: Player, move: Move | null, depth: number): void {
    const key = this.hash(board, player);
    this.cache.set(key, { key, result: move, depth });
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// 强制着法生成（只考虑冲四、活三、连五）
function generateForcedMoves(board: BoardState, player: Player): Move[] {
  const forced: Move[] = [];
  const moves = getValidMoves(board);
  
  for (const move of moves) {
    const testBoard = board.map(row => [...row]);
    testBoard[move.y][move.x] = player;
    
    // 连五 - 最高优先级
    if (checkWin(testBoard, move.x, move.y, player).winner) {
      return [move]; // 直接返回，这是必胜
    }
    
    const patterns = getAllPatterns(testBoard, move.x, move.y, player);
    
    // 活四 - 对方必须防
    if (patterns.includes('OPEN_FOUR')) {
      forced.unshift(move);
    }
    // 冲四 - 对方必须防
    else if (patterns.includes('CLOSED_FOUR')) {
      forced.push(move);
    }
    // 活三 - 可能形成进攻
    else if (patterns.includes('OPEN_THREE')) {
      forced.push(move);
    }
  }
  
  return forced;
}

// 防守着法生成（防对方的冲四、活三）
function generateDefenseMoves(board: BoardState, player: Player, opponent: Player): Move[] {
  const defense: Move[] = [];
  const opponentForced = generateForcedMoves(board, opponent);
  
  if (opponentForced.length > 0) {
    // 对方有进攻，必须防守
    return opponentForced;
  }
  
  // 没有直接威胁，返回所有合法着法（后续会剪枝）
  return getValidMoves(board);
}

// VCF/VCT 主搜索函数
function searchVCF(board: BoardState, player: Player, depth: number = 15): Move | null {
  const cache = new VCFCacheManager();
  
  function search(
    currentBoard: BoardState,
    currentPlayer: Player,
    currentDepth: number,
    isAttacking: boolean
  ): Move | null {
    const cacheKey = `${currentPlayer}:${currentDepth}:${isAttacking}`;
    const cached = cache.get(currentBoard, currentPlayer);
    if (cached && cached.depth >= currentDepth) {
      return cached.result;
    }
    
    if (currentDepth <= 0) {
      return null;
    }
    
    const opponent = currentPlayer === 'black' ? 'white' : 'black';
    
    if (isAttacking) {
      // 进攻方：寻找连续进攻直到胜利
      const attackingMoves = generateForcedMoves(currentBoard, currentPlayer);
      
      for (const move of attackingMoves) {
        const testBoard = currentBoard.map(row => [...row]);
        testBoard[move.y][move.x] = currentPlayer;
        
        // 检查是否直接获胜
        if (checkWin(testBoard, move.x, move.y, currentPlayer).winner) {
          cache.set(currentBoard, currentPlayer, move, currentDepth);
          return move;
        }
        
        // 检查是否形成 VCF 局面（连续冲四）
        const patterns = getAllPatterns(testBoard, move.x, move.y, currentPlayer);
        if (patterns.includes('OPEN_FOUR') || patterns.includes('CLOSED_FOUR')) {
          // 递归搜索对方的应对
          const response = search(testBoard, opponent, currentDepth - 1, false);
          if (response === null) {
            // 对方无法防守，这步是好棋
            cache.set(currentBoard, currentPlayer, move, currentDepth);
            return move;
          }
        }
        
        // 检查是否形成活三（VCT 基础）
        if (patterns.includes('OPEN_THREE')) {
          const response = search(testBoard, opponent, currentDepth - 2, false);
          if (response === null) {
            cache.set(currentBoard, currentPlayer, move, currentDepth);
            return move;
          }
        }
      }
      
      // 没有直接 VCF，尝试 VCT（连续进攻）
      for (const move of attackingMoves.slice(0, 20)) {
        const testBoard = currentBoard.map(row => [...row]);
        testBoard[move.y][move.x] = currentPlayer;
        
        const patterns = getAllPatterns(testBoard, move.x, move.y, currentPlayer);
        if (patterns.length > 0) {
          const response = search(testBoard, opponent, currentDepth - 2, false);
          if (response === null) {
            cache.set(currentBoard, currentPlayer, move, currentDepth);
            return move;
          }
        }
      }
    } else {
      // 防守方：尝试所有防守着法
      const defenseMoves = generateDefenseMoves(currentBoard, currentPlayer, opponent);
      
      for (const move of defenseMoves.slice(0, 30)) {
        const testBoard = currentBoard.map(row => [...row]);
        testBoard[move.y][move.x] = currentPlayer;
        
        // 如果这步能反杀
        if (checkWin(testBoard, move.x, move.y, currentPlayer).winner) {
          return move;
        }
        
        // 检查是否能形成反威胁
        const patterns = getAllPatterns(testBoard, move.x, move.y, currentPlayer);
        if (patterns.includes('OPEN_FOUR') || patterns.includes('CLOSED_FOUR')) {
          // 有反威胁，对方必须应
          const response = search(testBoard, opponent, currentDepth - 1, true);
          if (response === null) {
            return move; // 成功防守
          }
        }
      }
      
      // 没有好的防守，返回 null 表示无法防守
      if (defenseMoves.length === 0 || !defenseMoves.some(m => {
        const testBoard = currentBoard.map(row => [...row]);
        testBoard[m.y][m.x] = currentPlayer;
        const response = search(testBoard, opponent, currentDepth - 1, true);
        return response === null;
      })) {
        return null;
      }
    }
    
    return null;
  }
  
  return search(board, player, depth, true);
}

// ========== 威胁检测（增强版） ==========
interface Threat {
  move: Move;
  type: 'FIVE' | 'OPEN_FOUR' | 'CLOSED_FOUR' | 'OPEN_THREE' | 'DOUBLE_THREE' | 'FOUR_THREE';
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
    
    // 检测组合杀法
    const hasOpenFour = patterns.includes('OPEN_FOUR');
    const hasClosedFour = patterns.includes('CLOSED_FOUR');
    const hasOpenThree = patterns.includes('OPEN_THREE');
    const hasClosedThree = patterns.includes('CLOSED_THREE');
    
    // 四三杀
    if ((hasOpenFour || hasClosedFour) && (hasOpenThree || hasClosedThree)) {
      threats.push({ move, type: 'FOUR_THREE', priority: 95 });
      continue;
    }
    
    // 双三杀
    const threeCount = [hasOpenThree, hasClosedThree].filter(Boolean).length;
    if (threeCount >= 2) {
      threats.push({ move, type: 'DOUBLE_THREE', priority: 85 });
      continue;
    }
    
    // 单个棋型
    if (hasOpenFour) {
      threats.push({ move, type: 'OPEN_FOUR', priority: 90 });
    } else if (hasClosedFour) {
      threats.push({ move, type: 'CLOSED_FOUR', priority: 80 });
    } else if (hasOpenThree) {
      threats.push({ move, type: 'OPEN_THREE', priority: 70 });
    }
  }

  return threats.sort((a, b) => b.priority - a.priority);
}

// ========== 组合棋型检测 ==========
function detectComboPatterns(board: BoardState, player: Player): number {
  let comboScore = 0;
  
  // 检查双三
  const moves = getValidMoves(board);
  for (const move of moves) {
    const testBoard = board.map(row => [...row]);
    testBoard[move.y][move.x] = player;
    
    const patterns = getAllPatterns(testBoard, move.x, move.y, player);
    const threeCount = patterns.filter(p => p.includes('THREE')).length;
    const fourCount = patterns.filter(p => p.includes('FOUR')).length;
    
    if (threeCount >= 2) {
      comboScore += COMBO_PATTERNS.DOUBLE_THREE;
    }
    if (threeCount >= 1 && fourCount >= 1) {
      comboScore += COMBO_PATTERNS.FOUR_THREE;
    }
    if (fourCount >= 2) {
      comboScore += COMBO_PATTERNS.DOUBLE_FOUR;
    }
  }
  
  return comboScore;
}

// ========== 空间控制评估 ==========
function evaluateSpaceControl(board: BoardState, player: Player): number {
  let score = 0;
  const opponent = player === 'black' ? 'white' : 'black';
  
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== player) continue;
      
      // 计算周围空位数量
      let emptyNeighbors = 0;
      let playerNeighbors = 0;
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
            if (board[ny][nx] === null) emptyNeighbors++;
            else if (board[ny][nx] === player) playerNeighbors++;
          }
        }
      }
      
      // 空位多表示发展空间好
      score += emptyNeighbors * 5;
      // 连接度高表示棋型好
      score += playerNeighbors * 10;
    }
  }
  
  return score;
}

// ========== 棋型连接度评估 ==========
function evaluateConnectivity(board: BoardState, player: Player): number {
  let score = 0;
  
  // 检查玩家的棋子是否形成有效连接
  const playerPieces: [number, number][] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === player) {
        playerPieces.push([x, y]);
      }
    }
  }
  
  // 计算棋子间的距离和连接
  for (let i = 0; i < playerPieces.length; i++) {
    for (let j = i + 1; j < playerPieces.length; j++) {
      const [x1, y1] = playerPieces[i];
      const [x2, y2] = playerPieces[j];
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      
      // 相邻或间隔一个位置有加分
      if (dx <= 2 && dy <= 2) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        score += Math.floor(20 / (distance + 1));
      }
    }
  }
  
  return score;
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

// ========== 评估函数（增强版） ==========
export function evaluateBoard(board: BoardState, player: Player): number {
  let score = 0;
  const opponent = player === 'black' ? 'white' : 'black';

  // 1. 基础棋型评估
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

  // 2. 组合棋型加分（杀法识别）
  const playerCombo = detectComboPatterns(board, player);
  const opponentCombo = detectComboPatterns(board, opponent);
  score += playerCombo - opponentCombo * 1.2;

  // 3. 空间控制评估
  const playerSpace = evaluateSpaceControl(board, player);
  const opponentSpace = evaluateSpaceControl(board, opponent);
  score += (playerSpace - opponentSpace) * 0.5;

  // 4. 连接度评估
  const playerConnect = evaluateConnectivity(board, player);
  const opponentConnect = evaluateConnectivity(board, opponent);
  score += (playerConnect - opponentConnect) * 0.3;

  // 5. 先手优势（如果是黑棋）
  if (player === 'black') {
    score += 50;
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
  useTT: boolean,
  vcfDepth: number = 12
): Move {
  const tt = useTT ? new TranspositionTable() : null;
  const root = new MCTSNode(board, player);

  // 1. 检查 VCF/VCT（连续进攻）
  if (useVCF) {
    const vcfMove = searchVCF(board, player, vcfDepth);
    if (vcfMove) return vcfMove;

    // 2. 检查对方是否有 VCF，需要防守
    const opponent = player === 'black' ? 'white' : 'black';
    const opponentVCF = searchVCF(board, opponent, vcfDepth);
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
  return mctsSearch(
    board,
    player,
    config.simulations,
    config.exploration,
    config.useVCF,
    config.useTT,
    config.vcfDepth
  );
}

export function canAIMove(board: BoardState): boolean {
  return getValidMoves(board).length > 0;
}
