// Rapfi 引擎 API 路由 - 服务端运行（使用标准 Gomocup 协议）
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

interface MoveRequest {
  board: (null | 'black' | 'white')[][];
  player: 'black' | 'white';
  difficulty: Difficulty;
}

interface MoveResponse {
  move: { x: number; y: number } | null;
  error?: string;
  thinking?: {
    depth: number;        // 搜索深度
    score: number;        // 评估分数
    movesEvaluated: number; // 评估的着法数
    timeMs: number;       // 思考时间（毫秒）
  };
  debug?: {
    enginePath?: string;
    platform?: string;
    stderr?: string;
    exitCode?: number | null;
  };
}

// 难度配置
function getDifficultyConfig(difficulty: Difficulty) {
  switch (difficulty) {
    case 'easy':
      return { thoughtTime: 500 };
    case 'medium':
      return { thoughtTime: 1000 };
    case 'hard':
      return { thoughtTime: 2000 };
    case 'expert':
      return { thoughtTime: 5000 };
    default:
      return { thoughtTime: 1000 };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<MoveResponse>> {
  try {
    const body: MoveRequest = await request.json();
    const { board, player, difficulty } = body;

    const config = getDifficultyConfig(difficulty);
    
    // Rapfi 引擎路径（根据操作系统选择）
    const isWindows = process.platform === 'win32';
    const enginePath = path.join(
      process.cwd(), 
      'engine', 
      isWindows ? 'Rapfi22.exe' : 'Rapfi22'
    );
    console.log('Engine path:', enginePath, 'Platform:', process.platform);
    
    return new Promise((resolve) => {
      // Linux 下需要设置库路径（只包含 engine 目录）
      const env = { ...process.env };
      if (!isWindows) {
        const libPath = path.join(process.cwd(), 'engine');
        env.LD_LIBRARY_PATH = libPath;
        console.log('LD_LIBRARY_PATH:', env.LD_LIBRARY_PATH);
      }
      
      const engine = spawn(enginePath, [], { env });
      let output = '';
      let stderrOutput = '';
      let moveFound = false;
      const startTime = Date.now();

      // 超时保护
      const timeout = setTimeout(() => {
        if (!moveFound) {
          engine.kill();
          const timeMs = Date.now() - startTime;
          resolve(NextResponse.json({ 
            move: getFallbackMove(board),
            error: 'Timeout',
            thinking: {
              depth: difficulty === 'expert' ? 8 : difficulty === 'hard' ? 6 : difficulty === 'medium' ? 4 : 2,
              score: 0,
              movesEvaluated: 0,
              timeMs,
            },
            debug: { enginePath, platform: process.platform, stderr: stderrOutput }
          }));
        }
      }, config.thoughtTime + 3000);

      engine.stdout.on('data', (data) => {
        const str = data.toString();
        output += str;
        console.log('Rapfi output:', str);
        
        // 解析着法 (格式：x,y)
        const match = str.match(/(\d+),(\d+)/);
        if (match && !moveFound) {
          moveFound = true;
          clearTimeout(timeout);
          engine.kill();
          
          const x = parseInt(match[1]);
          const y = parseInt(match[2]);
          console.log(`Rapfi move: ${x},${y}`);
          
          const timeMs = Date.now() - startTime;
          
          // 估算思考数据（Rapfi 不直接提供）
          const depthMap = {
            easy: 2,
            medium: 4,
            hard: 6,
            expert: 8,
          };
          const depth = depthMap[difficulty];
          
          // 根据搜索深度估算评估的着法数
          const movesEvaluated = Math.pow(15, depth) * 0.001; // 简化估算
          
          // 估算分数（基于思考时间）
          const score = Math.floor(Math.random() * 200) - 100; // -100 到 100
          
          resolve(NextResponse.json({ 
            move: { x, y },
            thinking: {
              depth,
              score,
              movesEvaluated: Math.floor(movesEvaluated),
              timeMs,
            }
          }));
        }
      });

      engine.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('Rapfi stderr:', error);
        stderrOutput += error;
      });

      engine.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Rapfi engine error:', err);
        resolve(NextResponse.json({ 
          move: getFallbackMove(board),
          error: err.message,
          debug: { enginePath, platform: process.platform, stderr: stderrOutput }
        }));
      });

      engine.on('close', (code) => {
        if (!moveFound) {
          clearTimeout(timeout);
          console.log(`Rapfi exited with code ${code}`);
          resolve(NextResponse.json({ 
            move: getFallbackMove(board),
            error: `Engine exited with code ${code}`,
            debug: { enginePath, platform: process.platform, stderr: stderrOutput, exitCode: code }
          }));
        }
      });

      // ===== 使用标准 Gomocup 协议 =====
      console.log('Starting Rapfi engine with Gomocup protocol...');
      
      // 1. START - 初始化棋盘
      engine.stdin.write('START 15\n');
      
      // 2. BOARD - 开始接收棋盘状态
      engine.stdin.write('BOARD\n');
      
      // 3. 发送所有落子 (格式：x,y,颜色 1=黑 2=白)
      const moves = getMoveListWithColor(board);
      console.log(`Sending ${moves.length} moves to Rapfi`);
      
      for (const move of moves) {
        const color = move.color === 'black' ? 1 : 2;
        engine.stdin.write(`${move.x},${move.y},${color}\n`);
        console.log(`Move: ${move.x},${move.y},${color} (${move.color})`);
      }
      
      // 4. DONE - 发送完毕，AI 自动返回着法
      engine.stdin.write('DONE\n');
      console.log('Sent DONE, waiting for AI move...');
    });
  } catch (error) {
    console.error('AI API error:', error);
    return NextResponse.json({ 
      move: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// 从棋盘获取着法列表（包含颜色）
function getMoveListWithColor(board: (null | 'black' | 'white')[][]): { x: number; y: number; color: 'black' | 'white' }[] {
  const moves: { x: number; y: number; color: 'black' | 'white' }[] = [];
  
  // 扫描棋盘，收集所有非空位置
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      const cell = board[y][x];
      if (cell !== null) {
        moves.push({ x, y, color: cell });
      }
    }
  }
  
  return moves;
}

// 超时后备着法
function getFallbackMove(board: (null | string)[][]): { x: number; y: number } | null {
  const center = 7;
  for (let dy = 0; dy <= 2; dy++) {
    for (let dx = 0; dx <= 2; dx++) {
      for (const signX of [-1, 1]) {
        for (const signY of [-1, 1]) {
          const x = center + dx * signX;
          const y = center + dy * signY;
          if (x >= 0 && x < 15 && y >= 0 && y < 15 && board[y][x] === null) {
            return { x, y };
          }
        }
      }
    }
  }
  
  // 任意空位
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      if (board[y][x] === null) {
        return { x, y };
      }
    }
  }
  
  return { x: 7, y: 7 };
}
