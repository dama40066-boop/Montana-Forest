// #17 AUDIO - Stylized Frontier Game Sound Engineering, Procedural Western Soundtrack & Tactile SFX
import { Vec3, clamp } from '../math';

export class SpatialAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  private windGain: GainNode | null = null;
  private musicInterval: number | null = null;
  private birdInterval: number | null = null;
  private cricketInterval: number | null = null;
  private heartbeatInterval: number | null = null;
  private isMusicPlaying: boolean = false;
  public enabled: boolean = true;
  private hasUnlocked: boolean = false;

  // Western pentatonic chord notes (Hz)
  private readonly westernChords = [
    [146.83, 220.00, 293.66, 349.23, 440.00], // D minor / Dorian
    [174.61, 220.00, 261.63, 349.23, 523.25], // F major
    [130.81, 196.00, 261.63, 329.63, 392.00], // C major
    [110.00, 164.81, 220.00, 261.63, 329.63], // A minor
    [123.47, 185.00, 246.94, 311.13, 369.99]  // B diminished/altered
  ];
  private chordIndex = 0;

  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  public getSfxGain(): GainNode | null {
    return this.sfxGain;
  }

  public setMasterVolume(val: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(clamp(val, 0, 1), this.ctx.currentTime);
    }
  }

  public setMusicVolume(val: number): void {
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(clamp(val * 0.45, 0, 1), this.ctx.currentTime);
    }
  }

  public setSfxVolume(val: number): void {
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(clamp(val, 0, 1), this.ctx.currentTime);
    }
  }

  public setAmbientVolume(val: number): void {
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(clamp(val * 0.55, 0, 1), this.ctx.currentTime);
    }
  }

  public async unlockAudio(): Promise<void> {
    if (!this.ctx) {
      await this.start();
    } else if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.hasUnlocked = true;
  }

  async start(): Promise<void> {
    if (!this.enabled) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.35;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.masterGain);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.45;
      this.ambientGain.connect(this.masterGain);

      // Setup window interaction unlock listener
      const unlockHandler = async () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          await this.ctx.resume();
        }
      };
      window.addEventListener('pointerdown', unlockHandler, { once: false, passive: true });
      window.addEventListener('keydown', unlockHandler, { once: false, passive: true });
      window.addEventListener('touchstart', unlockHandler, { once: false, passive: true });

      // Ambient Wind Synthesizer
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 3.0;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 380;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.035;

      whiteNoise.connect(filter);
      filter.connect(this.windGain);
      this.windGain.connect(this.ambientGain);
      try {
        whiteNoise.start();
      } catch {}

      // Start Procedural Western Soundtrack & Ambient Wildlife
      this.startStylizedSoundtrack();
      this.startAmbientBirds();
    } else if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {}
    }
  }

  // Procedural Western Frontier Game Soundtrack
  private startStylizedSoundtrack(): void {
    if (this.musicInterval) return;
    this.isMusicPlaying = true;

    // Play initial chord progression
    this.playWesternGuitarChord();

    // Loop stylized chord progression every 7.5 seconds
    this.musicInterval = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || !this.isMusicPlaying) return;
      this.playWesternGuitarChord();
    }, 7500);
  }

  private playWesternGuitarChord(): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const chord = this.westernChords[this.chordIndex];
    this.chordIndex = (this.chordIndex + 1) % this.westernChords.length;

    // Arpeggiated guitar/banjo plucks for western atmosphere
    chord.forEach((freq, i) => {
      const delay = i * 0.14 + (Math.random() * 0.04);
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      // Warm acoustic string harmonic (triangle + lowpass filter)
      osc.type = i % 2 === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + delay);

      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800 + i * 200, now + delay);
      filter.frequency.exponentialRampToValueAtTime(120, now + delay + 2.8);

      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.linearRampToValueAtTime(0.045 / (i + 1), now + delay + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 3.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain!);

      osc.start(now + delay);
      osc.stop(now + delay + 3.4);
    });

    // Gentle harmonica / flute breath lead note
    if (Math.random() > 0.4) {
      const leadNote = chord[Math.floor(Math.random() * chord.length)] * 2;
      const leadOsc = this.ctx.createOscillator();
      const leadGain = this.ctx.createGain();

      leadOsc.type = 'sine';
      leadOsc.frequency.setValueAtTime(leadNote, now + 1.2);
      leadOsc.frequency.linearRampToValueAtTime(leadNote * 1.05, now + 2.4);
      leadOsc.frequency.linearRampToValueAtTime(leadNote, now + 3.8);

      leadGain.gain.setValueAtTime(0.0001, now + 1.2);
      leadGain.gain.linearRampToValueAtTime(0.02, now + 1.8);
      leadGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.2);

      leadOsc.connect(leadGain);
      leadGain.connect(this.musicGain);
      leadOsc.start(now + 1.2);
      leadOsc.stop(now + 4.4);
    }
  }

  private startAmbientBirds(): void {
    if (this.birdInterval) return;
    this.birdInterval = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || Math.random() > 0.45) return;
      this.playBirdChirp();
    }, 5500);
  }

  private playBirdChirp(): void {
    if (!this.ctx || !this.ambientGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200 + Math.random() * 600, now);
    osc.frequency.exponentialRampToValueAtTime(3100 + Math.random() * 500, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.16);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.025, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ambientGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Rewarding Bullseye Hit Bell Chime
  playBullseyeBell(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    [880, 1320, 1760].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.12 / (idx + 1), now + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.8);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.85);
    });
  }

  // Rewarding Coin Clink / Cash Register Chime
  playCoinClink(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    [1950, 2480, 3100].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.2, now + idx * 0.04 + 0.1);

      gain.gain.setValueAtTime(0.001, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.04 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.45);
    });
  }

  // Contract Completion Fanfare
  playContractComplete(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880]; // A major triumph

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);

      gain.gain.setValueAtTime(0.001, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.14, now + i * 0.12 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 1.2);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 1.3);
    });
  }

  // Tactile UI Click Sound
  playUIClick(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.04);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playFootstep(surface: 'grass' | 'mud' | 'dirt' | 'rock' | 'wood' | 'water' | 'snow', intensity: number = 0.5): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const freqMap: Record<string, number> = {
      grass: 120,
      mud: 85,
      dirt: 105,
      rock: 190,
      wood: 165,
      water: 95,
      snow: 220
    };

    const freq = freqMap[surface] || 120;
    osc.type = surface === 'water' ? 'sine' : surface === 'snow' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq + Math.random() * 20, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.06);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.05 * intensity, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playBowRelease(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Gunfire: Rifle Shot (.30-30 Winchester)
  playRifleShot(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.45, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.045));
    }
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1100, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(250, now + 0.25);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.42, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noiseSrc.start(now);

    // Deep sub-bass concussive kick
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);

    oscGain.gain.setValueAtTime(0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Gunfire: Revolver Shot (Colt .45 Peacemaker)
  playRevolverShot(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.3, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.035));
    }
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.36, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noiseSrc.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noiseSrc.start(now);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.14);

    oscGain.gain.setValueAtTime(0.42, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Gunfire: Double-Barrel Shotgun Blast
  playShotgunBlast(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.55, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
    }
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const lowFilter = this.ctx.createBiquadFilter();
    lowFilter.type = 'lowpass';
    lowFilter.frequency.setValueAtTime(1600, now);
    lowFilter.frequency.exponentialRampToValueAtTime(140, now + 0.4);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    noiseSrc.connect(lowFilter);
    lowFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noiseSrc.start(now);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.35);

    oscGain.gain.setValueAtTime(0.6, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  // Melee Knife Slash
  playKnifeSlash(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Weapon Reload Mechanics Audio
  playReloadSound(weaponType: string): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(560, now);
    osc1.frequency.exponentialRampToValueAtTime(300, now + 0.05);

    gain1.gain.setValueAtTime(0.09, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(now);
    osc1.stop(now + 0.07);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(700, now + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(440, now + 0.19);

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.1, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.23);
  }

  playEmptyClick(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.03);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playAimBreath(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.linearRampToValueAtTime(150, now + 0.18);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  playArrowImpact(isFlesh: boolean): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isFlesh ? 'triangle' : 'square';
    osc.frequency.setValueAtTime(isFlesh ? 230 : 480, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playCrimeAlarm(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.linearRampToValueAtTime(920, now + 0.15);
    osc.frequency.linearRampToValueAtTime(680, now + 0.3);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.36);
  }
}

