'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Board from '@/components/Board';
import StatsPanel from '@/components/StatsPanel';
import { 
  createInitialState, 
  makeMove, 
  undoMove, 
  checkDraw,
  loadStats,
  saveStats,
  recordGameResult,
  type GameState,
  type Player,
  type GameStats,
} from '@/lib/game';
import type { Difficulty } from '@/lib/ai/engine';
import { audioManager } from '@/lib/audio';
import { 
  loadSkins, 
  saveSkins, 
  BOARD_SKINS, 
  STONE_SKINS,
  type BoardSkin,
  type StoneSkin,
} from '@/lib/skins';

const STORAGE_KEY = 'gomoku-game-state';

export default function Home() {
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gameMode, setGameMode] = useState<'pve' | 'pvp'>('pve');
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<GameStats>(() => loadStats());
  const [boardSkin, setBoardSkin] = useState<BoardSkin>(BOARD_SKINS[0]);
  const [stoneSkin, setStoneSkin] = useState<StoneSkin>(STONE_SKINS[0]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showVictoryEffect, setShowVictoryEffect] = useState(false);
  
  // 使用 ref 跟踪上一步玩家，防止 AI 重复调用
  const lastPlayerRef = useRef<Player>('black');
  // 内置 AI Worker（作为 Rapfi 失败时的备用）
  const workerRef = useRef<Worker | null>(null);
  // 跟踪是否已播放胜利音效
  const victorySoundPlayedRef = useRef(false);
  
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

  // 加载战绩统计
  useEffect(() => {
    const loadedStats = loadStats();
    setStats(loadedStats);
  }, []);

  // 加载皮肤偏好
  useEffect(() => {
    const loadedSkins = loadSkins();
    const board = BOARD_SKINS.find(s => s.id === loadedSkins.board) || BOARD_SKINS[0];
    const stone = STONE_SKINS.find(s => s.id === loadedSkins.stone) || STONE_SKINS[0];
    setBoardSkin(board);
    setStoneSkin(stone);
  }, []);

  // 加载存档
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.gameState && parsed.difficulty && parsed.gameMode) {
          setGameState(parsed.gameState);
          setDifficulty(parsed.difficulty);
          setGameMode(parsed.gameMode);
          lastPlayerRef.current = parsed.gameState.currentPlayer;
        }
      }
    } catch (error) {
      console.error('Failed to load game state:', error);
    }
  }, []);

  // 自动保存游戏状态
  useEffect(() => {
    try {
      const toSave = {
        gameState,
        difficulty,
        gameMode,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save game state:', error);
    }
  }, [gameState, difficulty, gameMode]);

  // 音效开关持久化
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gomoku-sound-enabled');
      if (saved !== null) {
        setSoundEnabled(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load sound setting:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('gomoku-sound-enabled', JSON.stringify(soundEnabled));
      audioManager.setEnabled(soundEnabled);
    } catch (error) {
      console.error('Failed to save sound setting:', error);
    }
  }, [soundEnabled]);

  // 落子音效播放（使用 ref 跟踪上一步，避免重复播放）
  const lastMoveRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (gameState.lastMove) {
      const key = `${gameState.lastMove[0]},${gameState.lastMove[1]}`;
      if (lastMoveRef.current !== key) {
        // 新落子，播放音效
        if (soundEnabled) {
          audioManager.playPlace();
        }
        lastMoveRef.current = key;
      }
    }
  }, [gameState.lastMove, soundEnabled]);

  // 新游戏时重置 lastMove ref
  useEffect(() => {
    if (gameState.history.length === 0) {
      lastMoveRef.current = null;
    }
  }, [gameState.history.length]);

  // 胜利/平局检测与特效 + 战绩记录
  useEffect(() => {
    const isGameOver = gameState.winner !== null;
    const isDraw = checkDraw(gameState.board) && !gameState.winner;

    if (isGameOver && gameState.winner && !victorySoundPlayedRef.current) {
      // 播放胜利音效
      if (soundEnabled) {
        audioManager.playWin();
      }
      victorySoundPlayedRef.current = true;
      
      // 显示胜利特效
      setShowVictoryEffect(true);
      
      // 3 秒后隐藏特效
      setTimeout(() => {
        setShowVictoryEffect(false);
      }, 3000);

      // 记录战绩（仅在人机模式下）
      if (gameMode === 'pve') {
        const result = gameState.winner === 'black' ? 'win' : 'loss';
        const newStats = recordGameResult(stats, result, difficulty);
        setStats(newStats);
        saveStats(newStats);
      }
    } else if (isDraw && !victorySoundPlayedRef.current) {
      // 播放平局音效
      if (soundEnabled) {
        audioManager.playDraw();
      }
      victorySoundPlayedRef.current = true;

      // 记录平局战绩（仅在人机模式下）
      if (gameMode === 'pve') {
        const newStats = recordGameResult(stats, 'draw', difficulty);
        setStats(newStats);
        saveStats(newStats);
      }
    }

    // 新游戏时重置标记
    if (!isGameOver && !isDraw) {
      victorySoundPlayedRef.current = false;
      setShowVictoryEffect(false);
    }
  }, [gameState.winner, gameState.board, soundEnabled, gameMode, difficulty, stats]);

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
          lastMove: gameState.lastMove || undefined,  // 传递最新落子
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

  // 查看战绩
  const handleViewStats = useCallback(() => {
    setShowStats(true);
  }, []);

  // 切换棋盘皮肤
  const handleBoardSkinChange = useCallback((skinId: string) => {
    const skin = BOARD_SKINS.find(s => s.id === skinId) || BOARD_SKINS[0];
    setBoardSkin(skin);
    saveSkins({ board: skinId, stone: stoneSkin.id });
  }, [stoneSkin]);

  // 切换棋子皮肤
  const handleStoneSkinChange = useCallback((skinId: string) => {
    const skin = STONE_SKINS.find(s => s.id === skinId) || STONE_SKINS[0];
    setStoneSkin(skin);
    saveSkins({ board: boardSkin.id, stone: skinId });
  }, [boardSkin]);

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
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  soundEnabled 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
                title={soundEnabled ? '音效已开启' : '音效已关闭'}
              >
                {soundEnabled ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 12.293a1 1 0 011.414 0L15 13.586l1.293-1.293a1 1 0 111.414 1.414L16.414 15l1.293 1.293a1 1 0 01-1.414 1.414L15 16.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 15l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleViewStats}
                className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                title="查看战绩"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              </button>
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
          boardSkin={boardSkin}
          stoneSkin={stoneSkin}
        />

        {/* 战绩统计面板 */}
        {showStats && (
          <StatsPanel
            stats={stats}
            onClose={() => setShowStats(false)}
          />
        )}

        {/* 设置模态框 */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-amber-900">游戏设置</h2>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
              
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

              {/* 棋盘皮肤 */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-amber-900 mb-3">🎨 棋盘皮肤</h3>
                <div className="grid grid-cols-2 gap-3">
                  {BOARD_SKINS.map((skin) => (
                    <button
                      key={skin.id}
                      onClick={() => handleBoardSkinChange(skin.id)}
                      className={`flex-1 px-4 py-3 rounded-lg transition-colors ${
                        boardSkin.id === skin.id
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div className="font-medium">{skin.emoji} {skin.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 棋子皮肤 */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-amber-900 mb-3">⚫ 棋子皮肤</h3>
                <div className="grid grid-cols-2 gap-3">
                  {STONE_SKINS.map((skin) => (
                    <button
                      key={skin.id}
                      onClick={() => handleStoneSkinChange(skin.id)}
                      className={`flex-1 px-4 py-3 rounded-lg transition-colors ${
                        stoneSkin.id === skin.id
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div className="font-medium">{skin.emoji} {skin.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              </div>
              
              {/* 关闭按钮 - 固定在底部 */}
              <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg sticky bottom-0">
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full px-4 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 胜利特效 */}
        {showVictoryEffect && gameState.winner && gameState.winner !== 'draw' && (
          <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
            <div className="text-center animate-bounce">
              <div className="text-6xl mb-4">🎉</div>
              <div className="text-4xl font-bold text-amber-600 bg-white/90 px-8 py-4 rounded-2xl shadow-2xl">
                {gameState.winner === 'black' ? '黑方' : '白方'}获胜！
              </div>
            </div>
          </div>
        )}

        {/* 平局特效 */}
        {showVictoryEffect && gameState.winner === 'draw' && (
          <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
            <div className="text-center animate-pulse">
              <div className="text-6xl mb-4">🤝</div>
              <div className="text-4xl font-bold text-gray-600 bg-white/90 px-8 py-4 rounded-2xl shadow-2xl">
                平局！
              </div>
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
