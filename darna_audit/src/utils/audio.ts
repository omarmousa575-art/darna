/**
 * Synthesizes sound effects using Web Audio API + vibration & autoplay unlock
 * Guarantees crisp, loud, offline-capable sounds across mobile and desktop
 */

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private ringInterval: any = null;
  private isUnlocked: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.unlockAudio();
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('click', unlock, { passive: true });
      window.addEventListener('touchstart', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }
  }

  public unlockAudio(): void {
    if (this.isUnlocked && this.ctx && this.ctx.state === 'running') return;
    try {
      const ctx = this.getContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => {
          this.isUnlocked = true;
        }).catch(() => {});
      } else if (ctx && ctx.state === 'running') {
        this.isUnlocked = true;
      }
    } catch (e) {}
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Play realistic outgoing phone ring (double beep cadence)
  playOutgoingRing() {
    this.stopRingtone();
    this.unlockAudio();

    const playPulse = () => {
      const ctx = this.getContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, now);

        // First burst (400ms)
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.4);
        osc2.stop(now + 0.4);

        // Second burst (400ms after a brief 200ms gap)
        const osc3 = ctx.createOscillator();
        const osc4 = ctx.createOscillator();
        const gain2 = ctx.createGain();

        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(440, now + 0.5);
        osc4.type = 'sine';
        osc4.frequency.setValueAtTime(480, now + 0.5);

        gain2.gain.setValueAtTime(0.12, now + 0.5);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

        osc3.connect(gain2);
        osc4.connect(gain2);
        gain2.connect(ctx.destination);

        osc3.start(now + 0.5);
        osc4.start(now + 0.5);
        osc3.stop(now + 0.9);
        osc4.stop(now + 0.9);
      } catch (e) {}
    };

    playPulse();
    this.ringInterval = setInterval(playPulse, 2800);
  }

  // Play unmistakable, melodic incoming phone ring (Arabic / modern smartphone chime)
  playIncomingRing() {
    this.stopRingtone();
    this.unlockAudio();

    // Trigger mobile vibration if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([400, 200, 400, 1000]);
      } catch (e) {}
    }

    const playMelodicRing = () => {
      const ctx = this.getContext();
      if (!ctx) return;
      try {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const notes = [
          { f: 523.25, time: 0.0, dur: 0.2 }, // C5
          { f: 659.25, time: 0.18, dur: 0.2 }, // E5
          { f: 783.99, time: 0.36, dur: 0.25 }, // G5
          { f: 1046.5, time: 0.58, dur: 0.45 }, // C6
          { f: 880.0, time: 1.1, dur: 0.25 }, // A5
          { f: 783.99, time: 1.35, dur: 0.5 }, // G5
        ];

        notes.forEach((note) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(note.f, now + note.time);

          gain.gain.setValueAtTime(0.22, now + note.time);
          gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + note.time);
          osc.stop(now + note.time + note.dur);
        });

        // Mobile vibration sequence during ring
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate([300, 150, 300, 800]);
          } catch (e) {}
        }
      } catch (e) {}
    };

    playMelodicRing();
    this.ringInterval = setInterval(playMelodicRing, 2600);
  }

  // Stop ringtone immediately
  stopRingtone() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch (e) {}
    }
  }

  // Call connected chime
  playCallConnected() {
    this.stopRingtone();
    this.unlockAudio();
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {}
  }

  // Call disconnected tone
  playCallEnded() {
    this.stopRingtone();
    this.unlockAudio();
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {}
  }

  // Message sent pop
  playMessageSent() {
    this.unlockAudio();
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(350, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  // Notification chime
  playNotificationSound() {
    this.unlockAudio();
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    } catch (e) {}
  }
}

export const sounds = new SoundSynthesizer();
