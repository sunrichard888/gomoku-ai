// 棋盘皮肤配置
export interface BoardSkin {
  id: string;
  name: string;
  emoji: string;
  // 背景颜色/渐变
  backgroundColor: string | string[];
  // 网格线颜色
  gridColor: string;
  // 星位颜色
  starColor: string;
  // 边框颜色（可选）
  borderColor?: string;
}

// 棋子皮肤配置
export interface StoneSkin {
  id: string;
  name: string;
  emoji: string;
  // 黑棋颜色配置
  blackStones: {
    // 渐变颜色（径向渐变：中心 → 中间 → 边缘）
    gradient: [string, string, string];
    // 是否有纹理
    texture?: 'none' | 'marble' | 'wood' | 'glass';
    // 光泽强度（0-1）
    gloss?: number;
  };
  // 白棋颜色配置
  whiteStones: {
    gradient: [string, string, string];
    texture?: 'none' | 'marble' | 'wood' | 'glass';
    gloss?: number;
  };
}

// 预设棋盘皮肤
export const BOARD_SKINS: BoardSkin[] = [
  {
    id: 'classic',
    name: '经典木质',
    emoji: '🪵',
    backgroundColor: ['#DEB887', '#D2A679', '#DEB887'],
    gridColor: '#5C4033',
    starColor: '#5C4033',
  },
  {
    id: 'stone',
    name: '石质棋盘',
    emoji: '🪨',
    backgroundColor: ['#A8A8A8', '#909090', '#A8A8A8'],
    gridColor: '#404040',
    starColor: '#404040',
  },
  {
    id: 'minimal',
    name: '简约风格',
    emoji: '⬜',
    backgroundColor: ['#F5F5F5', '#F5F5F5', '#F5F5F5'],
    gridColor: '#333333',
    starColor: '#333333',
  },
  {
    id: 'dark',
    name: '深色模式',
    emoji: '🌙',
    backgroundColor: ['#2D2D2D', '#1F1F1F', '#2D2D2D'],
    gridColor: '#666666',
    starColor: '#888888',
  },
  {
    id: 'bamboo',
    name: '竹纹棋盘',
    emoji: '🎋',
    backgroundColor: ['#C4A574', '#B8956A', '#C4A574'],
    gridColor: '#3D2817',
    starColor: '#3D2817',
  },
];

// 预设棋子皮肤
export const STONE_SKINS: StoneSkin[] = [
  {
    id: 'classic',
    name: '经典棋子',
    emoji: '⚫',
    blackStones: {
      gradient: ['#666666', '#333333', '#000000'],
      gloss: 0.5,
    },
    whiteStones: {
      gradient: ['#FFFFFF', '#F0F0F0', '#CCCCCC'],
      gloss: 0.5,
    },
  },
  {
    id: 'marble',
    name: '大理石',
    emoji: '🔮',
    blackStones: {
      gradient: ['#4A4A4A', '#2D2D2D', '#1A1A1A'],
      texture: 'marble',
      gloss: 0.7,
    },
    whiteStones: {
      gradient: ['#FFFFFF', '#F8F8F8', '#E8E8E8'],
      texture: 'marble',
      gloss: 0.7,
    },
  },
  {
    id: 'glass',
    name: '玻璃质感',
    emoji: '🔵',
    blackStones: {
      gradient: ['#2C2C2C', '#1A1A1A', '#0A0A0A'],
      texture: 'glass',
      gloss: 0.9,
    },
    whiteStones: {
      gradient: ['#FFFFFF', '#E8F4F8', '#C8E0E8'],
      texture: 'glass',
      gloss: 0.9,
    },
  },
  {
    id: 'wood',
    name: '木质棋子',
    emoji: '🌰',
    blackStones: {
      gradient: ['#3D2817', '#2D1A10', '#1A0F0A'],
      texture: 'wood',
      gloss: 0.3,
    },
    whiteStones: {
      gradient: ['#F5DEB3', '#E8D5A3', '#D8C593'],
      texture: 'wood',
      gloss: 0.3,
    },
  },
  {
    id: 'neon',
    name: '霓虹风格',
    emoji: '💡',
    blackStones: {
      gradient: ['#0066FF', '#0044CC', '#002299'],
      gloss: 0.8,
    },
    whiteStones: {
      gradient: ['#FF6600', '#CC5500', '#994400'],
      gloss: 0.8,
    },
  },
];

// 默认皮肤
export const DEFAULT_BOARD_SKIN = 'classic';
export const DEFAULT_STONE_SKIN = 'classic';

// 皮肤存储键
export const SKIN_STORAGE_KEY = 'gomoku-skins';

// 加载皮肤偏好
export function loadSkins(): { board: string; stone: string } {
  if (typeof window === 'undefined') {
    return { board: DEFAULT_BOARD_SKIN, stone: DEFAULT_STONE_SKIN };
  }
  
  try {
    const saved = localStorage.getItem(SKIN_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        board: parsed.board || DEFAULT_BOARD_SKIN,
        stone: parsed.stone || DEFAULT_STONE_SKIN,
      };
    }
  } catch (error) {
    console.error('Failed to load skins:', error);
  }
  
  return { board: DEFAULT_BOARD_SKIN, stone: DEFAULT_STONE_SKIN };
}

// 保存皮肤偏好
export function saveSkins(skins: { board: string; stone: string }): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, JSON.stringify(skins));
  } catch (error) {
    console.error('Failed to save skins:', error);
  }
}
