// Mario-style chiptune audio for the whole game: the menus, the characters, a theme
// per world, ambience, and every gameplay event. Everything is SYNTHESIZED live with
// the Web Audio API out of NES-style voices (pulse / triangle / noise), so the game
// ships zero audio files and stays fully self-contained (nothing to download,
// nothing extra in Git LFS).
//
// Wiring is deliberately light-touch. main.js only creates it and calls setScene()
// when a world is built or the start menu opens; everything else is picked up
// passively, so no other module had to change:
//   - gameplay: the 'rl-snapshot' frames are diffed (coins, "?" blocks, warps,
//     plant / spike / Goomba deaths, Banzai Bills, flag captures, weapons ...),
//     deduped per sim step (grid rounds) or per event id (arena rounds)
//   - UI: delegated click / hover / slider listeners, plus ONE MutationObserver on
//     the class names the UI already toggles (panel open, iris, award banner ...)
// M cycles the sound mode: everything -> sound effects only -> muted (also the
// "M Sound" hint in the in-game key row and the speaker button on the start menu).
//
// createEngine() is context-agnostic, so the same voices can also render into an
// OfflineAudioContext (handy for checking levels without a speaker).

// ------------------------------------------------------------------ pitch helpers
const NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function midiOf(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) return null;
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + NOTE_BASE[m[1]] + acc;
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const hz = (n) => (typeof n === "number" ? n : mtof(midiOf(n)));

// chord symbol -> { root pitch class, intervals }
const QUALITY = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  7: [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  6: [0, 4, 7, 9],
  dim: [0, 3, 6, 9],
  sus4: [0, 5, 7],
};
function parseChord(sym) {
  const m = /^([A-G])(#|b)?(.*)$/.exec(sym);
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return {
    sym,
    root: (NOTE_BASE[m[1]] + acc + 12) % 12,
    iv: QUALITY[m[3]] || QUALITY[""],
  };
}
const inChord = (chord, midi) =>
  chord.iv.some((i) => (chord.root + i) % 12 === ((midi % 12) + 12) % 12);

// ------------------------------------------------------------------ the music
// Original chiptune themes, one per world (written for this game, in the spirit of
// the Mario soundtracks rather than copies of them). Each is a loop of bars:
//   chords  one or two chord symbols per bar (two = half a bar each)
//   lead    melody tokens NOTE[:steps] or -[:steps] (rest), bars split by "|"
//   bass / arp / stab / pad   accompaniment generated from the chords by style
//   drums   one character per step: x = hit, o = soft hit, . = rest
// spb = steps per beat (2 = eighth notes), bar = steps per bar.
export const SONGS = {
  // Start menu: bright, bouncy C major.
  menu: {
    bpm: 144, spb: 2, bar: 8, swing: 0.08,
    chords: "C | Am | F | G | C | Am | Dm G | C | F | G | Em | Am | Dm | G | C | G7",
    lead: `-:1 G4 C5 E5 -:1 G5:2 E5 | -:1 A4 C5 E5 -:1 A5:2 G5 | F5 E5 F5 A5:2 G5 F5:2 | G5:3 D5 B4:2 G4:2 |
           -:1 G4 C5 E5 -:1 G5:2 C6 | B5 A5 E5 C5 -:1 A5:2 G5 | F5 E5 D5 F5 G5:2 B4 D5 | C5:3 -:1 E5 F5 G5 A5 |
           C6:2 A5 F5 -:1 A5:2 C6 | B5:2 G5 D5 -:1 G5:2 B5 | B5 A5 G5 E5 G5:2 E5:2 | A5:3 C6 E6:2 C6:2 |
           D6 C6 A5 F5 D5:2 F5 A5 | G5:2 F5 D5 B4:2 D5 F5 | E5:2 G5 C6 -:1 C6 B5 C6 | D6:2 B5 G5 F5 D5 B4 G4`,
    leadInst: "lead", leadAlt: "lead25", harm: true,
    bass: "bounce", arp: "up", arpAlt: "down",
    drums: { k: "x...x...", s: "..x...x.", h: "xoxoxoxo" },
    fill: { s: "..x.xxxx" }, crash: true,
  },
  // Round 1, Peach's Castle: a regal little waltz in F, harp arpeggios.
  peach: {
    bpm: 116, spb: 2, bar: 6, swing: 0,
    chords: "F | C | Dm | Bb | F | Gm | C7 | F | Bb | C | Am | Dm | Gm | C | F | C7",
    lead: `C5:2 F5:2 A5:2 | G5:3 F5 E5:2 | F5:2 D5:2 A4:2 | Bb4:4 D5:2 |
           C5:2 A5:2 C6:2 | Bb5:3 A5 G5:2 | E5:2 G5:2 Bb5:2 | A5:6 |
           D6:2 Bb5:2 F5:2 | E5:2 G5:2 C6:2 | E6:3 D6 C6:2 | F5:4 A5:2 |
           G5:2 Bb5:2 D6:2 | C6:3 Bb5 G5:2 | A5:2 F5:2 C5:2 | E5:2 G5 Bb5 C6:2`,
    leadInst: "flute", leadAlt: "lead25", harm: true,
    bass: "waltz", arp: "harp", arpAlt: "harp2", arpInst: "bell",
    stab: { steps: [2, 4], inst: "stab" },
    drums: { h: "..o.o." },
  },
  // Round 2, New Donk City: swing big band in Bb, walking bass.
  city: {
    bpm: 152, spb: 2, bar: 8, swing: 0.3,
    chords: "Bb6 | G7 | Cm7 | F7 | Bb6 | G7 | Cm7 F7 | Bb6 | Eb6 | Edim | Bb6 | G7 | C7 | F7 | Bb6 | F7",
    lead: `D5:2 F5 G5 -:1 F5 D5:2 | -:1 B4 D5 F5 G5:2 F5:2 | Eb5:2 G5 Bb5 -:1 G5 Eb5:2 | F5:3 Eb5 C5:2 A4:2 |
           D5:2 F5 G5 -:1 Bb5:2 G5 | -:1 B5 A5 G5 F5:2 D5:2 | Eb5 F5 G5 Bb5 A5:2 F5:2 | Bb5:4 -:2 F5 G5 |
           Bb5:2 G5 Eb5 -:1 C6:2 Bb5 | -:1 G5 Bb5 Db6 -:1 Bb5:2 G5 | F5:2 D5 Bb4 -:1 D5 F5 G5 | B5:3 A5 G5:2 F5:2 |
           E5 G5 Bb5 C6 -:1 Bb5 G5:2 | A5:2 F5 C5 Eb5:2 C5:2 | D5:2 F5 Bb5 -:1 G5:2 F5 | -:1 Eb5 D5 C5 A4 C5 Eb5 F5`,
    leadInst: "brass", leadAlt: "lead", harm: true,
    bass: "walk", stab: { steps: [3, 7], inst: "stab" },
    drums: { k: "o...o...", b: "..x...x.", h: "x.xxx.xx" },
    fill: { b: "..x.x.xx" },
  },
  // Round 3, Fossil Falls: a driving adventure theme in D.
  fossil: {
    bpm: 168, spb: 2, bar: 8, swing: 0,
    chords: "D | C | G | D | D | C | G | A | Bm | G | D | A | Bm | G | Em | A",
    lead: `A4 D5 F#5 A5:2 F#5 A5 B5 | C6:2 B5 A5 G5:2 E5:2 | D5 G5 B5 D6:2 B5 G5 B5 | A5:4 -:2 F#5 G5 |
           A5:2 F#5 D5 -:1 A5 B5 C6 | C6:2 E6 D6 C6:2 G5:2 | B5:2 D6 B5 G5:2 A5 B5 | C#6:3 A5 E5:2 -:2 |
           F#5:2 B5 D6 F#6:2 D6:2 | D6 B5 G5 B5 D6:2 G6:2 | F#6:3 E6 D6:2 A5:2 | C#6:2 E6 C#6 A5:2 E5:2 |
           D6:2 F#6 D6 B5:2 F#5:2 | G5 B5 D6 G6 F#6:2 E6:2 | E6:2 B5 G5 E5:2 G5 B5 | A5:2 C#6 E6 A5:2 -:2`,
    leadInst: "lead", leadAlt: "lead25", harm: true,
    bass: "drive", arp: "up", arpAlt: "roll",
    drums: { k: "x..xx...", s: "..x...x.", h: "xoxoxoxo" },
    fill: { s: "..x.xxxx" }, crash: true,
  },
  // Round 4, Ruined Kingdom: dark and ominous in D minor.
  ruined: {
    bpm: 104, spb: 2, bar: 8, swing: 0,
    chords: "Dm | Dm | Bb | A | Dm | Gm | Bb A | Dm | Gm | Dm | Eb | A | Bb | Gm | A7 | A",
    lead: `D5:4 F5:2 E5:2 | D5:2 A4:4 -:2 | Bb4:2 D5:2 F5:3 E5 | C#5:6 -:2 |
           A5:4 G5:2 F5:2 | G5:3 F5 D5:4 | D5:2 F5:2 E5:4 | D5:6 -:2 |
           Bb5:4 A5:2 G5:2 | F5:3 E5 D5:2 A4:2 | Eb5:4 G5:2 Bb5:2 | C#6:4 Bb5:2 A5:2 |
           D6:4 C6:2 Bb5:2 | Bb5:3 A5 G5:4 | A5:2 G5:2 F5:2 E5:2 | C#5:4 E5:2 A5:2`,
    leadInst: "eerie", leadAlt: "flute",
    bass: "menace", pad: true,
    drums: { k: "x..x....", t: "....x...", h: ".o.o.o.o" },
    fill: { t: "x.x.xxxx" },
  },
  // Round 5, Dry Dry Desert: mariachi trumpets in A minor, castanets.
  desert: {
    bpm: 132, spb: 2, bar: 8, swing: 0,
    chords: "Am | Am | Dm | E | Am | G | F | E | Am | Dm | G | C | F | Dm | E | E7",
    lead: `E5:3 A5:3 C6:2 | B5 A5 G#5 A5 E5:4 | F5:3 A5:3 D6:2 | C6 B5 G#5 B5 E5:4 |
           A5:3 C6:3 E6:2 | D6 C6 B5 D6 G5:4 | C6 A5 F5 A5 C6:2 B5 A5 | G#5:4 B5:2 E5:2 |
           E6:3 C6:3 A5:2 | D6:3 F6:3 E6 D6 | D6 B5 G5 B5 D6:4 | E6:3 C6:3 G5:2 |
           A5 C6 F6 E6 D6:2 C6:2 | D6:3 C6 B5 A5 F5:2 | E5 F5 G#5 A5 B5 C6 B5 A5 | G#5:4 -:2 E5:2`,
    leadInst: "trumpet", leadAlt: "lead", harm: true,
    bass: "tresillo", stab: { steps: [2, 4, 7], inst: "guitar" },
    drums: { k: "x..x..x.", r: "x.xx.xx.", h: "oooooooo" },
    fill: { r: "xxxxxxxx" },
  },
  // Final standings: a celebration march in G.
  final: {
    bpm: 150, spb: 2, bar: 8, swing: 0,
    chords: "G | D | Em | C | G | D | C D | G",
    lead: `G5:2 B5 D6 G6:2 D6:2 | F#6:2 E6 D6 A5:2 D6:2 | E6:2 D6 B5 G5:2 B5:2 | C6:3 B5 A5:2 G5 E5 |
           D5 G5 B5 D6 G6:3 F#6 | E6 F#6 E6 D6 A5:2 F#5:2 | E5 G5 C6 E6 D6 C6 A5 F#5 | G5:4 D6:2 -:2`,
    leadInst: "brass", leadAlt: "lead", harm: true,
    bass: "march", arp: "up",
    drums: { k: "x...x...", s: "..x.x.xx", h: "xxxxxxxx" },
    fill: { s: "xxxxxxxx" }, fillEvery: 4, crash: true,
  },
};

// bass patterns: [step in bar, tone, length]; tone = R(oot) 3 5 8(ve) or a
// semitone offset from the root
const BASS = {
  bounce: [[0, "R", 2], [2, "5", 2], [4, "R", 2], [6, "5", 1], [7, "3", 1]],
  march: [[0, "R", 2], [2, "5", 2], [4, "R", 2], [6, "5", 2]],
  drive: [[0, "R", 1], [1, "R", 1], [2, "8", 1], [3, "R", 1], [4, "5", 1], [5, "R", 1], [6, "8", 1], [7, "5", 1]],
  waltz: [[0, "R", 2]],
  tresillo: [[0, "R", 3], [3, "5", 3], [6, "8", 2]],
  menace: [[0, 0, 1], [1, 0, 1], [2, 3, 1], [3, 0, 1], [4, 2, 1], [5, 0, 1], [6, -1, 1], [7, 0, 1]],
};
// arpeggio orders over [root, 3rd, 5th, octave]
const ARP = {
  up: [0, 1, 2, 3, 2, 1, 0, 1],
  down: [3, 2, 1, 0, 1, 2, 3, 2],
  roll: [0, 1, 2, 3, 0, 1, 2, 3],
  harp: [0, 1, 2, 3, 2, 1],
  harp2: [0, 2, 3, 1, 2, 3],
};

function bassMidi(chord, spec) {
  const base = 40 + ((chord.root - 4 + 12) % 12); // E2..D#3
  if (spec === "R") return base;
  if (spec === "3") return base + chord.iv[1];
  if (spec === "5") return base + 7;
  if (spec === "8") return base + 12;
  return base + spec;
}

// A chord tone 3-9 semitones under the melody: an automatic, always-consonant
// second voice for the held melody notes.
function harmBelow(midi, chord) {
  for (let d = 3; d <= 9; d++) if (inChord(chord, midi - d)) return midi - d;
  return null;
}

export function compileSong(def) {
  const B = def.bar;
  const bars = def.chords.split("|").map((b) => b.trim().split(/\s+/).map(parseChord));
  const len = bars.length * B;
  const chordAt = [];
  for (const cs of bars)
    for (let i = 0; i < B; i++)
      chordAt.push(cs[Math.min(cs.length - 1, Math.floor((i * cs.length) / B))]);
  const ev = Array.from({ length: len }, () => []);
  const add = (step, e) => ev[((step % len) + len) % len].push(e);
  const barErrors = [];

  // melody (+ the automatic harmony under held notes)
  let st = 0;
  def.lead.split("|").forEach((bar, bi) => {
    const start = st;
    for (const tok of bar.trim().split(/\s+/).filter(Boolean)) {
      const [n, l] = tok.split(":");
      const L = Number(l || 1);
      if (n !== "-") {
        const midi = midiOf(n);
        if (midi == null) barErrors.push(`bad note ${tok} in bar ${bi + 1}`);
        add(st, { p: "lead", midi, len: L });
        if (def.harm && L >= 2) {
          const h = harmBelow(midi, chordAt[st % len]);
          if (h != null) add(st, { p: "harm", midi: h, len: L });
        }
      }
      st += L;
    }
    if (st - start !== B) barErrors.push(`bar ${bi + 1} is ${st - start} steps, not ${B}`);
  });
  if (st !== len) barErrors.push(`melody is ${st} steps, chords are ${len}`);

  for (let b = 0; b < bars.length; b++) {
    const b0 = b * B;
    // bass
    if (def.bass === "walk") {
      const two = bars[b].length > 1;
      const c0 = chordAt[b0], c1 = chordAt[b0 + B / 2];
      const next = chordAt[(b0 + B) % len];
      const nr = bassMidi(next, "R");
      const plan = two
        ? [[0, bassMidi(c0, "R")], [2, bassMidi(c0, "5")], [4, bassMidi(c1, "R")]]
        : [[0, bassMidi(c0, "R")], [2, bassMidi(c0, "3")], [4, bassMidi(c0, "5")]];
      const prev = plan[plan.length - 1][1];
      plan.push([6, nr + (nr > prev ? -1 : 1)]); // chromatic approach into the next bar
      for (const [s, m] of plan) add(b0 + s, { p: "bass", midi: m, len: 2 });
    } else if (BASS[def.bass]) {
      for (const [s, spec, l] of BASS[def.bass])
        if (s < B) add(b0 + s, { p: "bass", midi: bassMidi(chordAt[b0 + s], spec), len: l });
    }
    // arpeggio (both orders are compiled; playback picks one per loop pass)
    for (const [key, alt] of [[def.arp, false], [def.arpAlt, true]]) {
      if (!ARP[key]) continue;
      const order = ARP[key];
      for (let i = 0; i < B; i++) {
        const c = chordAt[b0 + i];
        const base = 60 + c.root; // C4..B4
        const tones = [base + c.iv[0], base + c.iv[1], base + c.iv[2], base + 12];
        add(b0 + i, { p: "arp", midi: tones[order[i % order.length]], len: 1, alt });
      }
    }
    // chord stabs
    if (def.stab)
      for (const s of def.stab.steps) {
        if (s >= B) continue;
        const c = chordAt[b0 + s];
        const base = 55 + ((c.root - 7 + 12) % 12); // G3..F#4
        const notes = [base + c.iv[1], base + c.iv[2], base + (c.iv[3] ?? 12)];
        add(b0 + s, { p: "stab", notes, len: 1, inst: def.stab.inst });
      }
    // sustained pad on every chord change
    if (def.pad)
      for (let i = 0; i < B; i++) {
        const c = chordAt[b0 + i];
        if (i > 0 && chordAt[b0 + i - 1] === c) continue;
        let l = 1;
        while (i + l < B && chordAt[b0 + i + l] === c) l++;
        const base = 50 + ((c.root - 2 + 12) % 12); // D3..C#4
        add(b0 + i, { p: "pad", notes: c.iv.slice(0, 3).map((x) => base + x), len: l });
      }
    // drums (with a fill on the last bar of each phrase)
    if (def.drums) {
      const every = def.fillEvery || 8;
      const pats = def.fill && b % every === every - 1 ? { ...def.drums, ...def.fill } : def.drums;
      for (const [d, pat] of Object.entries(pats))
        for (let i = 0; i < B && i < pat.length; i++)
          if (pat[i] === "x" || pat[i] === "o")
            add(b0 + i, { p: "drum", d, vel: pat[i] === "x" ? 1 : 0.45 });
    }
  }
  if (def.crash) add(0, { p: "drum", d: "c", vel: 1 });
  return { def, len, ev, stepDur: 60 / def.bpm / def.spb, errors: barErrors };
}

// ------------------------------------------------------------------ the engine
const MAX_VOICES = 90; // sfx voice cap (music always plays)

export function createEngine(ctx) {
  // master chain: out -> gentle compressor -> speakers
  const out = ctx.createGain();
  out.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  out.connect(comp);
  comp.connect(ctx.destination);
  const MUSIC_VOL = 0.36;
  const music = ctx.createGain();
  music.gain.value = MUSIC_VOL;
  const duck = ctx.createGain(); // the award banner briefly ducks the music
  duck.connect(music);
  music.connect(out);
  const sfx = ctx.createGain();
  sfx.gain.value = 0.85;
  sfx.connect(out);
  const amb = ctx.createGain();
  amb.gain.value = 1;
  amb.connect(out);

  // NES-style pulse waves (12.5 / 25 / 50 % duty) as band-limited PeriodicWaves
  const pulse = (duty) => {
    const N = 48;
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) {
      re[n] = Math.sin(2 * Math.PI * n * duty) / (Math.PI * n);
      im[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (Math.PI * n);
    }
    return ctx.createPeriodicWave(re, im);
  };
  const waves = { p12: pulse(0.125), p25: pulse(0.25), p50: pulse(0.5) };

  // white noise + the NES "short mode" metallic noise (a 93-step LFSR loop)
  const sr = ctx.sampleRate;
  const noiseBuf = ctx.createBuffer(1, sr, sr);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < sr; i++) nd[i] = Math.random() * 2 - 1;
  const metalBuf = ctx.createBuffer(1, sr, sr);
  const md = metalBuf.getChannelData(0);
  let lfsr = 1, level = 0.8;
  const hold = Math.max(1, Math.round(sr / 9000));
  for (let i = 0; i < sr; i++) {
    if (i % hold === 0) {
      const bit = (lfsr ^ (lfsr >> 6)) & 1;
      lfsr = (lfsr >> 1) | (bit << 14);
      level = lfsr & 1 ? 0.8 : -0.8;
    }
    md[i] = level;
  }

  let voices = 0;
  let target = sfx; // where a one-shot's voices go (play() may point it at a panner)

  // attack -> (optional decay to a sustain fraction) -> release envelope
  function env(p, t, a, d, r, v, s, dk) {
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(v, t + a);
    if (s != null && s < 1) p.setTargetAtTime(v * s, t + a, dk ?? 0.08);
    p.setTargetAtTime(0, t + Math.max(d, a), Math.max(0.004, r / 4));
  }

  function finish(src, nodes, o, t, end) {
    let node = nodes[nodes.length - 1];
    if (o.trem) {
      const tg = ctx.createGain();
      const depth = o.td ?? 0.5;
      tg.gain.value = 1 - depth / 2;
      const l = ctx.createOscillator();
      l.frequency.value = o.trem;
      const lg = ctx.createGain();
      lg.gain.value = depth / 2;
      l.connect(lg);
      lg.connect(tg.gain);
      l.start(t);
      l.stop(end);
      node.connect(tg);
      node = tg;
    }
    if (o.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      node.connect(p);
      node = p;
    }
    node.connect(o.bus || target);
    src.start(t, src.buffer ? Math.random() * 0.9 : undefined);
    src.stop(end);
    voices++;
    src.onended = () => {
      voices--;
      for (const n of nodes) {
        try {
          n.disconnect();
        } catch (e) {
          /* already gone */
        }
      }
    };
  }

  // one oscillator voice. w = p12|p25|p50|triangle|sine|sawtooth, f -> f2 slide,
  // v volume, a/d/r envelope, s/dk decay, vib/vr/vd vibrato, lp lowpass, trem tremolo
  function tone(o) {
    const now = ctx.currentTime;
    const t = Math.max(o.t ?? now, now);
    if (!o.bus && voices > MAX_VOICES) return;
    const d = o.d ?? 0.1, a = o.a ?? 0.004, r = o.r ?? 0.03, v = o.v ?? 0.1;
    const end = t + Math.max(d, a) + r * 1.4 + 0.03;
    const osc = ctx.createOscillator();
    const w = o.w || "p50";
    if (waves[w]) osc.setPeriodicWave(waves[w]);
    else osc.type = w;
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.sl ?? d));
    if (o.det) osc.detune.setValueAtTime(o.det, t);
    if (o.vib) {
      const l = ctx.createOscillator();
      l.frequency.value = o.vr ?? 5.6;
      const lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(o.f * o.vib, t + (o.vd ?? 0.1) + 0.05);
      l.connect(lg);
      lg.connect(osc.frequency);
      l.start(t);
      l.stop(end);
    }
    const nodes = [osc];
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(o.lp, t);
      f.Q.value = o.lq ?? 0.7;
      osc.connect(f);
      nodes.push(f);
    }
    const g = ctx.createGain();
    env(g.gain, t, a, d, r, v, o.s, o.dk);
    nodes[nodes.length - 1].connect(g);
    nodes.push(g);
    finish(osc, nodes, o, t, end);
  }

  // one filtered-noise voice (ft = lowpass|highpass|bandpass, f -> f2 sweep)
  function noise(o) {
    const now = ctx.currentTime;
    const t = Math.max(o.t ?? now, now);
    if (!o.bus && voices > MAX_VOICES) return;
    const d = o.d ?? 0.1, a = o.a ?? 0.002, r = o.r ?? 0.03, v = o.v ?? 0.1;
    const end = t + Math.max(d, a) + r * 1.4 + 0.03;
    const src = ctx.createBufferSource();
    src.buffer = o.metal ? metalBuf : noiseBuf;
    src.loop = true;
    if (o.rate) src.playbackRate.setValueAtTime(o.rate, t);
    const f = ctx.createBiquadFilter();
    f.type = o.ft || "lowpass";
    f.frequency.setValueAtTime(o.f ?? 8000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.sl ?? d));
    f.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    env(g.gain, t, a, d, r, v, o.s, o.dk);
    src.connect(f);
    f.connect(g);
    finish(src, [src, f, g], o, t, end);
  }

  // a run of notes: [[note, seconds, extra?], ...] -> returns the end time
  function seq(t, notes, o = {}) {
    let tt = t;
    for (const [n, du, extra] of notes) {
      if (n !== "-")
        tone({ ...o, ...extra, f: hz(n), t: tt, d: du * (o.gate ?? 0.85) });
      tt += du;
    }
    return tt;
  }

  // ---------------------------------------------------------------- one-shots
  const S = {};
  const bell = (n, t, v, dk = 0.3) => {
    tone({ w: "sine", f: hz(n), t, d: dk * 4, v, s: 0, dk });
    tone({ w: "sine", f: hz(n) * 2, t, d: dk * 2, v: v * 0.25, s: 0, dk: dk * 0.4 });
  };
  const roll = (t, dur, v0, v1, gap = 0.042) => {
    const n = Math.max(1, Math.round(dur / gap));
    for (let i = 0; i < n; i++)
      noise({ t: t + i * gap, d: 0.03, v: v0 + ((v1 - v0) * i) / n, ft: "bandpass", f: 2100, q: 0.8 });
  };
  const crash = (t, v = 0.08) => noise({ t, d: 1.2, v, ft: "highpass", f: 3800, s: 0, dk: 0.4 });

  // --- UI
  S.hover = (t) => tone({ w: "p12", f: 1975, t, d: 0.016, v: 0.07, r: 0.01 });
  S.tick = (t) => tone({ w: "p25", f: 1568, t, d: 0.02, v: 0.07, r: 0.01 });
  S.select = (t) => seq(t, [["A5", 0.04], ["E6", 0.075]], { w: "p50", v: 0.065, gate: 1, r: 0.04 });
  S.confirm = (t) => {
    seq(t, [["C6", 0.04], ["G6", 0.04], ["C7", 0.1]], { w: "p50", v: 0.06, gate: 1, r: 0.06 });
    tone({ w: "triangle", f: hz("C5"), t, d: 0.16, v: 0.12 });
  };
  S.back = (t) => seq(t, [["E6", 0.04], ["A5", 0.08]], { w: "p50", v: 0.06, gate: 1, r: 0.04 });
  S.tab = (t) => {
    tone({ w: "p25", f: 1318, t, d: 0.022, v: 0.05, r: 0.01 });
    tone({ w: "p25", f: 1760, t: t + 0.03, d: 0.03, v: 0.04, r: 0.02 });
  };
  S.toggle = (t, o = {}) =>
    seq(t, o.off ? [["G6", 0.035], ["C6", 0.06]] : [["C6", 0.035], ["G6", 0.06]], { w: "p25", v: 0.055, gate: 1 });
  S.slide = (t, o = {}) =>
    tone({ w: "p12", f: 520 + 1300 * (o.p ?? 0.5), t, d: 0.014, v: 0.06, r: 0.008 });
  S.error = (t) => {
    for (const k of [0, 0.12]) {
      tone({ w: "p50", f: 98, t: t + k, d: 0.07, v: 0.1, lp: 1400 });
      tone({ w: "triangle", f: 196, t: t + k, d: 0.07, v: 0.16 });
    }
  };
  S.pause = (t) => seq(t, [["B5", 0.05], ["F#6", 0.05], ["B6", 0.11]], { w: "p25", v: 0.06, r: 0.05 });
  S.panelOpen = (t) => {
    seq(t, [["E6", 0.04], ["B6", 0.07]], { w: "p25", v: 0.05, gate: 1 });
    noise({ t, d: 0.12, v: 0.035, ft: "bandpass", f: 1500, f2: 4500, q: 1 });
  };
  S.panelClose = (t) => {
    seq(t, [["B6", 0.04], ["E6", 0.07]], { w: "p25", v: 0.045, gate: 1 });
    noise({ t, d: 0.12, v: 0.03, ft: "bandpass", f: 4500, f2: 1400, q: 1 });
  };
  S.menuOpen = (t) => {
    noise({ t, d: 0.28, v: 0.055, ft: "bandpass", f: 500, f2: 3500, q: 1.2, a: 0.05 });
    seq(t + 0.05, [["G5", 0.05], ["C6", 0.05], ["E6", 0.09]], { w: "p50", v: 0.045 });
  };
  S.menuClose = (t) => {
    noise({ t, d: 0.25, v: 0.045, ft: "bandpass", f: 3500, f2: 500, q: 1.2, a: 0.04 });
    seq(t + 0.04, [["E6", 0.05], ["C6", 0.05], ["G5", 0.08]], { w: "p50", v: 0.04 });
  };
  S.deal = (t) => {
    for (let i = 0; i < 6; i++) {
      noise({ t: t + i * 0.075, d: 0.035, v: 0.08, ft: "highpass", f: 2500 + i * 300 });
      tone({ w: "triangle", f: 700 + i * 90, f2: 1100 + i * 90, t: t + i * 0.075, d: 0.03, v: 0.05 });
    }
  };
  S.card = (t) => {
    noise({ t, d: 0.05, v: 0.09, ft: "highpass", f: 2200, f2: 5000 });
    tone({ w: "triangle", f: 880, f2: 1500, t, d: 0.05, v: 0.08 });
  };
  S.rip = (t) => {
    for (let i = 0; i < 12; i++)
      noise({
        t: t + i * 0.024 + Math.random() * 0.012, d: 0.018, v: 0.05 + Math.random() * 0.07,
        ft: "bandpass", f: 2200 + Math.random() * 2500, q: 1.5,
      });
    S.confirm(t + 0.3);
  };
  S.page = (t) => {
    noise({ t, d: 0.08, v: 0.06, ft: "bandpass", f: 2600, f2: 1100, q: 0.9, a: 0.01 });
    tone({ w: "p25", f: 1175, t: t + 0.04, d: 0.03, v: 0.035 });
  };
  S.sparkle = (t) =>
    ["C7", "G7", "E7", "C8", "G7"].forEach((n, i) =>
      tone({ w: "sine", f: hz(n), t: t + i * 0.05, d: 0.12, v: 0.03, s: 0, dk: 0.06 }));
  S.start = (t) => {
    noise({ t, d: 0.9, v: 0.06, ft: "bandpass", f: 300, f2: 4200, q: 1.1, a: 0.3, r: 0.3 });
    const e = seq(t, [["C5", 0.06], ["E5", 0.06], ["G5", 0.06], ["C6", 0.06], ["E6", 0.06]], { w: "p50", v: 0.065, gate: 0.95 });
    tone({ w: "p50", f: hz("G6"), t: e, d: 0.38, v: 0.065, vib: 0.012, s: 0.7, r: 0.2 });
    tone({ w: "p25", f: hz("E6"), t: e, d: 0.38, v: 0.04, s: 0.7, r: 0.2 });
    tone({ w: "triangle", f: hz("C4"), t: e, d: 0.4, v: 0.18, r: 0.2 });
    S.sparkle(e + 0.1);
  };
  S.cappyFly = (t) => {
    noise({ t, d: 0.55, v: 0.07, ft: "bandpass", f: 600, f2: 3200, q: 1.3, a: 0.15, r: 0.2 });
    for (let i = 0; i < 6; i++)
      tone({ w: "p25", f: i % 2 ? 990 : 1320, t: t + i * 0.06, d: 0.04, v: 0.03 });
    bell("E7", t + 0.42, 0.04, 0.2);
  };
  S.irisClose = (t) => {
    noise({ t, d: 0.75, v: 0.05, ft: "lowpass", f: 4000, f2: 250, a: 0.05, r: 0.2 });
    tone({ w: "p25", f: 880, f2: 196, t, d: 0.6, v: 0.03, r: 0.1 });
  };
  S.irisOpen = (t) => {
    noise({ t, d: 0.7, v: 0.045, ft: "lowpass", f: 250, f2: 4500, a: 0.1, r: 0.2 });
    tone({ w: "p25", f: 196, f2: 880, t, d: 0.55, v: 0.025, r: 0.1 });
  };
  S.nameCard = (t) => {
    for (const [n, k] of [["G5", 0], ["B5", 0.07], ["D6", 0.14], ["G6", 0.21]]) bell(n, t + k, 0.055, 0.32);
    S.sparkle(t + 0.3);
  };
  S.turbo = (t) => {
    tone({ w: "sawtooth", f: 70, f2: 420, sl: 0.8, t, d: 0.85, v: 0.05, lp: 1400, trem: 22, td: 0.6, r: 0.15 });
    noise({ t: t + 0.5, d: 0.5, v: 0.06, ft: "bandpass", f: 600, f2: 5000, q: 1, a: 0.15 });
    for (let i = 0; i < 3; i++)
      tone({ w: "p25", f: 500, f2: 2600, t: t + 0.55 + i * 0.09, d: 0.07, v: 0.035 });
  };
  S.lock = (t) => {
    noise({ t, d: 0.012, v: 0.1, ft: "highpass", f: 3000 });
    tone({ w: "triangle", f: 1900, t, d: 0.02, v: 0.08 });
    noise({ t: t + 0.06, d: 0.015, v: 0.09, ft: "highpass", f: 2000 });
    tone({ w: "triangle", f: 1250, t: t + 0.06, d: 0.03, v: 0.08 });
  };
  S.rewind = (t) => {
    seq(t, [["G6", 0.03], ["E6", 0.03], ["C6", 0.03], ["G5", 0.03], ["E5", 0.03], ["C5", 0.07]], { w: "p25", v: 0.045 });
    noise({ t, d: 0.25, v: 0.03, ft: "bandpass", f: 3000, f2: 800, q: 2 });
  };
  S.tapeIn = (t) => {
    noise({ t, d: 0.02, v: 0.09, ft: "highpass", f: 1500 });
    tone({ w: "p25", f: 300, f2: 1200, t: t + 0.03, d: 0.12, v: 0.04 });
  };
  S.tapeOut = (t) => {
    tone({ w: "p25", f: 1200, f2: 300, t, d: 0.12, v: 0.04 });
    noise({ t: t + 0.12, d: 0.02, v: 0.09, ft: "highpass", f: 1500 });
  };

  // --- gameplay
  S.coin = (t) => {
    tone({ w: "p50", f: hz("B5"), t, d: 0.065, v: 0.085, r: 0.005 });
    tone({ w: "p50", f: hz("E6"), t: t + 0.065, d: 0.45, v: 0.085, s: 0, dk: 0.14, r: 0.05 });
  };
  S.jump = (t, o = {}) =>
    tone({ w: "p25", f: 260, f2: 860, sl: 0.16, t, d: 0.17, v: o.v ?? 0.06, s: 0.6, dk: 0.1, r: 0.04 });
  S.qblock = (t) => {
    tone({ w: "triangle", f: 190, f2: 85, t, d: 0.07, v: 0.22 });
    noise({ t, d: 0.04, v: 0.08, ft: "lowpass", f: 900 });
    seq(t + 0.08, [["C5", 0.035], ["G5", 0.035], ["C6", 0.035], ["E6", 0.07]], { w: "p50", v: 0.045 });
  };
  S.oneUp = (t) =>
    seq(t, [["E5", 0.11], ["G5", 0.11], ["E6", 0.11], ["C6", 0.11], ["D6", 0.11], ["G6", 0.16]], { w: "p50", v: 0.065, gate: 0.9, r: 0.04 });
  S.powerDown = (t) =>
    ["A5", "E5", "A4", "E5", "A4", "E4", "A4", "E4", "A3"].forEach((n, i) =>
      tone({ w: "p50", f: hz(n), t: t + i * 0.045, d: 0.04, v: 0.045 }));
  S.pipe = (t) => {
    for (const k of [0, 0.11, 0.22])
      tone({ w: "p50", f: 620, f2: 150, sl: 0.08, t: t + k, d: 0.085, v: 0.065, r: 0.01, lp: 2500 });
  };
  S.star = (t) => {
    const e = seq(t, [["G5", 0.045], ["B5", 0.045], ["D6", 0.045], ["G6", 0.045]], { w: "p50", v: 0.055, gate: 0.95 });
    tone({ w: "p50", f: hz("B6"), t: e, d: 0.32, v: 0.055, vib: 0.015, vr: 9, s: 0.6, r: 0.12 });
    tone({ w: "p25", f: hz("G6"), t: e, d: 0.32, v: 0.035, s: 0.6, r: 0.12 });
    S.sparkle(e + 0.08);
  };
  S.ghost = (t) => {
    tone({ w: "sine", f: 420, f2: 840, sl: 0.5, t, d: 0.6, v: 0.09, vib: 0.07, vr: 7, a: 0.08, r: 0.2 });
    seq(t + 0.3, [["E6", 0.07], ["D6", 0.07], ["B5", 0.07], ["D6", 0.07], ["B5", 0.12]], { w: "p25", v: 0.035, gate: 0.8, vib: 0.02, vr: 12 });
    ["C6", "E6", "G6", "B6", "D7", "F#7"].forEach((n, i) =>
      tone({ w: "triangle", f: hz(n), t: t + 0.05 + i * 0.05, d: 0.08, v: 0.045, s: 0, dk: 0.05 }));
  };
  S.freeze = (t) => {
    ["D7", "A6", "F6", "D6", "A5"].forEach((n, i) =>
      tone({ w: "triangle", f: hz(n), t: t + i * 0.045, d: 0.1, v: 0.085, s: 0, dk: 0.06 }));
    noise({ t, d: 0.45, v: 0.04, ft: "highpass", f: 5500, a: 0.02, r: 0.2 });
    noise({ t: t + 0.22, d: 0.05, v: 0.13, ft: "bandpass", f: 1300, q: 1.5 });
    tone({ w: "sine", f: 2637, t: t + 0.25, d: 0.5, v: 0.03, s: 0, dk: 0.18 });
  };
  S.chomp = (t) => {
    noise({ t, d: 0.07, v: 0.2, ft: "bandpass", f: 900, q: 1.1 });
    tone({ w: "p50", f: 320, f2: 90, t: t + 0.03, d: 0.12, v: 0.075, lp: 1800 });
    noise({ t: t + 0.16, d: 0.05, v: 0.15, ft: "bandpass", f: 700, q: 1.1 });
    tone({ w: "sine", f: 260, f2: 85, t: t + 0.42, d: 0.2, v: 0.2, r: 0.06 });
  };
  S.spike = (t) => {
    noise({ metal: true, t, d: 0.14, v: 0.05, ft: "highpass", f: 1800, s: 0.2, dk: 0.05 });
    tone({ w: "p50", f: 1480, f2: 900, t, d: 0.05, v: 0.045 });
    tone({ w: "triangle", f: 420, f2: 70, t: t + 0.06, d: 0.2, v: 0.2 });
  };
  S.goombaHit = (t) => {
    tone({ w: "p50", f: 520, f2: 170, t, d: 0.09, v: 0.065, lp: 2200 });
    noise({ t, d: 0.06, v: 0.11, ft: "lowpass", f: 1300 });
    tone({ w: "triangle", f: 180, f2: 60, t: t + 0.04, d: 0.12, v: 0.18 });
  };
  S.lose = (t) => {
    tone({ w: "sine", f: 1050, f2: 240, sl: 0.55, t, d: 0.55, v: 0.065, vib: 0.03, vr: 9 });
    seq(t + 0.58, [["G4", 0.1], ["E4", 0.1], ["C4", 0.16]], { w: "p50", v: 0.055, lp: 2500 });
    tone({ w: "triangle", f: 130, f2: 62, t: t + 0.9, d: 0.3, v: 0.2, r: 0.1 });
  };
  S.skid = (t) => {
    noise({ t, d: 0.22, v: 0.07, ft: "bandpass", f: 2700, f2: 850, q: 2.2, a: 0.01 });
    tone({ w: "p12", f: 2200, f2: 1500, t, d: 0.08, v: 0.016 });
  };
  S.cage = (t) => {
    for (const [f, v, dk] of [[196, 0.06, 0.35], [523, 0.04, 0.25], [932, 0.03, 0.18], [1480, 0.02, 0.1]])
      tone({ w: "sine", f, t, d: 0.9, v, s: 0, dk });
    noise({ metal: true, t, d: 0.05, v: 0.05, ft: "highpass", f: 2500 });
    for (let i = 0; i < 4; i++)
      noise({ metal: true, t: t + 0.08 + i * 0.04, d: 0.02, v: 0.045, ft: "highpass", f: 3500 });
  };
  S.secret = (t) => {
    noise({ t, d: 0.6, v: 0.1, ft: "lowpass", f: 220, a: 0.1, r: 0.25 });
    ["C6", "E6", "G6", "C7"].forEach((n, i) => bell(n, t + 0.15 + i * 0.09, 0.045, 0.2));
    S.sparkle(t + 0.55);
  };
  S.push = (t) => {
    noise({ t, d: 0.18, v: 0.06, ft: "lowpass", f: 300, a: 0.03 });
    tone({ w: "triangle", f: 70, f2: 55, t, d: 0.18, v: 0.11 });
  };
  S.goal = (t) => {
    const e = seq(t, [["C5", 0.05], ["E5", 0.05], ["G5", 0.05], ["C6", 0.05]], { w: "p50", v: 0.045, gate: 0.9 });
    tone({ w: "p50", f: hz("E6"), t: e, d: 0.28, v: 0.045, s: 0.6, r: 0.1, vib: 0.01 });
    tone({ w: "p25", f: hz("G5"), t: e, d: 0.28, v: 0.03, s: 0.6, r: 0.1 });
    tone({ w: "triangle", f: hz("C4"), t: e, d: 0.28, v: 0.13, r: 0.1 });
  };
  S.banzai = (t) => {
    noise({ t, d: 0.55, v: 0.11, ft: "lowpass", f: 220, f2: 1500, a: 0.04, r: 0.2 });
    tone({ w: "sawtooth", f: 62, f2: 48, t, d: 0.5, v: 0.045, lp: 500 });
    noise({ t: t + 0.05, d: 0.04, v: 0.1, ft: "bandpass", f: 900 });
  };
  S.boom = (t) => {
    noise({ t, d: 0.6, v: 0.22, ft: "lowpass", f: 3500, f2: 110, sl: 0.55, a: 0.003, r: 0.2 });
    tone({ w: "sine", f: 120, f2: 32, t, d: 0.4, v: 0.3, r: 0.1 });
  };
  S.bigBoom = (t) => {
    noise({ t, d: 0.9, v: 0.3, ft: "lowpass", f: 3800, f2: 100, sl: 0.8, a: 0.003, r: 0.25 });
    tone({ w: "sine", f: 115, f2: 28, t, d: 0.6, v: 0.4, r: 0.12 });
    for (let i = 0; i < 5; i++)
      noise({ t: t + 0.15 + Math.random() * 0.5, d: 0.03, v: 0.05, ft: "bandpass", f: 1500 + Math.random() * 2500, q: 2 });
  };
  S.shieldBlock = (t) => {
    tone({ w: "triangle", f: 1760, t, d: 0.3, v: 0.075, s: 0, dk: 0.1 });
    tone({ w: "triangle", f: 2637, t, d: 0.3, v: 0.05, s: 0, dk: 0.08 });
    noise({ t, d: 0.25, v: 0.12, ft: "lowpass", f: 1800, f2: 200 });
  };
  S.hurt = (t) => {
    tone({ w: "p50", f: 880, f2: 300, t, d: 0.09, v: 0.065 });
    tone({ w: "p50", f: 660, f2: 200, t: t + 0.1, d: 0.11, v: 0.065 });
  };
  S.speedUp = (t) => {
    for (const k of [0, 0.12]) tone({ w: "p25", f: 330, f2: 1900, sl: 0.1, t: t + k, d: 0.11, v: 0.05 });
    noise({ t, d: 0.3, v: 0.05, ft: "bandpass", f: 800, f2: 5000, q: 1 });
  };
  S.starman = (t) => {
    seq(t, ["C6", "E6", "G6", "C7", "E7", "G7"].map((n) => [n, 0.032]), { w: "p50", v: 0.045, gate: 0.9 });
    for (let i = 0; i < 8; i++)
      tone({ w: "triangle", f: hz(i % 2 ? "E7" : "G7"), t: t + 0.2 + i * 0.04, d: 0.03, v: 0.04 });
  };
  S.slowDown = (t) =>
    tone({ w: "triangle", f: 900, f2: 160, sl: 0.45, t, d: 0.5, v: 0.12, vib: 0.05, vr: 8 });
  S.flagGrab = (t) => {
    seq(t, [["G5", 0.05], ["D6", 0.05], ["G6", 0.2]], { w: "p50", v: 0.065, gate: 0.95, vib: 0.012 });
    bell("G7", t + 0.1, 0.03, 0.12);
  };
  S.capture = (t) => {
    const e = seq(t, [["C5", 0.055], ["E5", 0.055], ["G5", 0.055], ["C6", 0.055], ["E6", 0.11], ["D6", 0.055]], { w: "p50", v: 0.065, gate: 0.92 });
    seq(t, [["G4", 0.055], ["C5", 0.055], ["E5", 0.055], ["G5", 0.055], ["C6", 0.11], ["B5", 0.055]], { w: "p25", v: 0.035, gate: 0.92 });
    tone({ w: "p50", f: hz("E6"), t: e, d: 0.6, v: 0.065, vib: 0.014, s: 0.75, r: 0.2 });
    tone({ w: "p25", f: hz("C6"), t: e, d: 0.6, v: 0.04, s: 0.75, r: 0.2 });
    tone({ w: "triangle", f: hz("C3"), t: e, d: 0.6, v: 0.2, r: 0.2 });
    roll(t, e - t, 0.02, 0.07);
    crash(e, 0.06);
    S.sparkle(e + 0.15);
  };
  S.steal = (t) => {
    noise({ t, d: 0.11, v: 0.09, ft: "bandpass", f: 900, f2: 4500, q: 1.4 });
    tone({ w: "p25", f: 1500, f2: 700, t: t + 0.06, d: 0.09, v: 0.055 });
    seq(t + 0.17, [["E6", 0.045], ["C6", 0.07]], { w: "p50", v: 0.05, gate: 0.9 });
  };
  S.crate = (t) => {
    for (const [k, v] of [[0, 0.18], [0.03, 0.12], [0.07, 0.07]])
      noise({ t: t + k, d: 0.04, v, ft: "bandpass", f: 1100 + k * 6000, q: 1 });
    const pent = ["C6", "D6", "E6", "G6", "A6", "C7"];
    for (let i = 0; i < 7; i++)
      tone({ w: "p25", f: hz(pent[(i * 3) % pent.length]), t: t + 0.08 + i * 0.045, d: 0.035, v: 0.035 });
    tone({ w: "p50", f: hz("E6"), t: t + 0.42, d: 0.2, v: 0.045, s: 0.5 });
    tone({ w: "p50", f: hz("B6"), t: t + 0.42, d: 0.2, v: 0.03, s: 0.5 });
  };
  S.chainChomp = (t) => {
    for (let i = 0; i < 5; i++)
      noise({ metal: true, t: t + i * 0.035, d: 0.018, v: 0.035, ft: "highpass", f: 3000 });
    tone({ w: "p50", f: 270, f2: 175, t: t + 0.2, d: 0.07, v: 0.09, lp: 1600 });
    tone({ w: "p50", f: 240, f2: 150, t: t + 0.31, d: 0.08, v: 0.09, lp: 1600 });
  };
  S.chainHit = (t) => {
    noise({ metal: true, t, d: 0.16, v: 0.06, ft: "highpass", f: 1400, s: 0.2, dk: 0.05 });
    tone({ w: "triangle", f: 170, f2: 55, t, d: 0.22, v: 0.25 });
  };
  S.shellFire = (t) => {
    tone({ w: "p50", f: 1400, t, d: 0.025, v: 0.055 });
    tone({ w: "p50", f: 1046, t: t + 0.03, d: 0.05, v: 0.055 });
    noise({ t, d: 0.18, v: 0.045, ft: "bandpass", f: 1600, f2: 3000, q: 1 });
  };
  S.shellHit = (t) => {
    tone({ w: "triangle", f: 230, f2: 70, t, d: 0.13, v: 0.24 });
    noise({ t, d: 0.05, v: 0.11, ft: "lowpass", f: 1500 });
    for (let i = 0; i < 6; i++)
      tone({ w: "p25", f: i % 2 ? 700 : 950, t: t + 0.09 + i * 0.035, d: 0.03, v: 0.035 });
  };
  S.bananaDrop = (t) => tone({ w: "sine", f: 240, f2: 680, sl: 0.07, t, d: 0.08, v: 0.12 });
  S.oilDrop = (t) => {
    tone({ w: "sine", f: 190, f2: 105, t, d: 0.26, v: 0.12, vib: 0.08, vr: 14 });
    noise({ t, d: 0.1, v: 0.045, ft: "lowpass", f: 650 });
  };
  S.bananaSlip = (t) => {
    tone({ w: "sine", f: 1300, f2: 320, sl: 0.42, t, d: 0.45, v: 0.085, vib: 0.02, vr: 10 });
    for (let i = 0; i < 5; i++)
      tone({ w: "p25", f: i % 2 ? 620 : 880, t: t + 0.12 + i * 0.05, d: 0.035, v: 0.028 });
  };
  S.oilSplash = (t) => {
    noise({ t, d: 0.3, v: 0.13, ft: "bandpass", f: 900, f2: 300, q: 0.7 });
    tone({ w: "sine", f: 480, f2: 1250, t: t + 0.05, d: 0.14, v: 0.065 });
    tone({ w: "sine", f: 1250, f2: 380, t: t + 0.2, d: 0.22, v: 0.065 });
  };
  const roar = (t, dur = 0.55) => {
    tone({ w: "sawtooth", f: 82, f2: 64, t, d: dur, v: 0.065, lp: 800, trem: 17, td: 0.6, a: 0.04 });
    tone({ w: "sawtooth", f: 84.5, f2: 66, t, d: dur, v: 0.045, lp: 700 });
    noise({ t, d: dur * 0.9, v: 0.09, ft: "lowpass", f: 650, a: 0.05 });
  };
  S.bowserThrow = (t) => {
    roar(t);
    tone({ w: "sine", f: 1500, f2: 480, t: t + 0.35, d: 0.7, v: 0.03 });
  };

  // --- character "voices": a little signature sting per character (no samples)
  const VOICES = [
    // Mario: a "wa-hoo" double rise
    (t) => {
      tone({ w: "p50", f: 360, f2: 760, sl: 0.12, t, d: 0.13, v: 0.06, lp: 3000 });
      tone({ w: "p50", f: 620, f2: 1050, sl: 0.2, t: t + 0.15, d: 0.24, v: 0.06, vib: 0.02, lp: 3500 });
    },
    // Luigi: higher and wobblier
    (t) => {
      tone({ w: "p50", f: 430, f2: 900, sl: 0.13, t, d: 0.14, v: 0.055, lp: 3200 });
      tone({ w: "p50", f: 760, f2: 1250, sl: 0.25, t: t + 0.16, d: 0.3, v: 0.055, vib: 0.035, vr: 7, lp: 3800 });
    },
    // Yoshi: "yo-shi!" + a tongue boing
    (t) => {
      tone({ w: "sine", f: 520, f2: 900, t, d: 0.07, v: 0.12 });
      tone({ w: "sine", f: 700, f2: 1150, t: t + 0.09, d: 0.16, v: 0.12 });
      tone({ w: "triangle", f: 300, f2: 1300, sl: 0.08, t: t + 0.3, d: 0.1, v: 0.08 });
    },
    // Toadette: two bright squeaks + sparkle
    (t) => {
      for (const k of [0, 0.1]) tone({ w: "p25", f: 1250, f2: 1750, t: t + k, d: 0.06, v: 0.05 });
      S.sparkle(t + 0.2);
    },
    // Pauline: a jazzy major-seventh chime
    (t) => ["C6", "E6", "G6", "B6"].forEach((n, i) => bell(n, t + i * 0.07, 0.05, 0.3)),
    // Koopa: a shell spin
    (t) => {
      for (let i = 0; i < 8; i++) tone({ w: "p25", f: i % 2 ? 720 : 960, t: t + i * 0.032, d: 0.026, v: 0.04 });
      noise({ t, d: 0.3, v: 0.04, ft: "bandpass", f: 2000, f2: 600, q: 1.2 });
    },
    // Bowser: a roar
    (t) => roar(t, 0.8),
    // Peach: a harp glissando
    (t) => ["G5", "A5", "B5", "D6", "E6", "G6", "A6", "B6", "D7"].forEach((n, i) => bell(n, t + i * 0.035, 0.035, 0.22)),
    // Toad: a quick "hup!"
    (t) => {
      tone({ w: "p50", f: 820, f2: 1320, t, d: 0.08, v: 0.06 });
      tone({ w: "p50", f: 1100, t: t + 0.11, d: 0.05, v: 0.05 });
    },
    // Parabones: a bone rattle + a spooky wobble
    (t) => {
      for (const k of [0, 0.04, 0.07, 0.12, 0.15, 0.2])
        noise({ t: t + k, d: 0.015, v: 0.11, ft: "bandpass", f: 2500 + Math.random() * 1500, q: 3 });
      tone({ w: "sine", f: 380, f2: 300, t: t + 0.22, d: 0.45, v: 0.07, vib: 0.06, vr: 6 });
    },
  ];
  S.voice = (t, o = {}) => (VOICES[o.c] || VOICES[0])(t);

  // --- fanfares
  S.victory = (t) => {
    const lead = [["C5", 0.09], ["E5", 0.09], ["G5", 0.09], ["C6", 0.27], ["G5", 0.09], ["C6", 0.18], ["E6", 0.18], ["D6", 0.09], ["E6", 0.09]];
    const harm = [["G4", 0.09], ["C5", 0.09], ["E5", 0.09], ["E5", 0.27], ["E5", 0.09], ["G5", 0.18], ["C6", 0.18], ["B5", 0.09], ["C6", 0.09]];
    const e = seq(t, lead, { w: "p50", v: 0.07, gate: 0.9 });
    seq(t, harm, { w: "p25", v: 0.04, gate: 0.9 });
    seq(t, [["C3", 0.36], ["G2", 0.27], ["C3", 0.27], ["G2", 0.27]], { w: "triangle", v: 0.2, gate: 0.9 });
    tone({ w: "p50", f: hz("G6"), t: e, d: 1.0, v: 0.07, vib: 0.016, vd: 0.2, s: 0.8, r: 0.3 });
    tone({ w: "p25", f: hz("E6"), t: e, d: 1.0, v: 0.04, s: 0.8, r: 0.3 });
    tone({ w: "p25", f: hz("C6"), t: e, d: 1.0, v: 0.03, s: 0.8, r: 0.3 });
    tone({ w: "triangle", f: hz("C3"), t: e, d: 1.0, v: 0.22, r: 0.3 });
    roll(t, e - t, 0.015, 0.075);
    crash(e, 0.09);
    DRUM.k(e, 1);
    S.sparkle(e + 0.25);
    S.sparkle(e + 0.7);
    return e + 1.3;
  };
  S.draw = (t) => {
    const notes = [["G4", 0.38], ["F#4", 0.38], ["F4", 0.38], ["E4", 1.1]];
    let tt = t;
    for (const [n, du] of notes) {
      const f = hz(n);
      const last = du > 1;
      tone({ w: "p50", f, f2: f * 0.985, t: tt, d: du * 0.88, v: 0.06, lp: 1600, a: 0.02, vib: last ? 0.03 : 0, vr: 5, vd: 0.2 });
      tone({ w: "triangle", f: f / 2, t: tt, d: du * 0.88, v: 0.15 });
      tt += du;
    }
    return tt;
  };
  S.finale = (t) => {
    roll(t, 1.2, 0.01, 0.09);
    const t1 = t + 1.2;
    const e = seq(t1, [["G5", 0.15], ["G5", 0.15], ["G5", 0.15], ["C6", 0.6]], { w: "p50", v: 0.07, gate: 0.85 });
    seq(t1, [["E5", 0.15], ["E5", 0.15], ["E5", 0.15], ["G5", 0.6]], { w: "p25", v: 0.045, gate: 0.85 });
    seq(t1, [["C3", 0.45], ["C3", 0.6]], { w: "triangle", v: 0.22, gate: 0.9 });
    crash(t1 + 0.45, 0.07);
    const e2 = seq(e, [["D6", 0.08], ["E6", 0.08], ["F6", 0.08], ["G6", 0.08]], { w: "p50", v: 0.065, gate: 0.95 });
    tone({ w: "p50", f: hz("C7"), t: e2, d: 1.3, v: 0.065, vib: 0.016, vd: 0.25, s: 0.8, r: 0.35 });
    tone({ w: "p25", f: hz("G6"), t: e2, d: 1.3, v: 0.04, s: 0.8, r: 0.35 });
    tone({ w: "p25", f: hz("E6"), t: e2, d: 1.3, v: 0.035, s: 0.8, r: 0.35 });
    tone({ w: "triangle", f: hz("C3"), t: e2, d: 1.3, v: 0.22, r: 0.35 });
    crash(e2, 0.1);
    DRUM.k(e2, 1);
    S.sparkle(e2 + 0.2);
    S.sparkle(e2 + 0.6);
    S.sparkle(e2 + 1.0);
    return e2 + 1.6;
  };

  // ---------------------------------------------------------------- music
  const INST = {
    lead: (f, t, d, v, bus) => tone({ w: "p50", f, t, d, v: 0.075 * v, s: 0.7, dk: 0.12, r: 0.05, vib: 0.008, vd: 0.12, bus }),
    lead25: (f, t, d, v, bus) => tone({ w: "p25", f, t, d, v: 0.085 * v, s: 0.7, dk: 0.12, r: 0.05, vib: 0.008, vd: 0.12, bus }),
    brass: (f, t, d, v, bus) => {
      tone({ w: "p50", f, t, d, v: 0.065 * v, a: 0.02, s: 0.85, dk: 0.15, r: 0.06, vib: 0.01, vd: 0.15, bus });
      tone({ w: "p25", f, t, d, v: 0.035 * v, a: 0.02, det: 8, s: 0.85, r: 0.06, bus });
    },
    trumpet: (f, t, d, v, bus) =>
      tone({ w: "p50", f, t, d, v: 0.075 * v, a: 0.012, s: 0.8, dk: 0.1, r: 0.05, vib: 0.014, vr: 6.5, vd: 0.1, bus }),
    flute: (f, t, d, v, bus) => {
      tone({ w: "triangle", f, t, d, v: 0.17 * v, a: 0.02, s: 0.9, r: 0.08, vib: 0.012, vd: 0.15, bus });
      tone({ w: "p12", f, t, d, v: 0.018 * v, a: 0.02, s: 0.8, r: 0.06, bus });
    },
    eerie: (f, t, d, v, bus) =>
      tone({ w: "p25", f, t, d, v: 0.085 * v, a: 0.03, s: 0.85, r: 0.12, vib: 0.015, vr: 4.5, vd: 0.2, lp: 1900, bus }),
    harm: (f, t, d, v, bus) => tone({ w: "p25", f, t, d, v: 0.035 * v, s: 0.6, dk: 0.15, r: 0.05, bus }),
    bass: (f, t, d, v, bus) => tone({ w: "triangle", f, t, d, v: 0.2 * v, a: 0.003, s: 0.9, r: 0.03, bus }),
    arp: (f, t, d, v, bus) => tone({ w: "p12", f, t, d, v: 0.032 * v, s: 0.3, dk: 0.06, r: 0.02, bus }),
    bell: (f, t, d, v, bus) => {
      tone({ w: "sine", f, t, d: d + 0.3, v: 0.05 * v, s: 0, dk: 0.25, r: 0.1, bus });
      tone({ w: "sine", f: f * 2, t, d: 0.2, v: 0.012 * v, s: 0, dk: 0.08, bus });
    },
    stab: (f, t, d, v, bus) => tone({ w: "p25", f, t, d, v: 0.026 * v, s: 0.4, dk: 0.05, r: 0.03, bus }),
    guitar: (f, t, d, v, bus) => {
      tone({ w: "p25", f, t, d: d + 0.1, v: 0.024 * v, s: 0, dk: 0.1, r: 0.04, bus });
      tone({ w: "triangle", f, t, d: d + 0.1, v: 0.04 * v, s: 0, dk: 0.12, r: 0.04, bus });
    },
    pad: (f, t, d, v, bus) => tone({ w: "triangle", f, t, d, v: 0.05 * v, a: 0.15, s: 1, r: 0.3, bus }),
  };

  const DRUM = {
    k: (t, v, bus) => {
      tone({ w: "sine", f: 150, f2: 42, sl: 0.1, t, d: 0.12, v: 0.4 * v, a: 0.002, r: 0.05, bus });
      noise({ t, d: 0.01, v: 0.05 * v, ft: "lowpass", f: 3000, bus });
    },
    s: (t, v, bus) => {
      noise({ t, d: 0.11, v: 0.1 * v, ft: "bandpass", f: 2000, q: 0.7, s: 0.3, dk: 0.05, bus });
      tone({ w: "triangle", f: 220, f2: 160, t, d: 0.05, v: 0.11 * v, bus });
    },
    b: (t, v, bus) => noise({ t, d: 0.13, v: 0.045 * v, a: 0.02, ft: "bandpass", f: 3000, q: 0.5, bus }),
    h: (t, v, bus) => noise({ t, d: 0.025, v: 0.04 * v, ft: "highpass", f: 7500, bus }),
    o: (t, v, bus) => noise({ t, d: 0.14, v: 0.035 * v, ft: "highpass", f: 6500, s: 0.2, bus }),
    t: (t, v, bus) => {
      tone({ w: "sine", f: 130, f2: 68, t, d: 0.22, v: 0.3 * v, bus });
      noise({ t, d: 0.03, v: 0.05 * v, ft: "lowpass", f: 800, bus });
    },
    r: (t, v, bus) => {
      noise({ t, d: 0.018, v: 0.1 * v, ft: "bandpass", f: 3800, q: 4, bus });
      tone({ w: "p12", f: 2600, t, d: 0.012, v: 0.018 * v, bus });
    },
    c: (t, v, bus) => noise({ t, d: 1.0, v: 0.06 * v, ft: "highpass", f: 3800, s: 0, dk: 0.35, bus }),
  };

  const compiled = {};
  let cur = null;

  function playEvent(e, t, s, loop, bus) {
    const sd = s.stepDur;
    const alt = loop % 2 === 1;
    if (e.p === "lead") {
      const inst = (alt && s.def.leadAlt) || s.def.leadInst || "lead";
      INST[inst](mtof(e.midi), t, e.len * sd * 0.92, 1, bus);
    } else if (e.p === "harm") INST.harm(mtof(e.midi), t, e.len * sd * 0.9, 1, bus);
    else if (e.p === "bass") INST.bass(mtof(e.midi), t, e.len * sd * 0.92, 1, bus);
    else if (e.p === "arp") {
      if (e.alt !== (alt && !!s.def.arpAlt)) return; // one arp order per loop pass
      INST[s.def.arpInst || "arp"](mtof(e.midi), t, sd * 0.6, 1, bus);
    } else if (e.p === "stab") {
      for (const m of e.notes) INST[e.inst || "stab"](mtof(m), t, sd * 0.55, 1, bus);
    } else if (e.p === "pad") {
      for (const m of e.notes) INST.pad(mtof(m), t, e.len * sd, 1, bus);
    } else if (e.p === "drum") DRUM[e.d]?.(t, e.vel, bus);
  }

  function playSong(name, when) {
    stopSong(0.5);
    const def = SONGS[name];
    if (!def) return;
    const s = (compiled[name] ||= compileSong(def));
    const g = ctx.createGain();
    const t0 = Math.max(when ?? ctx.currentTime + 0.1, ctx.currentTime);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0 + 0.08);
    g.connect(duck);
    cur = { name, s, g, nextT: t0, step: 0 };
  }

  function stopSong(fade = 0.6) {
    if (!cur) return;
    const g = cur.g;
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => {
      try {
        g.disconnect();
      } catch (e) {
        /* gone */
      }
    }, (fade + 1) * 1000);
    cur = null;
  }

  // schedule every step that starts before `until` (the live loop calls this a
  // few times a second with a short look-ahead; an offline render calls it once)
  function pump(until) {
    if (!cur) return;
    const { s } = cur;
    // a stalled tab must not fire a backlog of stale notes all at once
    while (cur.nextT < ctx.currentTime - 0.05) {
      cur.step++;
      cur.nextT += s.stepDur;
    }
    while (cur.nextT < until) {
      const i = cur.step % s.len;
      const loop = Math.floor(cur.step / s.len);
      const sw = i % 2 === 1 ? s.def.swing * s.stepDur : 0;
      for (const e of s.ev[i]) playEvent(e, cur.nextT + sw, s, loop, cur.g);
      cur.step++;
      cur.nextT += s.stepDur;
    }
  }

  function duckMusic(level, hold) {
    const t = ctx.currentTime;
    duck.gain.cancelScheduledValues(t);
    duck.gain.setValueAtTime(duck.gain.value, t);
    duck.gain.linearRampToValueAtTime(level, t + 0.15);
    duck.gain.setValueAtTime(level, t + hold);
    duck.gain.linearRampToValueAtTime(1, t + hold + 1.2);
  }

  // ---------------------------------------------------------------- ambience
  // A very quiet filtered-noise bed under each world's music (waterfall, wind ...).
  const AMBIENCE = {
    fossil: [{ ft: "lowpass", f: 1300, v: 0.05 }, { ft: "highpass", f: 3200, v: 0.012 }],
    ruined: [{ ft: "bandpass", f: 520, q: 1.4, v: 0.075, sweep: 320, rate: 0.09 }],
    desert: [{ ft: "bandpass", f: 900, q: 1.0, v: 0.035, sweep: 380, rate: 0.06 }],
    city: [{ ft: "lowpass", f: 320, v: 0.05 }],
  };
  let ambNodes = [];
  let ambName = null;
  let thunderTimer = null;
  function setAmbience(name) {
    if (name === ambName) return;
    ambName = name;
    const t = ctx.currentTime;
    for (const n of ambNodes) {
      n.g.gain.cancelScheduledValues(t);
      n.g.gain.setValueAtTime(n.g.gain.value, t);
      n.g.gain.linearRampToValueAtTime(0, t + 0.8);
      const old = n;
      setTimeout(() => {
        try {
          old.src.stop();
          old.lfo?.stop();
          old.g.disconnect();
        } catch (e) {
          /* gone */
        }
      }, 1200);
    }
    ambNodes = [];
    clearTimeout(thunderTimer);
    for (const L of AMBIENCE[name] || []) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = L.ft;
      f.frequency.value = L.f;
      f.Q.value = L.q ?? 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(L.v, t + 2);
      src.connect(f);
      f.connect(g);
      g.connect(amb);
      let lfo = null;
      if (L.sweep) {
        lfo = ctx.createOscillator();
        lfo.frequency.value = L.rate;
        const lg = ctx.createGain();
        lg.gain.value = L.sweep;
        lfo.connect(lg);
        lg.connect(f.frequency);
        lfo.start(t);
      }
      src.start(t);
      ambNodes.push({ src, g, lfo });
    }
    if (name === "ruined") {
      const thunder = () => {
        const t1 = ctx.currentTime;
        noise({ t: t1, d: 2.2, v: 0.12, a: 0.35, r: 1.2, ft: "lowpass", f: 180, f2: 70, bus: amb });
        thunderTimer = setTimeout(thunder, 18000 + Math.random() * 22000);
      };
      thunderTimer = setTimeout(thunder, 9000 + Math.random() * 8000);
    }
  }

  return {
    ctx,
    out,
    comp,
    music,
    amb,
    MUSIC_VOL,
    S,
    play(name, t, o) {
      const fn = S[name];
      if (!fn) return;
      const prev = target;
      let pan = null;
      if (o && o.pan) {
        pan = ctx.createStereoPanner();
        pan.pan.value = o.pan;
        pan.connect(sfx);
        target = pan;
        setTimeout(() => {
          try {
            pan.disconnect();
          } catch (e) {
            /* gone */
          }
        }, 4000);
      }
      try {
        return fn(t ?? ctx.currentTime + 0.005, o || {});
      } finally {
        target = prev;
      }
    },
    playSong,
    stopSong,
    pump,
    duckMusic,
    setAmbience,
    song: () => cur?.name || null,
    voices: () => voices,
    // a MediaStream of everything the game plays (for recording a capture)
    tap() {
      const dest = ctx.createMediaStreamDestination();
      comp.connect(dest);
      return dest.stream;
    },
  };
}

// ------------------------------------------------------------------ game wiring
const SCENE_SONG = {
  menu: "menu",
  peach: "peach",
  city: "city",
  fossilfalls: "fossil",
  ruined: "ruined",
  tostarena: "desert",
  final: "final",
};
const SCENE_AMB = { city: "city", fossilfalls: "fossil", ruined: "ruined", tostarena: "desert" };

// minimum gap (ms) between two plays of the same sound
const MIN_GAP = {
  hover: 45, tick: 35, slide: 30, coin: 75, qblock: 120, star: 120, skid: 160,
  pipe: 250, chomp: 300, spike: 250, goombaHit: 250, goal: 2200, banzai: 350,
  boom: 120, bigBoom: 300, ghost: 500, freeze: 400, cage: 400, push: 300,
  secret: 600, crate: 120, shellFire: 90, jump: 60,
};
// gameplay sounds: thinned out further while training races by at high speed
const GAMEPLAY = new Set([
  "coin", "qblock", "star", "skid", "pipe", "chomp", "spike", "goombaHit", "goal",
  "ghost", "freeze", "cage", "push", "secret", "banzai", "boom", "bigBoom",
  "shieldBlock", "speedUp", "starman", "slowDown",
]);
const MODES = ["all", "sfx", "off"];
const MODE_LABEL = { all: "Sound", sfx: "Music off", off: "Muted" };
const MOVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

const SPEAKER_SVG = (mode) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">` +
  `<path d="M4 9.5h3.6L12.5 5v14l-4.9-4.5H4z" fill="currentColor"/>` +
  (mode === "off"
    ? `<path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`
    : `<path d="M15.5 9a4.2 4.2 0 0 1 0 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      (mode === "all"
        ? `<path d="M18 6.5a7.6 7.6 0 0 1 0 11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>`
        : "")) +
  `</svg>`;

const STYLE = `
#rl-sound{position:fixed;right:1.6vw;bottom:2.4vh;z-index:57;width:46px;height:46px;border:0;padding:0;
  border-radius:50%;background:#fff;color:#1d1d1f;display:flex;align-items:center;justify-content:center;
  cursor:pointer;box-shadow:0 3px 14px rgba(0,0,0,.45);transition:transform .15s ease,opacity .3s ease;}
#rl-sound:hover{transform:scale(1.08);}
#rl-sound:focus,#rl-sound:focus-visible{outline:none;}
#rl-sound.hide{opacity:0;pointer-events:none;}
#rl-sound svg{pointer-events:none;}
`;

const noop = () => {};
const STUB = {
  play: noop, setScene: noop, cycleMode: noop, setMode: noop, tap: () => null,
  get mode() { return "off"; },
};

export function initSound() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return STUB;
  let ctx;
  try {
    ctx = new AC({ latencyHint: "interactive" });
  } catch (e) {
    return STUB;
  }
  const E = createEngine(ctx);

  let mode = "all";
  try {
    const m = localStorage.getItem("rl-sound");
    if (MODES.includes(m)) mode = m;
  } catch (e) {
    /* storage blocked: default on */
  }

  let scene = null; // the world (or menu) whose music should be playing
  let covered = false; // an arena iris is covering the screen: hold the music
  const lastPlay = {};
  let busy = 1; // >1 while training races by: gameplay sounds thin out

  // ---- the context starts suspended until the first click / key (autoplay policy)
  const wantRunning = () => mode !== "off" && !document.hidden;
  function syncRunning() {
    if (wantRunning()) ctx.resume?.().catch(noop);
    else if (ctx.state === "running") ctx.suspend?.().catch(noop);
  }
  const unlock = () => {
    if (ctx.state !== "running" && wantRunning()) ctx.resume().catch(noop);
  };
  for (const ev of ["pointerdown", "keydown", "touchstart"])
    window.addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener("visibilitychange", syncRunning);
  syncRunning(); // allowed straight away where the browser permits autoplay

  setInterval(() => {
    if (ctx.state === "running") E.pump(ctx.currentTime + 0.25);
  }, 50);

  function applyModeGains() {
    const t = ctx.currentTime;
    for (const [node, v] of [[E.music, mode === "all" ? E.MUSIC_VOL : 0], [E.amb, mode === "all" ? 1 : 0]]) {
      node.gain.cancelScheduledValues(t);
      node.gain.setValueAtTime(node.gain.value, t);
      node.gain.linearRampToValueAtTime(v, t + 0.25);
    }
  }
  applyModeGains();

  function play(name, o = {}) {
    try {
      if (mode === "off" || ctx.state !== "running") return;
      const now = performance.now();
      const gap = (MIN_GAP[name] ?? 40) * (GAMEPLAY.has(name) ? busy : 1);
      if (now - (lastPlay[name] || 0) < gap) return;
      lastPlay[name] = now;
      E.play(name, ctx.currentTime + 0.005 + (o.delay || 0), o);
    } catch (e) {
      /* sound must never break the game */
    }
  }

  function applyScene() {
    try {
      const song = SCENE_SONG[scene] || null;
      if (song !== E.song()) {
        if (song) E.playSong(song);
        else E.stopSong(0.8);
      }
      E.setAmbience(SCENE_AMB[scene] || null);
    } catch (e) {
      /* never break the game */
    }
  }

  function setScene(key) {
    scene = key;
    refreshButtons();
    if (!covered) applyScene();
  }

  // ---- mode: everything -> sfx only -> muted
  function setMode(m) {
    if (!MODES.includes(m)) return;
    mode = m;
    try {
      localStorage.setItem("rl-sound", mode);
    } catch (e) {
      /* ignore */
    }
    applyModeGains();
    syncRunning();
    refreshButtons();
    if (mode !== "off") setTimeout(() => play(mode === "all" ? "confirm" : "toggle", { off: true }), 60);
  }
  const cycleMode = () => setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);

  // ---- the speaker button (start menu) + the "M Sound" key hint (in game)
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.appendChild(style);
  const btn = document.createElement("button");
  btn.id = "rl-sound";
  btn.type = "button";
  btn.className = "hide";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    cycleMode();
  });
  document.body.appendChild(btn);
  let hint = null;
  function ensureHint() {
    if (hint) return hint;
    const keys = document.getElementById("rl-keys");
    if (!keys) return null;
    hint = document.createElement("div");
    hint.className = "kh";
    hint.dataset.act = "sound";
    hint.innerHTML = `<span class="key">M</span><span class="txt"></span>`;
    hint.addEventListener("click", cycleMode);
    keys.appendChild(hint);
    return hint;
  }
  function refreshButtons() {
    const title = `${MODE_LABEL[mode]} (M)`;
    if (btn.dataset.mode !== mode) {
      btn.dataset.mode = mode;
      btn.innerHTML = SPEAKER_SVG(mode);
      btn.title = title;
      btn.setAttribute("aria-label", title);
    }
    btn.classList.toggle("hide", scene !== "menu");
    const h = ensureHint();
    const txt = h?.querySelector(".txt");
    if (txt && txt.textContent !== MODE_LABEL[mode]) txt.textContent = MODE_LABEL[mode];
  }
  refreshButtons();

  // ---- keyboard
  let humanOn = false;
  let arenaRound = false;
  window.addEventListener("keydown", (e) => {
    if (/input|select|textarea/i.test(e.target?.tagName || "") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === "KeyM" && !e.repeat) cycleMode();
    else if (e.code === "KeyR" && !e.repeat && scene && scene !== "menu" && !humanOn) play("rewind");
    else if (humanOn && !arenaRound && !e.repeat && MOVE_KEYS.has(e.code)) play("jump", { v: 0.035 });
  });

  // ---- clicks / hovers / sliders (delegated; capture so nothing can swallow them)
  const CLICK = [
    ['#rl-keys .kh[data-act="reset"]', "rewind"],
    ["#rl-sound, #rl-keys .kh", null], // own handlers / observers
    ["#rl-menu .item", null], // the confirm sweep + the menu's own observers
    ["#rl-select .tile", "pick"],
    ["#rl-select .back, #rl-scr-back, .closebtn", null],
    [".pc-algo", "rip"],
    [".acard-slot", "card"],
    [".hw-next, .hw-prev", "page"],
    ["#rl-play", "pause"],
    ["#rl-prev, #rl-next", "select"],
    [".turbobtn", "turbo"],
    [".lockbtn", "lock"],
    [".msel.you", null], // taking control plays the 1-up from the snapshot
    [".msel", "tab"],
    ["#rl-reset", "rewind"],
    ["#rl-regen", "pipe"],
    ["#rl-rep-tag", null],
    ['[id^="rl-h-"]', "toggle"],
    ['[id^="rl-tab-"]', "tab"],
    [".q-yes, .f-exit", "confirm"],
    [".q-no", "select"],
    ['button, [role="button"], [role="tab"], select, input[type="checkbox"], input[type="radio"], label', "tick"],
  ];
  document.addEventListener(
    "click",
    (e) => {
      const el = e.target instanceof Element ? e.target : null;
      if (!el) return;
      for (const [sel, name] of CLICK) {
        const hit = el.closest(sel);
        if (!hit) continue;
        if (name === "pick") {
          const c = [...hit.parentNode.children].indexOf(hit);
          play("select");
          play("voice", { c, delay: 0.08, pan: hit.closest('[data-side="1"]') ? 0.35 : -0.35 });
        } else if (name) play(name);
        return;
      }
    },
    true,
  );
  const HOVER = ".acard-slot, .pc-algo, .hw-next, .hw-prev, #rl-scr-back, #rl-select .back, .q-no, .q-yes, .f-exit, #rl-keys .kh, #rl-sound";
  let hovered = null;
  document.addEventListener(
    "pointerover",
    (e) => {
      const el = e.target instanceof Element ? e.target.closest(HOVER) : null;
      if (el && el !== hovered) play("hover");
      hovered = el;
    },
    true,
  );
  let lastSlide = 0;
  document.addEventListener(
    "input",
    (e) => {
      const el = e.target;
      if (!el || el.type !== "range") return;
      const now = performance.now();
      if (now - lastSlide < 40) return;
      lastSlide = now;
      const min = +el.min || 0, max = +el.max || 100;
      play("slide", { p: (+el.value - min) / (max - min || 1) });
    },
    true,
  );

  // ---- the UI's own state classes (one observer for every screen and overlay)
  const playerChar = (side) => {
    try {
      const p = JSON.parse(localStorage.getItem("rl-chars") || "{}");
      const v = p[side === "red" ? "1" : "-1"];
      return Number.isInteger(v) ? v : side === "red" ? 1 : 0;
    } catch (e) {
      return side === "red" ? 1 : 0;
    }
  };
  let finalTimer = null;
  function onClass(el, old) {
    const had = (c) => (" " + old + " ").includes(" " + c + " ");
    const added = (c) => el.classList.contains(c) && !had(c);
    const removed = (c) => !el.classList.contains(c) && had(c);
    switch (el.id) {
      case "rl-panel":
        if (added("open")) play("panelOpen");
        else if (removed("open")) play("panelClose");
        return;
      case "rl-quit":
        if (added("show")) play("pause");
        return;
      case "rl-select":
        if (added("open")) play("menuOpen");
        else if (removed("open")) play("menuClose");
        return;
      case "rl-algos":
        if (added("dealing")) {
          play("menuOpen");
          play("deal", { delay: 0.15 });
        } else if (added("closing")) play("menuClose");
        return;
      case "rl-howto":
        if (added("open")) play("menuOpen");
        else if (added("closing")) play("menuClose");
        return;
      case "rl-gate":
      case "rl-hud-warn":
        if (added("show")) play("error");
        return;
      case "rl-menu":
        if (added("out")) {
          // Start: the jingle + the player's character, then the menu theme fades
          E.stopSong(1.0);
          play("start");
          play("voice", { c: playerChar("blue"), delay: 0.55 });
        }
        return;
      case "loadscreen":
        if (added("grow")) play("cappyFly");
        return;
      case "rl-award":
        if (added("show")) {
          E.duckMusic(0.18, 4.6);
          if (el.classList.contains("draw")) play("draw");
          else {
            play("victory");
            const side = el.classList.contains("red") ? "red" : "blue";
            play("voice", { c: playerChar(side), delay: 2.5, pan: side === "red" ? 0.3 : -0.3 });
          }
        }
        return;
      case "rl-final":
        if (added("show")) {
          E.stopSong(0.8);
          play("finale");
          clearTimeout(finalTimer);
          finalTimer = setTimeout(() => {
            if (el.classList.contains("show")) setScene("final");
          }, 4300);
        }
        return;
      case "rl-iris-block":
        if (added("on")) {
          covered = true;
          play("irisClose");
          E.stopSong(0.9);
          E.setAmbience(null);
        } else if (removed("on")) {
          covered = false;
          play("irisOpen");
          applyScene();
        }
        return;
      case "rl-iris-card":
        if (added("show")) play("nameCard");
        return;
    }
    // the start menu's selection pill + its confirm sweep
    if (el.classList.contains("item") && el.parentNode?.closest?.("#rl-menu")) {
      if (added("sel")) play("hover");
      else if (added("confirm") && !el.dataset.go) play("confirm");
      return;
    }
    // character select: the cursor brackets follow the hovered tile
    if (el.classList.contains("tile") && added("preview")) play("hover");
  }
  new MutationObserver((recs) => {
    for (const r of recs) {
      try {
        onClass(r.target, r.oldValue || "");
      } catch (e) {
        /* never break the game */
      }
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });

  // ---- replays: a tape going in / out
  let replayOn = false;
  let replayIdx = 0;
  window.addEventListener("rl-replay-state", (e) => {
    const d = e.detail || {};
    if (d.active && !replayOn) play("tapeIn");
    else if (!d.active && replayOn) play("tapeOut");
    if (d.active && d.idx < replayIdx) reseed = true; // scrubbed / looped back
    replayOn = !!d.active;
    replayIdx = d.idx || 0;
  });

  // ---- gameplay: diff consecutive live frames
  let prev = null;
  let prevRound = null;
  let prevHuman = null;
  let reseed = false;
  let epT = 0, epN = null, epRate = 0;
  const seen = new Map();
  const mark = (key) => {
    if (seen.has(key)) return false;
    seen.set(key, 1);
    if (seen.size > 800) seen.delete(seen.keys().next().value);
    return true;
  };
  const bits = (n) => Number(n) >>> 0;
  const newBits = (a, b) => (bits(b) & ~bits(a)) !== 0;
  const PICKUP = { speed: "speedUp", invincible: "starman", slow: "slowDown", freeze: "freeze" };
  const CTF = {
    grab: () => "flagGrab",
    capture: () => "capture",
    steal: () => "steal",
    crate: () => "crate",
    chain: () => "chainChomp",
    fire: () => "shellFire",
    drop: (e) => (e.weapon === "oil" ? "oilDrop" : "bananaDrop"),
    chainhit: () => "chainHit",
    shellhit: () => "shellHit",
    traphit: (e) => (e.kind === "oil" ? "oilSplash" : "bananaSlip"),
    throw: () => "bowserThrow",
    bombhit: () => "boom",
  };
  const sidePan = (s) => (s === "blue" ? -0.3 : s === "red" ? 0.3 : 0);

  function gridEvents(f, p) {
    if (!p || f.steps == null || p.steps == null || f.steps <= p.steps) return;
    for (const side of ["blue", "red"]) {
      const pan = sidePan(side);
      if (newBits(p[side + "Coins"], f[side + "Coins"])) play("coin", { pan });
      if (newBits(p[side + "Blocks"], f[side + "Blocks"])) play("qblock", { pan });
      const s0 = p[side + "Status"], s1 = f[side + "Status"];
      if (s1 && s1 !== s0) {
        if (s1 === "ghost") play("ghost", { pan, delay: 0.15 });
        else if (s1 === "frozen") play("freeze", { pan, delay: 0.15 });
      }
      if (newBits(p[side + "Stars"], f[side + "Stars"])) play("star", { pan });
      if (f[side + "Warp"] && f[side + "WarpFrom"]) play("pipe", { pan });
      const dead = f[side + "Dead"];
      if (dead && !p[side + "Dead"])
        play(dead === "plant" ? "chomp" : dead === "spike" ? "spike" : "goombaHit", { pan });
      if (f[side + "Slipped"] && !p[side + "Slipped"]) play("skid", { pan });
      if ((f.caged?.[side] || 0) > 0 && !((p.caged?.[side] || 0) > 0)) play("cage", { pan });
    }
    for (const pz of f.platePuzzles || []) {
      const old = (p.platePuzzles || []).find((q) => q.side === pz.side);
      if (!old) continue;
      if (pz.open && !old.open) play("secret", { pan: sidePan(pz.side) });
      else if (String(old.boulder) !== String(pz.boulder)) play("push", { pan: sidePan(pz.side) });
    }
    if (f.winner && !p.winner) play("goal", { pan: sidePan(f.winner) });
  }

  function arenaEvents(f, quiet) {
    const evs = [];
    for (const m of f.missiles || []) evs.push(["m" + m.id, "banzai", 0]);
    for (const x of f.explosions || [])
      evs.push(["x" + x.id, x.fatal ? "bigBoom" : x.blocked ? "shieldBlock" : "boom", sidePan(x.hit)]);
    for (const pe of f.pickupEvents || []) evs.push(["p" + pe.id, PICKUP[pe.type] || "coin", sidePan(pe.side || pe.collector)]);
    for (const ce of f.ctfEvents || []) evs.push(["c" + ce.id, CTF[ce.type]?.(ce), sidePan(ce.side)]);
    for (const [key, name, pan] of evs) if (mark(key) && !quiet && name) play(name, { pan });
  }

  window.addEventListener("rl-snapshot", (e) => {
    try {
      const st = e.detail?.stats;
      const f = e.detail?.frame;
      if (!st || !f) return;
      const rid = st.round?.roundId ?? null;
      const fresh = rid !== prevRound;
      if (fresh) {
        prevRound = rid;
        prev = null;
        seen.clear();
      }
      // how fast training is racing: thin the gameplay sounds out at high speed
      const now = performance.now();
      if (epN != null && st.episode != null && now > epT) {
        const inst = (Math.max(0, st.episode - epN) * 1000) / (now - epT);
        epRate = epRate * 0.9 + inst * 0.1;
        busy = epRate > 12 ? 6 : epRate > 4 ? 3 : 1;
      }
      epN = st.episode;
      epT = now;
      const hOn = !!st.human?.on;
      if (prevHuman != null && hOn !== prevHuman && !fresh) play(hOn ? "oneUp" : "powerDown");
      prevHuman = hOn;
      humanOn = hOn;
      arenaRound = !!f.continuous;
      if (f.continuous) {
        arenaEvents(f, !prev || reseed);
        reseed = false;
      } else gridEvents(f, prev);
      prev = f;
    } catch (err) {
      /* never break the game */
    }
  });

  return {
    play,
    setScene,
    setMode,
    cycleMode,
    get mode() {
      return mode;
    },
    get scene() {
      return scene;
    },
    tap: () => E.tap(),
    engine: E,
    ctx,
  };
}
