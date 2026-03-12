// Rapfi 引擎 API 路由 - 服务端运行
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
      // Linux 下使用系统库，不设置 LD_LIBRARY_PATH
      const engine = spawn(enginePath);
      let output = '';
      let stderrOutput = '';
      let moveFound = false;

      // 超时保护
      const timeout = setTimeout(() => {
        if (!moveFound) {
          engine.kill();
          resolve(NextResponse.json({ 
            move: getFallbackMove(board),
            error: 'Timeout',
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
          
          resolve(NextResponse.json({ move: { x, y } }));
        }
      });

      engine.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('Rapfi stderr:', error);
        stderrOutput += error;
        // 解析具体错误
        if (error.includes('No such file')) {
          console.error('Missing library:', error.match(/lib[a-zA-Z0-9_]+\.so[.0-9]*/));
        }
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

      // 发送初始化命令
      console.log('Starting Rapfi engine:', enginePath);
      engine.stdin.write('board 15\n');
      engine.stdin.write(`${player}\n`);
      
      // 发送当前局面
      const moves = getMoveList(board);
      console.log(`Sending ${moves.length} moves to Rapfi`);
      if (moves.length === 0) {
        // 空棋盘，下天元
        engine.stdin.write('turn 7,7\n');
      } else {
        // 发送着法序列
        for (const move of moves) {
          engine.stdin.write(`turn ${move.x},${move.y}\n`);
        }
      }
      
      // 请求 AI 着法
      setTimeout(() => {
        console.log('Requesting AI move...');
        engine.stdin.write('ai\n');
      }, 100);
    });
  } catch (error) {
    console.error('AI API error:', error);
    return NextResponse.json({ 
      move: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// 获取着法列表
function getMoveList(board: (null | string)[][]): { x: number; y: number }[] {
  const moves: { x: number; y: number }[] = [];
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      if (board[y][x] !== null) {
        moves.push({ x, y });
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
