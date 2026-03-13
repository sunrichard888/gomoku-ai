// 音频管理器 - 使用 Web Audio API 生成音效（无需外部文件）

class AudioManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // 延迟初始化 AudioContext（需要用户交互后才能创建）
    this.init();
  }

  private init() {
    try {
      // 检查浏览器支持
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContext();
      }
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  }

  // 确保 AudioContext 处于运行状态（需要用户交互后调用）
  private ensureContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // 播放落子音效（短促的"嗒"声）
  playPlace() {
    if (!this.enabled || !this.audioContext) return;
    this.ensureContext();

    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    // 创建短促的敲击声
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // 频率：从高到低快速下降（模拟敲击）
    oscillator.frequency.setValueAtTime(800, now);
    oscillator.frequency.exponentialRampToValueAtTime(300, now + 0.05);

    // 音量包络：快速衰减
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    oscillator.start(now);
    oscillator.stop(now + 0.1);
  }

  // 播放胜利音效（欢快的 ascending 音阶）
  playWin() {
    if (!this.enabled || !this.audioContext) return;
    this.ensureContext();

    const now = this.audioContext.currentTime;
    const ctx = this.audioContext; // 避免 TypeScript 报错
    
    // 播放一组 ascending 音符（C-E-G-C）
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const duration = 0.15;

    notes.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.value = freq;

      const noteStart = now + index * duration;
      gainNode.gain.setValueAtTime(0.2, noteStart);
      gainNode.gain.exponentialRampToValueAtTime(0.01, noteStart + duration);

      oscillator.start(noteStart);
      oscillator.stop(noteStart + duration);
    });
  }

  // 播放平局音效（低沉的 descending 音阶）
  playDraw() {
    if (!this.enabled || !this.audioContext) return;
    this.ensureContext();

    const now = this.audioContext.currentTime;
    const ctx = this.audioContext; // 避免 TypeScript 报错
    
    // 播放一组 descending 音符
    const notes = [392.00, 349.23, 329.63, 293.66];
    const duration = 0.2;

    notes.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.value = freq;

      const noteStart = now + index * duration;
      gainNode.gain.setValueAtTime(0.15, noteStart);
      gainNode.gain.exponentialRampToValueAtTime(0.01, noteStart + duration);

      oscillator.start(noteStart);
      oscillator.stop(noteStart + duration);
    });
  }

  // 切换音效开关
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      this.init();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// 单例导出
export const audioManager = new AudioManager();
