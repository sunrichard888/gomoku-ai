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
    if (gameMode === 'pve' && gameState.currentPlayer === 'white' && !isGameOver && !isAIThinking) {
      setIsAIThinking(true);
      
      console.log('Calling Rapfi API...');
      
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
        .then(res => {
          console.log('API response status:', res.status);
          return res.json();
        })
        .then(data => {
          console.log('API response data:', data);
          if (data.move) {
            setGameState(prev => {
              const newState = makeMove(prev, data.move.x, data.move.y);
              return newState;
            });
          } else {
            console.error('No move from API:', data.error);
          }
          setIsAIThinking(false);
        })
        .catch(err => {
          console.error('AI API error:', err);
          setIsAIThinking(false);
        });
    }
  }, [gameState, gameMode, difficulty, isGameOver, isAIThinking]);

  // 悔棋
  const handleUndo = useCallback(() => {
    if (gameMode === 'pve' && !isGameOver) {
      // PvE 模式悔两步（玩家和 AI 各一步）
      let state = undoMove(gameState);
      state = undoMove(state);
      setGameState(state);
    } else {
      // PvP 模式悔一步
      setGameState(undoMove(gameState));
    }
  }, [gameState, gameMode, isGameOver]);

  // 新游戏
  const handleNewGame = useCallback(() => {
    setGameState(createInitialState());
  }, []);

  // 切换游戏模式
  const handleModeChange = useCallback((mode: 'pve' | 'pvp') => {
    setGameMode(mode);
    setGameState(createInitialState());
    setShowSettings(false);
  }, []);

  // 切换难度
  const handleDifficultyChange = useCallback((diff: Difficulty) => {
    setDifficulty(diff);
    setGameState(createInitialState());
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
        <div className="flex justify-center items-center gap-6 mb-6">
          {/* 当前玩家 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl px-6 py-3 shadow-lg">
            <div className="text-sm text-gray-500 mb-1">当前回合</div>
            <div className="flex items-center gap-2">
              <div 
                className={`w-6 h-6 rounded-full ${
                  gameState.currentPlayer === 'black' 
                    ? 'bg-gradient-to-br from-gray-600 to-black' 
                    : 'bg-gradient-to-br from-white to-gray-300 border-2 border-gray-400'
                }`}
              />
              <span className="text-lg font-semibold text-gray-800">
                {gameState.currentPlayer === 'black' ? '黑棋' : '白棋'}
              </span>
              {isAIThinking && (
                <span className="text-sm text-amber-600 ml-2">AI 思考中...</span>
              )}
            </div>
          </div>

          {/* 游戏模式 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl px-6 py-3 shadow-lg">
            <div className="text-sm text-gray-500 mb-1">游戏模式</div>
            <div className="text-lg font-semibold text-gray-800">
              {gameMode === 'pve' ? '🆚 AI' : '👥 双人'}
            </div>
          </div>
        </div>

        {/* 游戏状态提示 */}
        {(isGameOver || isDraw) && (
          <div className="text-center mb-6">
            <div className={`inline-block px-8 py-4 rounded-2xl shadow-xl ${
              isDraw 
                ? 'bg-gradient-to-r from-gray-100 to-gray-200'
                : gameState.winner === 'black'
                ? 'bg-gradient-to-r from-gray-700 to-black'
                : 'bg-gradient-to-r from-gray-100 to-white'
            }`}>
              <div className={`text-2xl font-bold ${
                isDraw ? 'text-gray-600' : gameState.winner === 'black' ? 'text-white' : 'text-gray-800'
              }`}>
                {isDraw ? '🤝 平局！' : gameState.winner === 'black' ? '⚫ 黑棋获胜！' : '⚪ 白棋获胜！'}
              </div>
            </div>
          </div>
        )}

        {/* 棋盘 */}
        <div className="flex justify-center mb-6">
          <Board
            board={gameState.board}
            lastMove={gameState.lastMove}
            winningLine={gameState.winningLine}
            onMove={handleMove}
            disabled={isGameOver || (gameMode === 'pve' && isAIThinking)}
          />
        </div>

        {/* 控制按钮 */}
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={handleNewGame}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl shadow-lg hover:from-amber-600 hover:to-orange-600 transition-all transform hover:scale-105 active:scale-95"
          >
            🔄 新游戏
          </button>
          
          <button
            onClick={handleUndo}
            disabled={gameState.history.length === 0 || isGameOver}
            className="px-6 py-3 bg-white text-amber-700 font-semibold rounded-xl shadow-lg hover:bg-amber-50 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            ↩️ 悔棋
          </button>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-6 py-3 bg-white text-amber-700 font-semibold rounded-xl shadow-lg hover:bg-amber-50 transition-all transform hover:scale-105 active:scale-95"
          >
            ⚙️ 设置
          </button>
        </div>

        {/* 设置面板 */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">游戏设置</h2>
              
              {/* 游戏模式 */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">游戏模式</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleModeChange('pve')}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                      gameMode === 'pve'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🆚 人机对战
                  </button>
                  <button
                    onClick={() => handleModeChange('pvp')}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                      gameMode === 'pvp'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    👥 双人对战
                  </button>
                </div>
              </div>

              {/* AI 难度 */}
              {gameMode === 'pve' && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">AI 难度</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map((diff) => (
                      <button
                        key={diff}
                        onClick={() => handleDifficultyChange(diff)}
                        className={`py-3 rounded-xl font-semibold transition-all ${
                          difficulty === diff
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {diff === 'easy' && '😊 简单'}
                        {diff === 'medium' && '🤔 中等'}
                        {diff === 'hard' && '😈 困难'}
                        {diff === 'expert' && '💀 专家'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 关闭按钮 */}
              <button
                onClick={() => setShowSettings(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        )}

        {/* 页脚 */}
        <footer className="text-center mt-12 text-amber-700/60 text-sm">
          <p>Built with Next.js + Canvas + TypeScript</p>
          <p className="mt-1">Powered by ensemble-team 🎮</p>
        </footer>
      </div>
    </main>
  );
}
