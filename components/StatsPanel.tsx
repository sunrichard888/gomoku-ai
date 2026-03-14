'use client';

import React from 'react';
import type { GameStats } from '@/lib/game';

interface StatsPanelProps {
  stats: GameStats;
  onClose: () => void;
}

export default function StatsPanel({ stats, onClose }: StatsPanelProps) {
  const winRate = stats.totalGames > 0 
    ? ((stats.wins / stats.totalGames) * 100).toFixed(1) 
    : '0.0';

  const difficultyLabels = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
    expert: '专家',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-amber-900">📊 战绩统计</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 总体统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.totalGames}</div>
            <div className="text-sm text-blue-700 mt-1">总局数</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.wins}</div>
            <div className="text-sm text-green-700 mt-1">胜场</div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{stats.losses}</div>
            <div className="text-sm text-red-700 mt-1">负场</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-yellow-600">{winRate}%</div>
            <div className="text-sm text-yellow-700 mt-1">胜率</div>
          </div>
        </div>

        {/* 连胜统计 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">🔥 {stats.winStreak}</div>
            <div className="text-sm text-purple-700 mt-1">当前连胜</div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">👑 {stats.maxWinStreak}</div>
            <div className="text-sm text-orange-700 mt-1">最大连胜</div>
          </div>
        </div>

        {/* 按难度统计 */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-amber-900 mb-3">🎯 按难度统计</h3>
          <div className="space-y-3">
            {(Object.keys(difficultyLabels) as Array<keyof typeof difficultyLabels>).map((diff) => {
              const diffStats = stats.byDifficulty[diff];
              const total = diffStats.wins + diffStats.losses + diffStats.draws;
              const diffWinRate = total > 0 
                ? ((diffStats.wins / total) * 100).toFixed(1) 
                : '-';

              return (
                <div
                  key={diff}
                  className="bg-gray-50 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {diff === 'easy' && '😊'}
                      {diff === 'medium' && '🤔'}
                      {diff === 'hard' && '😈'}
                      {diff === 'expert' && '💀'}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900">
                        {difficultyLabels[diff]}
                      </div>
                      <div className="text-sm text-gray-500">
                        {total} 局
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">{diffStats.wins}</div>
                      <div className="text-xs text-gray-500">胜</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">{diffStats.losses}</div>
                      <div className="text-xs text-gray-500">负</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-600">{diffStats.draws}</div>
                      <div className="text-xs text-gray-500">平</div>
                    </div>
                    <div className="text-center min-w-[60px]">
                      <div className="text-lg font-bold text-blue-600">{diffWinRate}%</div>
                      <div className="text-xs text-gray-500">胜率</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 平局统计 */}
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-600">🤝 {stats.draws}</div>
          <div className="text-sm text-gray-700 mt-1">平局总数</div>
        </div>

        {/* 最后更新时间 */}
        <div className="text-center text-sm text-gray-400 mt-4">
          最后更新：{new Date(stats.lastUpdated).toLocaleString('zh-CN')}
        </div>
      </div>
    </div>
  );
}
