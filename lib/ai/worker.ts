// AI Web Worker - 后台运行 AI 计算
import { getBestMove, type Difficulty } from './rapfi-engine';
import type { BoardState, Player } from '../game';

// Worker 消息类型
interface WorkerMessage {
  type: 'GET_BEST_MOVE';
  board: BoardState;
  player: Player;
  difficulty: Difficulty;
}

interface WorkerResponse {
  type: 'BEST_MOVE';
  move: { x: number; y: number } | null;
}

// 监听主线程消息
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, board, player, difficulty } = e.data;

  if (type === 'GET_BEST_MOVE') {
    try {
      const move = getBestMove(board, player, difficulty);
      
      const response: WorkerResponse = {
        type: 'BEST_MOVE',
        move,
      };
      
      self.postMessage(response);
    } catch (error) {
      console.error('AI Worker error:', error);
      self.postMessage({ type: 'BEST_MOVE', move: null });
    }
  }
};

// 导出类型供 TypeScript 识别
export {};
