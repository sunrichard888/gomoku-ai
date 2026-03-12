'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Board from '@/components/Board';
import { createInitialState, makeMove, undoMove, checkDraw } from '@/lib/game';
import type { GameState, Player } from '@/lib/game';
import type { Difficulty } from '@/lib/ai/engine';

export default function Home() {
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gameMode, setGameMode] = useState<'pve' | 'pvp'>('pve');
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // 使用 ref 跟踪上一步玩家，防止 AI 重复调用
  const lastPlayerRef = useRef<Player>('black');
  // 内置 AI Worker（作为 Rapfi 失败时的备用）
  const workerRef = useRef<Worker | null>(null);
  
  // 初始化备用 AI Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('@/lib/ai/worker.ts', import.meta.url));
    workerRef.current.onmessage = (e) => {
      const { move } = e.data;
      if (move) {
        setGameState(prev => makeMove(prev, move.x, move.y));
      }
      setIsAIThinking(false);
    };
    return () => workerRef.current?.terminate();
  }, []);

  // 检查游戏是否结束
  const isGameOver = gameState.winner !== null;
  const isDraw = checkDraw(gameState.board) && !gameState.winner;

  // 处理玩家落子
  const handleMove = useCallback((x: number, y: number) => {
    if (isGameOver || isAIThinking) return;
    
    // PvP 模式或玩家回合
    if (gameMode === 'pvp' || gameState.currentPlayer === 'black') {
      const newState = makeMove(gameState, x, y);
      if (newState !== gameState) {
        setGameState(newState);
      }
    }
  }, [gameState, gameMode, isGameOver, isAIThinking]);

  // AI 落子（使用 Rapfi API）
  useEffect(() => {
    const isWhiteTurn = gameState.currentPlayer === 'white';
    const wasBlackTurn = lastPlayerRef.current === 'black';
    
    console.log('AI Check:', { isWhiteTurn, wasBlackTurn, gameMode, isGameOver });
    
    // 只有当轮到白棋且上一步是黑棋时才调用 AI（防止重复调用）
    if (gameMode === 'pve' && isWhiteTurn && wasBlackTurn && !isGameOver) {
      // 更新上一步玩家
      lastPlayerRef.current = 'white';
      
      console.log('Calling Rapfi API...');
      setIsAIThinking(true);
      
      // 调用 Rapfi 引擎 API
      fetch('/api/ai/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board: gameState.board,
          player: 'white',
          difficulty,
        }),
      })
        .then(res => res.json())
        .then(data => {
          console.log('API response data:', data);
          if (data.move) {
            // 检查落子位置是否合法
            const isValid = gameState.board[data.move.y][data.move.x] === null;
            console.log('Move validation:', {
              x: data.move.x,
              y: data.move.y,
              isValid,
              cellValue: gameState.board[data.move.y][data.move.x]
            });
            
            if (!isValid) {
              // AI 返回了非法坐标，回退到内置引擎
              console.warn('Rapfi returned invalid move, falling back to built-in AI');
              // 使用 Web Worker 调用内置 AI
              workerRef.current?.postMessage({
                type: 'GET_BEST_MOVE',
                board: gameState.board,
                player: 'white',
                difficulty,
              });
              return;
            }
            
            // 使用函数式更新，确保使用最新状态
            setGameState(prev => {
              const newState = makeMove(prev, data.move.x, data.move.y);
              console.log('New game state:', {
                currentPlayer: newState.currentPlayer,
                isChanged: newState !== prev,
                lastMove: newState.lastMove
              });
              return newState;
            });
          } else {
            console.error('No move from API:', data.error);
          }
        })
        .catch(err => {
          console.error('AI API error:', err);
        })
        .finally(() => {
          setIsAIThinking(false);
        });
    } else if (!isWhiteTurn) {
      // 如果不是白棋回合，重置标记
      lastPlayerRef.current = gameState.currentPlayer;
    }
  }, [gameState.currentPlayer, gameMode, difficulty, isGameOver]);

  // 悔棋
  const handleUndo = useCallback(() => {
    if (gameMode === 'pve' && !isGameOver) {
      // PvE 模式悔两步（玩家和 AI 各一步）
      let state = undoMove(gameState);
      state = undoMove(state);
      setGameState(state);
      lastPlayerRef.current = 'black';
    } else {
      // PvP 模式悔一步
      setGameState(undoMove(gameState));
    }
  }, [gameState, gameMode, isGameOver]);

  // 新游戏
  const handleNewGame = useCallback(() => {
    setGameState(createInitialState());
    lastPlayerRef.current = 'black';
  }, []);

  // 切换游戏模式
  const handleModeChange = useCallback((mode: 'pve' | 'pvp') => {
    setGameMode(mode);
    setGameState(createInitialState());
    lastPlayerRef.current = 'black';
    setShowSettings(false);
  }, []);

  // 切换难度
  const handleDifficultyChange = useCallback((diff: Difficulty) => {
    setDifficulty(diff);
    setGameState(createInitialState());
    lastPlayerRef.current = 'black';
    setShowSettings(false);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 标题 */}
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-amber-900 mb-2">
            五子棋
          </h1>
          <p className="text-amber-700 text-lg">Gomoku AI</p>
        </header>

        {/* 游戏信息 */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* 当前回合 */}
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full ${
                gameState.currentPlayer === 'black' ? 'bg-black' : 'bg-white border-2 border-gray-800'
              }`} />
              <span className="text-amber-900 font-medium">
                {isGameOver
                  ? gameState.winner === 'draw'
                    ? '平局！'
                    : `${gameState.winner === 'black' ? '黑' : '白'}方获胜！`
                  : isDraw
                  ? '平局！'
                  : gameState.currentPlayer === 'black'
                  ? '黑方回合'
                  : isAIThinking
                  ? 'AI 思考中...'
                  : '白方回合（AI）'
                }
              </span>
            </div>

            {/* 控制按钮 */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleUndo}
                disabled={isGameOver || gameState.history.length === 0}
                className="px-4 py-2 bg-amber-100 text-amber-900 rounded-lg hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                悔棋
              </button>
              <button
                onClick={handleNewGame}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
              >
                新游戏
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                设置
              </button>
            </div>
          </div>
        </div>

        {/* 棋盘 */}
        <Board
          board={gameState.board}
          lastMove={gameState.lastMove}
          winningLine={gameState.winningLine}
          onMove={handleMove}
          disabled={isGameOver || isDraw || (gameMode === 'pve' && gameState.currentPlayer === 'white')}
        />

        {/* 设置模态框 */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold text-amber-900 mb-4">游戏设置</h2>
              
              {/* 游戏模式 */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-amber-900 mb-3">游戏模式</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleModeChange('pve')}
                    className={`flex-1 px-4 py-3 rounded-lg transition-colors ${
                      gameMode === 'pve'
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="font-medium">人机对战</div>
                    <div className="text-sm opacity-75">vs AI</div>
                  </button>
                  <button
                    onClick={() => handleModeChange('pvp')}
                    className={`flex-1 px-4 py-3 rounded-lg transition-colors ${
                      gameMode === 'pvp'
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="font-medium">人人对战</div>
                    <div className="text-sm opacity-75">本地双人对弈</div>
                  </button>
                </div>
              </div>

              {/* AI 难度 */}
              {gameMode === 'pve' && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-amber-900 mb-3">AI 难度</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map((diff) => (
                      <button
                        key={diff}
                        onClick={() => handleDifficultyChange(diff)}
                        className={`flex-1 px-4 py-3 rounded-lg transition-colors ${
                          difficulty === diff
                            ? 'bg-amber-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {diff === 'easy' && '简单'}
                        {diff === 'medium' && '中等'}
                        {diff === 'hard' && '困难'}
                        {diff === 'expert' && '专家'}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 mt-3">
                    {difficulty === 'easy' && 'AI 会随机犯错误，适合新手'}
                    {difficulty === 'medium' && 'AI 有一定实力，适合入门玩家'}
                    {difficulty === 'hard' && 'AI 实力较强，适合进阶玩家'}
                    {difficulty === 'expert' && 'AI 实力很强，挑战自我'}
                  </p>
                </div>
              )}

              {/* 关闭按钮 */}
              <button
                onClick={() => setShowSettings(false)}
                className="w-full px-4 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        )}

        {/* 页脚 */}
        <footer className="text-center mt-8 text-amber-700 text-sm">
          <p>Powered by Rapfi AI Engine</p>
        </footer>
      </div>
    </main>
  );
}
