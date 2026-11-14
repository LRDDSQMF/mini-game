const MUTE_STORAGE_KEY = 'sweet_stack_muted_v1';

// MIDI note to frequency helper
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Cheerful 8-bar (64 eighth-note steps) Bakery Theme in C Major
// 0 = rest
const MELODY_STEPS: number[] = [
  // Bar 1 (C): C5 E5 G5 E5 | A5 G5 E5 C5
  72, 76, 79, 76, 81, 79, 76, 72,
  // Bar 2 (Dm7 -> G7): D5 F5 A5 F5 | G5 - B5 G5
  74, 77, 81, 77, 79, 0, 83, 79,
  // Bar 3 (C -> A7): C6 G5 E5 C5 | A5 G5 E5 -
  84, 79, 76, 72, 81, 79, 76, 0,
  // Bar 4 (Dm7 -> G7): F5 E5 D5 C5 | D5 - G4 -
  77, 76, 74, 72, 74, 0, 67, 0,
  // Bar 5 (Fmaj7): A5 - F5 A5 | C6 B5 A5 F5
  81, 0, 77, 81, 84, 83, 81, 77,
  // Bar 6 (Em7 -> Am): G5 - E5 G5 | B5 A5 G5 E5
  79, 0, 76, 79, 83, 81, 79, 76,
  // Bar 7 (Dm7 -> G7): F5 G5 A5 F5 | G5 A5 B5 G5
  77, 79, 81, 77, 79, 81, 83, 79,
  // Bar 8 (C): C6 - G5 E5 | C5 - - -
  84, 0, 79, 76, 72, 0, 0, 0,
];

// Bouncy walking bassline (MIDI notes, 64 steps)
const BASS_STEPS: number[] = [
  // Bar 1 (C)
  48, 0, 55, 0, 48, 0, 52, 55,
  // Bar 2 (Dm -> G)
  50, 0, 57, 0, 43, 0, 55, 0,
  // Bar 3 (C -> Am)
  48, 0, 55, 0, 45, 0, 52, 0,
  // Bar 4 (Dm -> G)
  50, 0, 53, 0, 43, 0, 47, 50,
  // Bar 5 (F)
  41, 0, 48, 0, 41, 0, 45, 48,
  // Bar 6 (Em -> Am)
  40, 0, 47, 0, 45, 0, 52, 0,
  // Bar 7 (Dm -> G)
  50, 0, 57, 0, 43, 0, 55, 47,
  // Bar 8 (C)
  48, 0, 55, 0, 48, 0, 0, 0,
];

// Off-beat ukulele/harp triad chords (every 2 steps on off-beats)
const CHORD_PROGRESSION: number[][] = [
  [60, 64, 67], // C
  [60, 64, 67], // C
  [62, 65, 69], // Dm
  [59, 62, 67], // G7
  [60, 64, 67], // C
  [60, 64, 69], // Am7
  [62, 65, 69], // Dm
  [59, 62, 67], // G7
  [65, 69, 72], // F
  [65, 69, 72], // F
  [64, 67, 71], // Em
  [60, 64, 69], // Am7
  [62, 65, 69], // Dm
  [59, 62, 67], // G7
  [60, 64, 67], // C
  [60, 64, 67], // C
];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  // BGM Scheduler state
  private bgmMasterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private bgmTimerId: number | null = null;
  private bgmRunning: boolean = false;
  private bgmMode: 'title' | 'playing' | 'paused' | 'gameover' = 'title';
  private nextNoteTime: number = 0;
  private currentStep: number = 0;
  private tempoBpm: number = 132;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
    } catch {
      this.muted = false;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(value: boolean): void {
    this.muted = value;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, String(value));
    } catch {
      // Ignore storage errors in restricted environments
    }

    if (this.bgmMasterGain && this.ctx) {
      const targetGain = this.muted ? 0 : this.getModeVolume();
      this.bgmMasterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.04);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.unlock();
      this.playClick();
      this.startBgm();
    }
    return this.muted;
  }

  private getModeVolume(): number {
    switch (this.bgmMode) {
      case 'playing':
        return 0.28;
      case 'title':
        return 0.19;
      case 'paused':
        return 0.08;
      case 'gameover':
        return 0.1;
    }
  }

  public setBgmMode(mode: 'title' | 'playing' | 'paused' | 'gameover'): void {
    this.bgmMode = mode;
    if (this.bgmMasterGain && this.ctx) {
      const target = this.muted ? 0 : this.getModeVolume();
      this.bgmMasterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }
  }

  public setBgmStageTempo(stageNumber: number): void {
    // Gently scale energy up from 132 BPM to max 150 BPM on higher stages
    this.tempoBpm = Math.min(150, 130 + (stageNumber - 1) * 4);
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.bgmMasterGain = this.ctx.createGain();
        this.bgmMasterGain.gain.value = this.muted ? 0 : this.getModeVolume();
        this.bgmMasterGain.connect(this.ctx.destination);
        this.createNoiseBuffer();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx
        .resume()
        .then(() => {
          if (this.ctx && this.bgmRunning) {
            this.nextNoteTime = Math.max(this.nextNoteTime, this.ctx.currentTime + 0.04);
          }
        })
        .catch(() => {});
    }
  }

  private createNoiseBuffer(): void {
    if (!this.ctx || this.noiseBuffer) return;
    const length = Math.floor(this.ctx.sampleRate * 0.08);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  public startBgm(): void {
    this.unlock();
    if (!this.ctx || this.bgmRunning) return;

    this.bgmRunning = true;
    this.currentStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.06;

    this.bgmTimerId = window.setInterval(() => {
      this.scheduleBgmNotes();
    }, 25);
  }

  public stopBgm(): void {
    this.bgmRunning = false;
    if (this.bgmTimerId !== null) {
      clearInterval(this.bgmTimerId);
      this.bgmTimerId = null;
    }
  }

  public handleVisibilityChange(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) {
      if (this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    } else if (!this.muted) {
      if (this.ctx.state === 'suspended') {
        this.ctx
          .resume()
          .then(() => {
            if (this.ctx && this.bgmRunning) {
              this.nextNoteTime = this.ctx.currentTime + 0.05;
            }
          })
          .catch(() => {});
      } else if (this.bgmRunning) {
        this.nextNoteTime = this.ctx.currentTime + 0.05;
      }
    }
  }

  private scheduleBgmNotes(): void {
    if (!this.ctx || !this.bgmMasterGain || !this.bgmRunning) return;
    if (this.ctx.state !== 'running') return;

    const eighthNoteDuration = 60 / this.tempoBpm / 2;

    // Prevent catch-up burst if timer stalled
    if (this.nextNoteTime < this.ctx.currentTime - 0.2) {
      this.nextNoteTime = this.ctx.currentTime + 0.05;
    }

    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      this.playBgmStep(this.currentStep, this.nextNoteTime, eighthNoteDuration);
      this.nextNoteTime += eighthNoteDuration;
      this.currentStep = (this.currentStep + 1) % MELODY_STEPS.length;
    }
  }

  private playBgmStep(step: number, time: number, stepDur: number): void {
    if (!this.ctx || !this.bgmMasterGain || this.muted) return;

    // 1. Marimba / Celesta Lead Melody
    const melodyMidi = MELODY_STEPS[step];
    if (melodyMidi > 0) {
      const freq = midiToFreq(melodyMidi);
      const osc = this.ctx.createOscillator();
      const overtone = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2, time);

      const overtoneGain = this.ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.14, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.24, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 1.45);

      osc.connect(gain);
      overtone.connect(overtoneGain);
      overtoneGain.connect(gain);
      gain.connect(this.bgmMasterGain);

      osc.start(time);
      overtone.start(time);
      osc.stop(time + stepDur * 1.5);
      overtone.stop(time + stepDur * 1.5);
    }

    // 2. Bouncy Pizzicato Bass (plays in active gameplay & title)
    const bassMidi = BASS_STEPS[step];
    if (bassMidi > 0 && this.bgmMode !== 'paused') {
      const bassOsc = this.ctx.createOscillator();
      const bassFilter = this.ctx.createBiquadFilter();
      const bassGain = this.ctx.createGain();

      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(midiToFreq(bassMidi), time);

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(420, time);

      bassGain.gain.setValueAtTime(0.001, time);
      bassGain.gain.linearRampToValueAtTime(0.28, time + 0.01);
      bassGain.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 1.1);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(this.bgmMasterGain);

      bassOsc.start(time);
      bassOsc.stop(time + stepDur * 1.15);
    }

    // 3. Cheerful Off-beat Ukulele Chords (steps 1, 3, 5, 7...)
    if (step % 2 === 1 && this.bgmMode === 'playing') {
      const chordIdx = Math.floor(step / 4) % CHORD_PROGRESSION.length;
      const chord = CHORD_PROGRESSION[chordIdx];
      for (const note of chord) {
        const chordOsc = this.ctx.createOscillator();
        const chordGain = this.ctx.createGain();
        chordOsc.type = 'sine';
        chordOsc.frequency.setValueAtTime(midiToFreq(note), time);
        chordGain.gain.setValueAtTime(0.001, time);
        chordGain.gain.linearRampToValueAtTime(0.055, time + 0.008);
        chordGain.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 0.75);

        chordOsc.connect(chordGain);
        chordGain.connect(this.bgmMasterGain);
        chordOsc.start(time);
        chordOsc.stop(time + stepDur * 0.8);
      }
    }

    // 4. Crisp Light Brush Shaker (on off-beats during active play)
    if (this.noiseBuffer && this.bgmMode === 'playing' && step % 2 === 1) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(5200, time);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.045, time);
      nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

      noise.connect(hp);
      hp.connect(nGain);
      nGain.connect(this.bgmMasterGain);
      noise.start(time);
    }
  }

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) this.unlock();
    if (!this.ctx || this.ctx.state === 'suspended') return null;
    return this.ctx;
  }

  public playClick(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.06);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playDrop(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playLand(perfect: boolean, combo: number): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(190, now);
    thudOsc.frequency.exponentialRampToValueAtTime(85, now + 0.11);
    thudGain.gain.setValueAtTime(0.24, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    thudOsc.connect(thudGain);
    thudGain.connect(ctx.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.14);

    if (perfect) {
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
      const noteFreq = scale[Math.min(Math.max(combo - 1, 0), scale.length - 1)];

      const chime = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chime.type = 'triangle';
      chime.frequency.setValueAtTime(noteFreq, now);
      chimeGain.gain.setValueAtTime(0.2, now);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      chime.connect(chimeGain);
      chimeGain.connect(ctx.destination);
      chime.start(now);
      chime.stop(now + 0.35);

      const sparkle = ctx.createOscillator();
      const sparkleGain = ctx.createGain();
      sparkle.type = 'sine';
      sparkle.frequency.setValueAtTime(noteFreq * 1.5, now + 0.03);
      sparkleGain.gain.setValueAtTime(0.09, now + 0.03);
      sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      sparkle.connect(sparkleGain);
      sparkleGain.connect(ctx.destination);
      sparkle.start(now + 0.03);
      sparkle.stop(now + 0.26);
    }
  }

  public playSlice(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 0.09);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.Q.setValueAtTime(1.8, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  public playStageClear(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  }

  public playGameOver(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [392.0, 349.23, 311.13, 261.63];

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.92, start + 0.16);
      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }
}

export const soundEngine = new SoundEngine();
