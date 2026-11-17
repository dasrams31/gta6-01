// audio.js — all sound in Neon Bay is synthesized live with WebAudio.
// No audio files: engine hum, sirens, gunshots, punches, pickups and a bass
// groove are built from oscillators and filtered noise.
export class AudioEngine {
  constructor() {
    this.ctx = null; this.muted = false; this.musicTimer = null;
    this.engineOsc = null; this.engineGain = null; this.sirenOn = false;
    this.sirenOsc = null; this.sirenGain = null; this.musicStep = 0;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { this.ctx = null; }
    if (!this.ctx) return;
    // Engine hum: two detuned saws through a low-pass, gain follows speed.
    this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
    const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 58;
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
    const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 320;
    this.engineOsc.connect(filt); o2.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start(); o2.start(); this.engineOsc2 = o2;
    // Police siren: alternating two-tone triangle.
    this.sirenOsc = this.ctx.createOscillator(); this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.ctx.destination);
    this.sirenOsc.start();
    this.startMusic();
  }
  setMuted(m) { this.muted = m; if (this.ctx) this.ctx.destination.gain ? null : null; if (this.engineGain) this.engineGain.gain.value = m ? 0 : this.engineGain.gain.value; }
  setEngine(speed01, on) {
    if (!this.ctx || !this.engineOsc) return;
    const target = this.muted ? 0 : (on ? 0.02 + speed01 * 0.05 : 0);
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, this.ctx.currentTime, 0.1);
    if (this.engineOsc2) this.engineOsc2.frequency.setTargetAtTime(53 + speed01 * 130, this.ctx.currentTime, 0.1);
  }
  setSiren(on) {
    if (!this.ctx || !this.sirenOsc) return;
    this.sirenOn = on;
    this.sirenGain.gain.setTargetAtTime(this.muted || !on ? 0 : 0.035, this.ctx.currentTime, 0.2);
  }
  sirenTick(time) {
    if (!this.ctx || !this.sirenOn) return;
    this.sirenOsc.frequency.value = (Math.floor(time / 350) % 2 === 0) ? 720 : 960;
  }
  blip(freq, dur, type = 'sine', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur);
  }
  noise(dur, vol = 0.2, filterFreq = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(filt); filt.connect(g); g.connect(this.ctx.destination); src.start(t);
  }
  shot() { this.noise(0.14, 0.25, 3000); this.blip(160, 0.08, 'square', 0.08); }
  punch() { this.noise(0.08, 0.18, 500); }
  crash() { this.noise(0.3, 0.3, 700); }
  pickup() { this.blip(880, 0.1, 'sine', 0.14); setTimeout(() => this.blip(1320, 0.14, 'sine', 0.14), 90); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.16), i * 110)); }
  busted() { [400, 350, 300, 200].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.12), i * 160)); }
  startMusic() {
    if (this.musicTimer) return;
    // A slow neon bass groove: roots walk Am – F – C – G, one step per 240 ms.
    const roots = [55, 43.65, 65.41, 49];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const bar = Math.floor(this.musicStep / 8) % 4;
      const step = this.musicStep % 8;
      if (step === 0 || step === 3 || step === 6) this.blip(roots[bar] * 2, 0.22, 'triangle', 0.05);
      if (step === 4) this.blip(roots[bar] * 3, 0.1, 'sine', 0.03);
      this.musicStep++;
    }, 240);
  }
}
