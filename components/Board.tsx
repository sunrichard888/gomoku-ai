'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import type { BoardState, Move } from '@/lib/game';
import { BOARD_SIZE } from '@/lib/game';

interface BoardProps {
  board: BoardState;
  lastMove: [number, number] | null;
  winningLine: [number, number][] | null;
  onMove: (x: number, y: number) => void;
  disabled?: boolean;
}

export default function Board({ 
  board, 
  lastMove, 
  winningLine, 
  onMove,
  disabled = false 
}: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 棋盘配置
  const CELL_SIZE = 40;
  const PADDING = 30;
  const BOARD_PIXELS = CELL_SIZE * (BOARD_SIZE - 1) + PADDING * 2;

  // 绘制棋盘
  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, BOARD_PIXELS, BOARD_PIXELS);

    // 绘制木纹背景
    const gradient = ctx.createLinearGradient(0, 0, BOARD_PIXELS, BOARD_PIXELS);
    gradient.addColorStop(0, '#DEB887');
    gradient.addColorStop(0.5, '#D2A679');
    gradient.addColorStop(1, '#DEB887');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, BOARD_PIXELS, BOARD_PIXELS);

    // 绘制网格线
    ctx.strokeStyle = '#5C4033';
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

    // 绘制天元和星位
    const starPoints = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]];
    ctx.fillStyle = '#5C4033';
    for (const [x, y] of starPoints) {
      ctx.beginPath();
      ctx.arc(PADDING + x * CELL_SIZE, PADDING + y * CELL_SIZE, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 绘制棋子
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const stone = board[y][x];
        if (stone) {
          drawStone(ctx, x, y, stone);
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
  }, [board, lastMove, winningLine]);

  // 绘制单个棋子
  const drawStone = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
    const cx = PADDING + x * CELL_SIZE;
    const cy = PADDING + y * CELL_SIZE;
    const radius = CELL_SIZE * 0.42;

    // 创建渐变效果
    const gradient = ctx.createRadialGradient(
      cx - radius * 0.3,
      cy - radius * 0.3,
      radius * 0.1,
      cx,
      cy,
      radius
    );

    if (color === 'black') {
      gradient.addColorStop(0, '#666666');
      gradient.addColorStop(0.3, '#333333');
      gradient.addColorStop(1, '#000000');
    } else {
      gradient.addColorStop(0, '#FFFFFF');
      gradient.addColorStop(0.3, '#F0F0F0');
      gradient.addColorStop(1, '#CCCCCC');
    }

    // 绘制棋子阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // 绘制棋子
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

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
