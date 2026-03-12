// Rapfi 引擎封装层 - Gomocup 协议
// 需要下载 Rapfi22.exe: https://github.com/dhbloo/Rapfi-gomocup/releases
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import type { BoardState, Player, Move } from '../game';
import { BOARD_SIZE } from '../game';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

// 难度配置
export function getDifficultyConfig(difficulty: Difficulty) {
  switch (difficulty) {
    case 'easy':
      return { thoughtTime: 500, level: 1 };
    case 'medium':
      return { thoughtTime: 1000, level: 3 };
    case 'hard':
      return { thoughtTime: 2000, level: 5 };
    case 'expert':
      return { thoughtTime: 5000, level: 7 };
    default:
      return { thoughtTime: 1000, level: 3 };
  }
}

class RapfiEngine {
  private engine: ChildProcess | null = null;
  private board: BoardState;
  private player: Player;
  private resolveMove: ((move: Move) => void) | null = null;
  private buffer: string = '';

  constructor() {
    this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    this.player = 'black';
  }

  // 启动引擎
  async start(): Promise<void> {
    const enginePath = path.join(__dirname, '../../engine/Rapfi22.exe');
    
    return new Promise((resolve, reject) => {
      try {
        this.engine = spawn(enginePath);
        
        this.engine.stdout?.on('data', (data) => {
          this.handleOutput(data.toString());
        });

        this.engine.stderr?.on('data', (data) => {
          console.error('Rapfi stderr:', data.toString());
        });

        this.engine.on('error', (err) => {
          console.error('Rapfi engine error:', err);
          reject(err);
        });

        // 发送初始化命令
        this.sendCommand('board 15');
        this.sendCommand('black');
        
        // 等待引擎就绪
        setTimeout(() => resolve(), 500);
      } catch (error) {
        console.error('Failed to start Rapfi engine:', error);
        reject(error);
      }
    });
  }

  // 发送命令到引擎
  private sendCommand(cmd: string): void {
    if (this.engine?.stdin) {
      this.engine.stdin.write(cmd + '\n');
    }
  }

  // 处理引擎输出
  private handleOutput(output: string): void {
    this.buffer += output;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      
      // 解析着法响应 (格式：x,y)
      const moveMatch = trimmed.match(/^(\d+),(\d+)$/);
      if (moveMatch && this.resolveMove) {
        const x = parseInt(moveMatch[1]);
        const y = parseInt(moveMatch[2]);
        this.resolveMove({ x, y });
        this.resolveMove = null;
      }
    }
  }

  // 获取最佳着法
  async getBestMove(board: BoardState, player: Player, difficulty: Difficulty): Promise<Move> {
    const config = getDifficultyConfig(difficulty);
    
    // 同步棋盘状态
    this.syncBoard(board, player);
    
    return new Promise((resolve) => {
      this.resolveMove = resolve;
      
      // 发送当前局面
      const moves = this.getMoveList(board);
      if (moves.length === 0) {
        // 空棋盘，下天元
        this.sendCommand('turn 7,7');
        return;
      }
      
      // 发送着法序列
      for (const move of moves) {
        this.sendCommand(`turn ${move.x},${move.y}`);
      }
      
      // 请求 AI 着法
      setTimeout(() => {
        this.sendCommand('ai');
      }, 100);
      
      // 超时保护
      setTimeout(() => {
        if (this.resolveMove) {
          // 超时返回中心附近的着法
          const fallback = this.getFallbackMove(board);
          this.resolveMove(fallback);
          this.resolveMove = null;
        }
      }, config.thoughtTime + 2000);
    });
  }

  // 同步棋盘
  private syncBoard(board: BoardState, player: Player): void {
    this.board = board.map(row => [...row]);
    this.player = player;
  }

  // 获取着法列表
  private getMoveList(board: BoardState): Move[] {
    const moves: Move[] = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (board[y][x] !== null) {
          moves.push({ x, y });
        }
      }
    }
    return moves;
  }

  // 超时后备着法
  private getFallbackMove(board: BoardState): Move {
    // 找中心附近的空位
    const center = 7;
    for (let dy = 0; dy <= 2; dy++) {
      for (let dx = 0; dx <= 2; dx++) {
        for (const signX of [-1, 1]) {
          for (const signY of [-1, 1]) {
            const x = center + dx * signX;
            const y = center + dy * signY;
            if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE && board[y][x] === null) {
              return { x, y };
            }
          }
        }
      }
    }
    
    // 任意空位
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (board[y][x] === null) {
          return { x, y };
        }
      }
    }
    
    return { x: 7, y: 7 };
  }

  // 关闭引擎
  stop(): void {
    if (this.engine) {
      this.sendCommand('quit');
      this.engine.kill();
      this.engine = null;
    }
  }
}

// 单例模式
let engineInstance: RapfiEngine | null = null;

function getEngine(): RapfiEngine {
  if (!engineInstance) {
    engineInstance = new RapfiEngine();
  }
  return engineInstance;
}

// 主函数
export async function getBestMove(board: BoardState, player: Player, difficulty: Difficulty): Promise<Move> {
  try {
    const engine = getEngine();
    
    // 确保引擎已启动
    if (!engine['engine']) {
      await engine.start();
    }
    
    return await engine.getBestMove(board, player, difficulty);
  } catch (error) {
    console.error('Rapfi engine failed, falling back to built-in AI:', error);
    // 如果 Rapfi 失败，返回一个默认着法
    return { x: 7, y: 7 };
  }
}

export function canAIMove(board: BoardState): boolean {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === null) {
        return true;
      }
    }
  }
  return false;
}

// 清理函数
export function cleanup(): void {
  if (engineInstance) {
    engineInstance.stop();
    engineInstance = null;
  }
}
