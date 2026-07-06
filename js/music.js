// Tiny chiptune engine — two-voice patterns scheduled on WebAudio.
// The browser only lets audio start after a user gesture, so Music.init()
// is called from the first click. N toggles mute.

const MUSIC_TRACKS = {
  // Peaceful Aegean: slow lyre-like arpeggios over a gentle bass swell.
  calm: {
    bpm: 82, wave: "triangle", bassWave: "sine", vol: 0.045, bassVol: 0.05,
    melody: [69, 0, 72, 0, 74, 0, 76, 0, 74, 0, 72, 0, 69, 0, 64, 0,
             67, 0, 69, 0, 72, 0, 69, 0, 67, 0, 64, 0, 62, 0, 0, 0],
    bass:   [45, 0, 0, 0, 52, 0, 0, 0, 50, 0, 0, 0, 45, 0, 0, 0,
             43, 0, 0, 0, 50, 0, 0, 0, 47, 0, 0, 0, 43, 0, 0, 0],
  },
  // War on the water: driving minor riff, urgent bass.
  battle: {
    bpm: 148, wave: "square", bassWave: "sawtooth", vol: 0.03, bassVol: 0.035,
    melody: [62, 0, 65, 62, 68, 65, 62, 60, 62, 0, 65, 62, 70, 68, 65, 62,
             60, 0, 63, 60, 67, 63, 60, 58, 60, 62, 63, 65, 67, 68, 70, 72],
    bass:   [38, 38, 0, 38, 38, 0, 38, 0, 38, 38, 0, 38, 41, 0, 41, 0,
             36, 36, 0, 36, 36, 0, 36, 0, 39, 39, 0, 39, 43, 0, 41, 0],
  },
};

const Music = {
  ctx: null,
  gain: null,
  track: null,
  muted: false,
  step: 0,
  nextTime: 0,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 1;
    this.gain.connect(this.ctx.destination);
    this.nextTime = this.ctx.currentTime + 0.1;
    setInterval(() => this.tick(), 80);
  },

  setTrack(name) {
    if (name === this.track) return;
    this.track = name;
    this.step = 0;
    if (this.ctx) this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.05);
  },

  toggle() {
    this.muted = !this.muted;
  },

  tick() {
    if (!this.ctx || !this.track || this.muted) {
      if (this.ctx) this.nextTime = this.ctx.currentTime + 0.1;
      return;
    }
    const tr = MUSIC_TRACKS[this.track];
    if (!tr) return;
    const stepDur = 60 / tr.bpm / 2; // eighth notes
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const i = this.step % tr.melody.length;
      if (tr.melody[i]) this.note(tr.melody[i], this.nextTime, stepDur * 0.9, tr.wave, tr.vol);
      if (tr.bass[i]) this.note(tr.bass[i], this.nextTime, stepDur * 1.7, tr.bassWave, tr.bassVol);
      // Sporadic maritime flair: now and then a lyre run drifts across
      // the calm, in the phrygian dominant mode of the eastern sea.
      if (this.track === "calm" && this.step % 96 === 64 && Math.random() < 0.65) {
        this.flourish(this.nextTime);
      }
      this.nextTime += stepDur;
      this.step++;
    }
  },

  flourish(when) {
    const runs = [
      [76, 77, 81, 83, 81, 77, 76],       // rise and fall on the lyre
      [69, 72, 76, 81, 84],               // an open arpeggio climbing away
      [88, 86, 83, 81, 80, 77],           // high and falling, like a gull
      [64, 65, 68, 69, 72, 69, 68, 65],   // low phrygian turn, oars in time
    ];
    const run = runs[Math.floor(Math.random() * runs.length)];
    const sp = 0.09 + Math.random() * 0.03;
    run.forEach((m, i) => {
      this.note(m, when + i * sp, sp * 2, "triangle", 0.032);
    });
  },

  note(midi, when, dur, wave, vol) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(g);
    g.connect(this.gain);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  },
};
