'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { BoardState, Move } from '@/lib/game';
import { BOARD_SIZE } from '@/lib/game';
import type { BoardSkin, StoneSkin } from '@/lib/skins';

interface BoardProps {
  board: BoardState;
  lastMove: [number, number] | null;
  winningLine: [number, number][] | null;
  onMove: (x: number, y: number) => void;
  disabled?: boolean;
  boardSkin?: BoardSkin;
  stoneSkin?: StoneSkin;
}

// 动画棋子接口
interface AnimatedStone {
  x: number;
  y: number;
  color: string;
  scale: number;
  id: number;
}

export default function Board({ 
  board, 
  lastMove, 
  winningLine, 
  onMove,
  disabled = false,
  boardSkin,
  stoneSkin,
}: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 动画棋子状态
  const [animatedStones, setAnimatedStones] = useState<AnimatedStone[]>([]);
  const animationIdRef = useRef<number>(0);

  // 棋盘配置
  const CELL_SIZE = 40;
  const PADDING = 30;
  const BOARD_PIXELS = CELL_SIZE * (BOARD_SIZE - 1) + PADDING * 2;

  // 检测新落子并触发动画（使用 lastMoveRef 跟踪已动画的棋子）
  const lastMoveRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!lastMove) return;
    
    const [lx, ly] = lastMove;
    const key = `${lx},${ly}`;
    const stone = board[ly][lx];
    if (!stone) return;

    // 检查是否已为此落子播放过动画
    if (lastMoveRef.current !== key) {
      console.log('🎮 触发动画:', { x: lx, y: ly, color: stone });
      // 添加新动画棋子
      const newStone: AnimatedStone = {
        x: lx,
        y: ly,
        color: stone,
        scale: 0,
        id: Date.now(),
      };
      setAnimatedStones(prev => {
        const updated = [...prev, newStone];
        console.log('📋 animatedStones:', updated.map(s => ({ x: s.x, y: s.y, scale: s.scale })));
        return updated;
      });
      lastMoveRef.current = key;
    }
  }, [lastMove, board]);

  // 新游戏时重置动画跟踪
  useEffect(() => {
    if (!lastMove) {
      lastMoveRef.current = null;
      setAnimatedStones([]);
    }
  }, [lastMove]);

  // 调试：监控 animatedStones 变化
  useEffect(() => {
    if (animatedStones.length > 0) {
      console.log('🔄 动画中:', animatedStones.map(s => `${s.x},${s.y}: ${s.scale.toFixed(2)}`));
    }
  }, [animatedStones]);

  // 动画循环 - 直接操作并触发绘制
  useEffect(() => {
    let frameId: number;
    
    const animate = () => {
      setAnimatedStones(prev => {
        if (prev.length === 0) return prev;
        
        const updated = prev
          .map(stone => ({
            ...stone,
            scale: Math.min(stone.scale + 0.03, 1.05), // 慢速缩放 + 轻微过冲
          }))
          .map(stone => {
            // 过冲后弹回 1.0
            if (stone.scale > 1) {
              return { ...stone, scale: Math.max(1, stone.scale - (stone.scale - 1) * 0.3) };
            }
            return stone;
          })
          .filter(stone => {
            const isStable = Math.abs(stone.scale - 1) < 0.02;
            return !isStable; // 保留不稳定的（还在动画的）
          });
        
        return updated;
      });
      
      frameId = requestAnimationFrame(animate);
    };
    
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // 绘制棋盘
  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, BOARD_PIXELS, BOARD_PIXELS);

    // 绘制背景（使用皮肤配置）
    const bgGradient = ctx.createLinearGradient(0, 0, BOARD_PIXELS, BOARD_PIXELS);
    const bgColors = boardSkin?.backgroundColor || ['#DEB887', '#D2A679', '#DEB887'];
    if (Array.isArray(bgColors)) {
      bgGradient.addColorStop(0, bgColors[0]);
      bgGradient.addColorStop(0.5, bgColors[1]);
      bgGradient.addColorStop(1, bgColors[2]);
    } else {
      bgGradient.addColorStop(0, bgColors);
      bgGradient.addColorStop(1, bgColors);
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, BOARD_PIXELS, BOARD_PIXELS);
    
    // 调试：显示当前动画棋子数量
    if (animatedStones.length > 0) {
      console.log('🎨 绘制棋盘，动画棋子数:', animatedStones.length);
    }

    // 绘制网格线（使用皮肤配置）
    ctx.strokeStyle = boardSkin?.gridColor || '#5C4033';
    ctx.lineWidth = 1;

    for (let i = 0; i < BOARD_SIZE; i++) {
      // 横线
      ctx.beginPath();
      ctx.moveTo(PADDING, PADDING + i * CELL_SIZE);
      ctx.lineTo(PADDING + (BOARD_SIZE - 1) * CELL_SIZE, PADDING + i * CELL_SIZE);
      ctx.stroke();

      // 竖线
      ctx.beginPath();
      ctx.moveTo(PADDING + i * CELL_SIZE, PADDING);
      ctx.lineTo(PADDING + i * CELL_SIZE, PADDING + (BOARD_SIZE - 1) * CELL_SIZE);
      ctx.stroke();
    }

    // 绘制天元和星位（使用皮肤配置）
    const starPoints = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]];
    ctx.fillStyle = boardSkin?.starColor || '#5C4033';
    for (const [x, y] of starPoints) {
      ctx.beginPath();
      ctx.arc(PADDING + x * CELL_SIZE, PADDING + y * CELL_SIZE, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 绘制棋子（静态）
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const stone = board[y][x];
        if (stone) {
          // 检查是否有正在动画的棋子
          const animStone = animatedStones.find(s => s.x === x && s.y === y);
          if (animStone) {
            // 绘制动画中的棋子
            drawStoneWithScale(ctx, x, y, stone, animStone.scale);
          } else {
            // 绘制普通棋子
            drawStone(ctx, x, y, stone);
          }
        }
      }
    }

    // 标记最后一步
    if (lastMove) {
      const [lx, ly] = lastMove;
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(PADDING + lx * CELL_SIZE, PADDING + ly * CELL_SIZE, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 标记获胜连线
    if (winningLine) {
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const [[startX, startY]] = winningLine;
      const [[endX, endY]] = [winningLine[0], winningLine[winningLine.length - 1]];
      ctx.moveTo(PADDING + startX * CELL_SIZE, PADDING + startY * CELL_SIZE);
      ctx.lineTo(PADDING + endX * CELL_SIZE, PADDING + endY * CELL_SIZE);
      ctx.stroke();
    }
  }, [board, lastMove, winningLine, animatedStones]);

  // 绘制单个棋子（静态）
  const drawStone = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
    drawStoneWithScale(ctx, x, y, color, 1);
  };

  // 绘制单个棋子（带缩放）
  const drawStoneWithScale = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, scale: number) => {
    const cx = PADDING + x * CELL_SIZE;
    const cy = PADDING + y * CELL_SIZE;
    const radius = CELL_SIZE * 0.42 * scale;

    if (radius <= 0) return;

    // 获取棋子皮肤配置
    const stoneConfig = color === 'black' 
      ? stoneSkin?.blackStones 
      : stoneSkin?.whiteStones;
    
    const gradientColors = stoneConfig?.gradient || (
      color === 'black' 
        ? ['#666666', '#333333', '#000000']
        : ['#FFFFFF', '#F0F0F0', '#CCCCCC']
    );

    // 创建渐变效果
    const gradient = ctx.createRadialGradient(
      cx - radius * 0.3,
      cy - radius * 0.3,
      radius * 0.1,
      cx,
      cy,
      radius
    );
    
    gradient.addColorStop(0, gradientColors[0]);
    gradient.addColorStop(0.3, gradientColors[1]);
    gradient.addColorStop(1, gradientColors[2]);

    // 绘制棋子阴影（仅当完全显示时）
    const gloss = stoneConfig?.gloss ?? 0.5;
    if (scale >= 0.9) {
      ctx.shadowColor = `rgba(0, 0, 0, ${0.2 + gloss * 0.2})`;
      ctx.shadowBlur = 4 + gloss * 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    }

    // 绘制棋子
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 添加高光效果（玻璃/大理石质感）
    if (gloss > 0.6 && scale >= 0.9) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // 高光
      const highlightGradient = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.3,
        0,
        cx - radius * 0.3,
        cy - radius * 0.3,
        radius * 0.4
      );
      highlightGradient.addColorStop(0, `rgba(255, 255, 255, ${gloss * 0.4})`);
      highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = highlightGradient;
      ctx.fill();
    }

    // 重置阴影
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  };

  // 处理点击
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // 找到最近的交叉点
    const boardX = Math.round((x - PADDING) / CELL_SIZE);
    const boardY = Math.round((y - PADDING) / CELL_SIZE);

    // 检查点击范围
    const distanceX = Math.abs(x - (PADDING + boardX * CELL_SIZE));
    const distanceY = Math.abs(y - (PADDING + boardY * CELL_SIZE));

    if (distanceX < CELL_SIZE * 0.45 && distanceY < CELL_SIZE * 0.45) {
      onMove(boardX, boardY);
    }
  }, [disabled, onMove]);

  // 初始化绘制
  useEffect(() => {
    drawBoard();
  }, [drawBoard]);

  // 响应式处理
  useEffect(() => {
    const handleResize = () => {
      drawBoard();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawBoard]);

  return (
    <div 
      ref={containerRef}
      className="relative inline-block touch-none"
      style={{ 
        maxWidth: '100%',
        overflow: 'hidden'
      }}
    >
      <canvas
        ref={canvasRef}
        width={BOARD_PIXELS}
        height={BOARD_PIXELS}
        onClick={handleClick}
        className={`
          cursor-pointer 
          rounded-lg 
          shadow-2xl
          transition-transform
          duration-200
          ${disabled ? 'cursor-not-allowed opacity-75' : 'hover:scale-[1.01] active:scale-[0.99]'}
        `}
        style={{
          width: '100%',
          maxWidth: '600px',
          height: 'auto',
          touchAction: 'none',
        }}
      />
    </div>
  );
}
