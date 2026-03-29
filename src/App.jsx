import { useState, useCallback, useMemo, useRef, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_LABELS = { "C#": "C#/Db", "D#": "D#/Eb", "F#": "F#/Gb", "G#": "G#/Ab", "A#": "A#/Bb" };
const TUNING = [4, 11, 7, 2, 9, 4]; // e B G D A E (index 0 = highest string)
const STRING_NAMES = ["e", "B", "G", "D", "A", "E"];
const FRET_COUNT = 15;
const DOT_FRETS = [3, 5, 7, 9, 12, 15];
const DOUBLE_DOT = [12];

// Portfolio palette: warm cream, terracotta accent
const ACCENT      = "#c4401a";
const ACCENT_SOFT = "#c4401a18";
const BG          = "#f5f2ed";
const CARD        = "#fff";
const RULE        = "#d4d0ca";
const FG          = "#1a1a18";
const MUTED       = "#9e9a93";

const DEGREE_COLORS = ["#c4401a","#e67e22","#b8920a","#2ecc71","#1abc9c","#3498db","#9b59b6","#e91e63","#00bcd4","#8bc34a","#ff5722","#607d8b"];
const INTERVAL_COLORS = { 3:"#e74c3c", 4:"#e67e22", 5:"#b8920a", 7:"#2ecc71", 10:"#3498db", 11:"#9b59b6", 12:"#1abc9c" };
// Root, 3rd, 5th
const CHORD_COLORS = ["#c4401a", "#e67e22", "#2ecc71"];

const SCALES = {
  "Dur (Ionisch)":       [0,2,4,5,7,9,11],
  "Nat. Moll (Äolisch)": [0,2,3,5,7,8,10],
  "Harm. Moll":          [0,2,3,5,7,8,11],
  "Melod. Moll":         [0,2,3,5,7,9,11],
  "Dur-Pentatonik":      [0,2,4,7,9],
  "Moll-Pentatonik":     [0,3,5,7,10],
  "Blues":               [0,3,5,6,7,10],
  "Dorisch":             [0,2,3,5,7,9,10],
  "Phrygisch":           [0,1,3,5,7,8,10],
  "Lydisch":             [0,2,4,6,7,9,11],
  "Mixolydisch":         [0,2,4,5,7,9,10],
  "Lokrisch":            [0,1,3,5,6,8,10],
};

const INTERVALS = {
  "Kleine Terz (m3)":    3,
  "Große Terz (M3)":     4,
  "Reine Quarte (P4)":   5,
  "Reine Quinte (P5)":   7,
  "Kleine Septime (m7)": 10,
  "Große Septime (M7)":  11,
  "Oktave (P8)":         12,
};

const TRIAD_TYPES = {
  "Dur":        [0, 4, 7],
  "Moll":       [0, 3, 7],
  "Vermindert": [0, 3, 6],
  "Übermäßig":  [0, 4, 8],
};

const TRIAD_INVERSIONS = ["Grundst.", "1. Umk.", "2. Umk."];
const TRIAD_GROUPS = [[2,1,0], [3,2,1], [4,3,2], [5,4,3]];
const TRIAD_GROUP_LABELS = ["G–B–e", "D–G–B", "A–D–G", "E–A–D"];

// ─── Chord Voicing Templates ───────────────────────────────────────────────────

const CHORD_VOICING_TEMPLATES = {
  "Dur": [
    { name:"E-Form",  rootStr:5, relFrets:[0,2,2,1,0,0]    },
    { name:"A-Form",  rootStr:4, relFrets:[-1,0,2,2,2,0]   },
    { name:"D-Form",  rootStr:3, relFrets:[-1,-1,0,2,3,2]  },
  ],
  "Moll": [
    { name:"Em-Form", rootStr:5, relFrets:[0,2,2,0,0,0]    },
    { name:"Am-Form", rootStr:4, relFrets:[-1,0,2,2,1,0]   },
    { name:"Dm-Form", rootStr:3, relFrets:[-1,-1,0,2,3,1]  },
  ],
  "Dom7": [
    { name:"E7-Form", rootStr:5, relFrets:[0,2,0,1,0,0]    },
    { name:"A7-Form", rootStr:4, relFrets:[-1,0,2,0,2,0]   },
  ],
  "Maj7": [
    { name:"Emaj7",   rootStr:5, relFrets:[0,2,1,1,0,0]    },
    { name:"Amaj7",   rootStr:4, relFrets:[-1,0,2,1,2,0]   },
  ],
  "Moll7": [
    { name:"Em7-Form",rootStr:5, relFrets:[0,2,0,0,0,0]    },
    { name:"Am7-Form",rootStr:4, relFrets:[-1,0,2,0,1,0]   },
  ],
};

const CHORD_TYPE_INTERVALS = {
  "Dur":   [0,4,7],
  "Moll":  [0,3,7],
  "Dom7":  [0,4,7,10],
  "Maj7":  [0,4,7,11],
  "Moll7": [0,3,7,10],
};

function getVoicingFrets(rootNote, template) {
  const { rootStr, relFrets } = template;
  const rootFret = ((rootNote - TUNING[rootStr]) % 12 + 12) % 12 || 12;
  return relFrets.map(f => f === -1 ? -1 : rootFret + f);
}

const GUITAR_STRING_FREQS = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNoteAt(s, f) { return (TUNING[s] + f) % 12; }
function displayName(i) { const n = NOTES[i]; return NOTE_LABELS[n] || n; }
function normF(f) { return f < 0 ? f + 12 : f; }

// ─── CAGED Shapes ─────────────────────────────────────────────────────────────

const CAGED_SHAPES = {
  E: (root) => {
    const f = ((root - TUNING[5]) % 12 + 12) % 12;
    return [
      { s:5, f: f,   d:0 },
      { s:4, f: f+2, d:2 },
      { s:3, f: f+2, d:0 },
      { s:2, f: f+1, d:1 },
      { s:1, f: f,   d:2 },
      { s:0, f: f,   d:0 },
    ].filter(n => n.f >= 0 && n.f <= FRET_COUNT);
  },
  A: (root) => {
    const f = ((root - TUNING[4]) % 12 + 12) % 12 || 12;
    return [
      { s:4, f: f,   d:0 },
      { s:3, f: f+2, d:2 },
      { s:2, f: f+2, d:0 },
      { s:1, f: f+2, d:1 },
      { s:0, f: f,   d:2 },
    ].filter(n => n.f >= 0 && n.f <= FRET_COUNT);
  },
  G: (root) => {
    const f = ((root - TUNING[5]) % 12 + 12) % 12 || 12;
    return [
      { s:5, f: f,           d:0 },
      { s:4, f: normF(f-1),  d:1 },
      { s:3, f: normF(f-3),  d:2 },
      { s:2, f: normF(f-3),  d:0 },
      { s:1, f: normF(f-3),  d:1 },
      { s:0, f: f,           d:0 },
    ].filter(n => n.f >= 0 && n.f <= FRET_COUNT);
  },
  C: (root) => {
    const f = ((root - TUNING[4]) % 12 + 12) % 12 || 12;
    return [
      { s:4, f: f,           d:0 },
      { s:3, f: normF(f-1),  d:1 },
      { s:2, f: normF(f-3),  d:2 },
      { s:1, f: normF(f-2),  d:0 },
      { s:0, f: normF(f-3),  d:1 },
    ].filter(n => n.f >= 0 && n.f <= FRET_COUNT);
  },
  D: (root) => {
    const f = ((root - TUNING[3]) % 12 + 12) % 12;
    return [
      { s:3, f: f,   d:0 },
      { s:2, f: f+2, d:2 },
      { s:1, f: f+3, d:0 },
      { s:0, f: f+2, d:1 },
    ].filter(n => n.f >= 0 && n.f <= FRET_COUNT);
  },
};

// ─── Triad voicing ────────────────────────────────────────────────────────────

function getTriadVoicing(rootNote, intervals, inversion, groupIdx) {
  const group = TRIAD_GROUPS[groupIdx];
  const pool = intervals.map(i => (rootNote + i) % 12);
  const degOrder = [[0,1,2],[1,2,0],[2,0,1]][inversion];
  const target = degOrder.map(d => pool[d]);

  for (let f0 = 0; f0 <= FRET_COUNT; f0++) {
    if (getNoteAt(group[0], f0) !== target[0]) continue;
    for (let f1 = Math.max(0,f0-2); f1 <= Math.min(FRET_COUNT,f0+5); f1++) {
      if (getNoteAt(group[1], f1) !== target[1]) continue;
      for (let f2 = Math.max(0,f1-2); f2 <= Math.min(FRET_COUNT,f1+5); f2++) {
        if (getNoteAt(group[2], f2) !== target[2]) continue;
        if (Math.max(f0,f1,f2) - Math.min(f0,f1,f2) <= 4) {
          return [
            { s:group[0], f:f0, d:degOrder[0] },
            { s:group[1], f:f1, d:degOrder[1] },
            { s:group[2], f:f2, d:degOrder[2] },
          ];
        }
      }
    }
  }
  return null;
}

// ─── Pitch detection ──────────────────────────────────────────────────────────

function autoCorrelate(buf, sampleRate) {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.005) return -1;

  let r1 = 0, r2 = buf.length - 1;
  for (let i = 0; i < buf.length / 2; i++) { if (Math.abs(buf[i]) < 0.1) { r1 = i; break; } }
  for (let i = 1; i < buf.length / 2; i++) { if (Math.abs(buf[buf.length-i]) < 0.1) { r2 = buf.length-i; break; } }

  const t = buf.slice(r1, r2);
  const SIZE = t.length;
  const c = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE-i; j++) c[i] += t[j]*t[j+i];

  let d = 0;
  while (d < SIZE && c[d] > c[d+1]) d++;
  let maxVal = -1, maxPos = -1;
  for (let i = d; i < SIZE; i++) { if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; } }
  if (maxPos <= 0 || maxPos >= SIZE-1) return -1;

  const x1 = c[maxPos-1], x2 = c[maxPos], x3 = c[maxPos+1];
  const a = (x1+x3-2*x2)/2, b = (x3-x1)/2;
  return sampleRate / (a ? maxPos - b/(2*a) : maxPos);
}

function freqToNoteInfo(freq) {
  if (freq <= 0) return null;
  const n = 12 * Math.log2(freq / 440) + 69;
  const r = Math.round(n);
  return {
    noteIdx: ((r%12)+12)%12,
    noteName: NOTES[((r%12)+12)%12],
    octave: Math.floor(r/12) - 1,
    cents: Math.round((n-r)*100),
    freq,
  };
}

// ─── Fonts ────────────────────────────────────────────────────────────────────

const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@300;400&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [category, setCategory] = useState("theorie"); // "theorie" | "praxis"
  const [mode, setMode]         = useState("scales");

  const [rootNote, setRootNote]       = useState(0);
  const [hoveredFret, setHoveredFret] = useState(null);

  const [selectedScale, setSelectedScale]   = useState("Moll-Pentatonik");
  const [highlightRoot, setHighlightRoot]   = useState(true);

  const [cagedShape, setCagedShape] = useState("E");

  const [triadType, setTriadType]           = useState("Dur");
  const [triadInversion, setTriadInversion] = useState(0);
  const [triadGroup, setTriadGroup]         = useState(0);

  const [selectedInterval, setSelectedInterval] = useState("Reine Quinte (P5)");
  const [finderNote, setFinderNote]             = useState(0);

  const [chordType, setChordType]           = useState("Dur");
  const [chordVoicingIdx, setChordVoicingIdx] = useState(0);

  const [timingActive, setTimingActive] = useState(false);
  const [timingHits, setTimingHits]     = useState([]);
  const [timingError, setTimingError]   = useState(null);
  const timingCtxRef    = useRef(null);
  const timingStreamRef = useRef(null);
  const timingRafRef    = useRef(null);
  const beatTimesRef    = useRef([]);
  const lastOnsetRef    = useRef(0);

  const [tunerActive, setTunerActive] = useState(false);
  const [tunerNote, setTunerNote]     = useState(null);
  const [tunerError, setTunerError]   = useState(null);
  const audioCtxRef   = useRef(null);
  const analyserRef   = useRef(null);
  const streamRef     = useRef(null);
  const rafRef        = useRef(null);
  const freqHistoryRef = useRef([]);
  const stableRef     = useRef({ key: null, count: 0 });
  const silenceRef    = useRef(0);

  const [bpm, setBpm]                 = useState(100);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [metroPlaying, setMetroPlaying] = useState(false);
  const [currentBeat, setCurrentBeat]   = useState(-1);
  const metroCtxRef     = useRef(null);
  const schedulerRef    = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const currentBeatRef  = useRef(0);
  const bpmRef          = useRef(100);
  const beatsRef        = useRef(4);
  const tapTimesRef     = useRef([]);

  const stopTuner = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current) audioCtxRef.current.close();
    audioCtxRef.current = analyserRef.current = streamRef.current = rafRef.current = null;
    freqHistoryRef.current = [];
    stableRef.current = { key: null, count: 0 };
    silenceRef.current = 0;
    setTunerActive(false);
    setTunerNote(null);
  }, []);

  const startTuner = useCallback(async () => {
    setTunerError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyserRef.current = analyser;
      const gain = ctx.createGain();
      gain.gain.value = 2;
      ctx.createMediaStreamSource(stream).connect(gain);
      gain.connect(analyser);
      setTunerActive(true);

      const buf = new Float32Array(analyser.fftSize);
      let lastTs = 0;

      const tick = (ts) => {
        rafRef.current = requestAnimationFrame(tick);
        if (ts - lastTs < 70) return;
        lastTs = ts;

        analyser.getFloatTimeDomainData(buf);
        const raw = autoCorrelate(buf, ctx.sampleRate);

        if (raw < 0) {
          silenceRef.current++;
          if (silenceRef.current > 8) {
            setTunerNote(null);
            freqHistoryRef.current = [];
            stableRef.current = { key: null, count: 0 };
          }
          return;
        }
        silenceRef.current = 0;

        const hist = freqHistoryRef.current;
        hist.push(raw);
        if (hist.length > 8) hist.shift();
        const sorted = [...hist].sort((a, b) => a - b);
        const smoothed = sorted[Math.floor(sorted.length / 2)];

        const info = freqToNoteInfo(smoothed);
        if (!info) return;

        const key = info.noteName + info.octave;
        if (stableRef.current.key === key) {
          stableRef.current.count++;
        } else {
          stableRef.current = { key, count: 1 };
        }
        if (stableRef.current.count >= 3) setTunerNote(info);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setTunerError("Mikrofon-Zugriff verweigert.");
    }
  }, []);

  useEffect(() => () => stopTuner(), [stopTuner]);

  // ─── Metronome ────────────────────────────────────────────────────────────

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { beatsRef.current = beatsPerBar; }, [beatsPerBar]);

  const scheduleClick = useCallback((time, isAccent) => {
    const ctx = metroCtxRef.current;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.connect(env);
    env.connect(ctx.destination);
    osc.frequency.value = isAccent ? 1400 : 880;
    env.gain.setValueAtTime(isAccent ? 0.7 : 0.4, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    osc.start(time);
    osc.stop(time + 0.05);
  }, []);

  const runScheduler = useCallback(() => {
    const ctx = metroCtxRef.current;
    if (!ctx) return;
    while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
      const beat = currentBeatRef.current % beatsRef.current;
      scheduleClick(nextNoteTimeRef.current, beat === 0);
      const delay = Math.max(0, (nextNoteTimeRef.current - ctx.currentTime) * 1000);
      const b = beat;
      const beatWallTime = performance.now() + delay;
      beatTimesRef.current.push(beatWallTime);
      if (beatTimesRef.current.length > 32) beatTimesRef.current.shift();
      setTimeout(() => setCurrentBeat(b), delay);
      nextNoteTimeRef.current += 60 / bpmRef.current;
      currentBeatRef.current++;
    }
  }, [scheduleClick]);

  const stopTiming = useCallback(() => {
    if (timingRafRef.current) cancelAnimationFrame(timingRafRef.current);
    if (timingStreamRef.current) timingStreamRef.current.getTracks().forEach(t => t.stop());
    if (timingCtxRef.current) timingCtxRef.current.close();
    timingCtxRef.current = timingStreamRef.current = timingRafRef.current = null;
    lastOnsetRef.current = 0;
    setTimingActive(false);
    setTimingHits([]);
    setTimingError(null);
  }, []);

  const startTiming = useCallback(async () => {
    setTimingError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
      timingStreamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      timingCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      const gain = ctx.createGain();
      gain.gain.value = 2;
      ctx.createMediaStreamSource(stream).connect(gain);
      gain.connect(analyser);
      setTimingActive(true);

      const buf = new Float32Array(analyser.fftSize);
      const THRESHOLD = 0.035;
      const COOLDOWN  = 300;

      const tick = () => {
        timingRafRef.current = requestAnimationFrame(tick);
        analyser.getFloatTimeDomainData(buf);
        let rms = 0;
        for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
        rms = Math.sqrt(rms / buf.length);
        const now = performance.now();
        if (rms < THRESHOLD || now - lastOnsetRef.current < COOLDOWN) return;
        lastOnsetRef.current = now;
        const beats = beatTimesRef.current;
        if (beats.length === 0) return;
        let nearestDelta = Infinity;
        for (const bt of beats) {
          const d = now - bt;
          if (Math.abs(d) < Math.abs(nearestDelta)) nearestDelta = d;
        }
        if (Math.abs(nearestDelta) > 2000) return;
        const quality = Math.abs(nearestDelta) < 50 ? "gut" : Math.abs(nearestDelta) < 100 ? "knapp" : "daneben";
        setTimingHits(prev => {
          const next = [...prev, { delta: Math.round(nearestDelta), quality }];
          return next.length > 8 ? next.slice(-8) : next;
        });
      };
      timingRafRef.current = requestAnimationFrame(tick);
    } catch {
      setTimingError("Mikrofon benötigt für Timing-Check.");
    }
  }, []);

  const stopMetronome = useCallback(() => {
    if (schedulerRef.current) clearInterval(schedulerRef.current);
    schedulerRef.current = null;
    beatTimesRef.current = [];
    setMetroPlaying(false);
    setCurrentBeat(-1);
    stopTiming();
  }, [stopTiming]);

  const startMetronome = useCallback(async () => {
    if (!metroCtxRef.current || metroCtxRef.current.state === "closed") {
      metroCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (metroCtxRef.current.state === "suspended") await metroCtxRef.current.resume();
    currentBeatRef.current = 0;
    nextNoteTimeRef.current = metroCtxRef.current.currentTime + 0.05;
    schedulerRef.current = setInterval(runScheduler, 25);
    setMetroPlaying(true);
  }, [runScheduler]);

  const handleTap = useCallback(() => {
    const now = performance.now();
    const taps = tapTimesRef.current;
    if (taps.length > 0 && now - taps[taps.length - 1] > 2000) tapTimesRef.current = [];
    tapTimesRef.current.push(now);
    if (tapTimesRef.current.length > 8) tapTimesRef.current.shift();
    if (tapTimesRef.current.length >= 2) {
      const intervals = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i-1]);
      const avg = intervals.reduce((a,b) => a+b,0) / intervals.length;
      const newBpm = Math.round(Math.min(240, Math.max(40, 60000 / avg)));
      setBpm(newBpm);
      bpmRef.current = newBpm;
    }
  }, []);

  useEffect(() => () => stopMetronome(), [stopMetronome]);
  useEffect(() => () => stopTiming(), [stopTiming]);

  // ─── Computed ─────────────────────────────────────────────────────────────

  const scaleNotes = useMemo(() =>
    mode === "scales" ? SCALES[selectedScale].map(i => (rootNote + i) % 12) : [],
  [mode, rootNote, selectedScale]);

  const intervalSemitones = INTERVALS[selectedInterval] || 7;

  const cagedData = useMemo(() => {
    if (mode !== "caged") return null;
    const notes = CAGED_SHAPES[cagedShape](rootNote);
    const map = new Map(notes.map(n => [`${n.s}-${n.f}`, n.d]));
    const frets = notes.map(n => n.f).filter(f => f > 0);
    return { map, minFret: frets.length ? Math.min(...frets) : 0, maxFret: frets.length ? Math.max(...frets) : 0 };
  }, [mode, rootNote, cagedShape]);

  const triadIntervals = TRIAD_TYPES[triadType];

  const triadVoicing = useMemo(() => {
    if (mode !== "triads") return null;
    return getTriadVoicing(rootNote, triadIntervals, triadInversion, triadGroup);
  }, [mode, rootNote, triadIntervals, triadInversion, triadGroup]);

  const voicingKeys = useMemo(() =>
    triadVoicing ? new Set(triadVoicing.map(n => `${n.s}-${n.f}`)) : new Set(),
  [triadVoicing]);

  const chordVoicingData = useMemo(() => {
    if (mode !== "chords") return null;
    const templates = CHORD_VOICING_TEMPLATES[chordType] || [];
    const idx = Math.min(chordVoicingIdx, templates.length - 1);
    const template = templates[idx];
    if (!template) return null;
    const absoluteFrets = getVoicingFrets(rootNote, template);
    return { template, absoluteFrets };
  }, [mode, chordType, chordVoicingIdx, rootNote]);

  // ─── Cell info ────────────────────────────────────────────────────────────

  const getCellInfo = useCallback((s, f) => {
    const noteIdx = getNoteAt(s, f);
    const noteName = NOTES[noteIdx];

    if (mode === "scales") {
      const deg = scaleNotes.indexOf(noteIdx);
      if (deg < 0) return { active: false, noteName };
      const isRoot = noteIdx === rootNote;
      return {
        active: true, noteName,
        color:  isRoot && highlightRoot ? "#fff" : DEGREE_COLORS[deg],
        bg:     isRoot && highlightRoot ? ACCENT : `${DEGREE_COLORS[deg]}18`,
        border: isRoot && highlightRoot ? "#a33515" : DEGREE_COLORS[deg],
        isRoot, degree: deg + 1,
      };
    }

    if (mode === "caged") {
      if (!cagedData || !cagedData.map.has(`${s}-${f}`)) return { active: false, noteName };
      const d = cagedData.map.get(`${s}-${f}`);
      const col = CHORD_COLORS[d];
      const isRoot = d === 0;
      return {
        active: true, noteName,
        color:  isRoot ? "#fff" : col,
        bg:     isRoot ? ACCENT : `${col}22`,
        border: isRoot ? "#a33515" : col,
        isRoot, label: ["R","3","5"][d],
      };
    }

    if (mode === "triads") {
      const degIdx = triadIntervals.findIndex(i => (rootNote + i) % 12 === noteIdx);
      if (degIdx < 0) return { active: false, noteName };
      const highlighted = voicingKeys.has(`${s}-${f}`);
      const col = CHORD_COLORS[degIdx];
      const isRoot = degIdx === 0 && highlighted;
      return {
        active: true, noteName,
        color:  isRoot ? "#fff" : col,
        bg:     highlighted ? (degIdx === 0 ? ACCENT : `${col}28`) : `${col}0c`,
        border: highlighted ? col : `${col}30`,
        isRoot, dimmed: !highlighted,
        label: ["R","3","5"][degIdx],
      };
    }

    if (mode === "intervals") {
      const isRoot   = noteIdx === rootNote;
      const isTarget = noteIdx === (rootNote + intervalSemitones) % 12;
      if (!isRoot && !isTarget) return { active: false, noteName };
      const col = isRoot ? ACCENT : INTERVAL_COLORS[intervalSemitones];
      return {
        active: true, noteName,
        color: "#fff", bg: col, border: col, isRoot,
        label: isRoot ? "R" : selectedInterval.match(/\((.+)\)/)?.[1],
      };
    }

    if (mode === "finder") {
      if (noteIdx !== finderNote) return { active: false, noteName };
      return { active: true, noteName, color: "#fff", bg: ACCENT, border: "#a33515", isRoot: false };
    }

    if (mode === "chords") {
      if (!chordVoicingData) return { active: false, noteName };
      const { absoluteFrets } = chordVoicingData;
      const stringFret = absoluteFrets[5 - s];
      if (stringFret === -1 || stringFret !== f) return { active: false, noteName };
      const intervals = CHORD_TYPE_INTERVALS[chordType] || [0,4,7];
      const degIdx = intervals.findIndex(i => (rootNote + i) % 12 === noteIdx);
      const degColors = [ACCENT, "#e67e22", "#2ecc71", "#3498db"];
      const col = degColors[Math.max(0, degIdx)];
      const labels = ["R","3","5","7"];
      return {
        active: true, noteName,
        color:  degIdx === 0 ? "#fff" : col,
        bg:     degIdx === 0 ? ACCENT : `${col}28`,
        border: col,
        isRoot: degIdx === 0,
        label:  labels[degIdx] ?? "",
      };
    }

    return { active: false, noteName };
  }, [mode, scaleNotes, rootNote, highlightRoot, cagedData, triadIntervals, voicingKeys, intervalSemitones, selectedInterval, finderNote, chordVoicingData, chordType]);

  const fretWidths = useMemo(() => {
    const w = [];
    for (let i = 0; i <= FRET_COUNT; i++) w.push(i === 0 ? 38 : Math.max(42, 72 - i * 1.8));
    return w;
  }, []);
  const totalWidth = fretWidths.reduce((a, b) => a + b, 0);

  // ─── JSX ──────────────────────────────────────────────────────────────────

  const CAT_LABELS = { theorie: "Schule", praxis: "Studio" };

  const SCHULE_TABS = [
    { id: "scales",    label: "Skalen"    },
    { id: "caged",     label: "CAGED"     },
    { id: "triads",    label: "Triaden"   },
    { id: "intervals", label: "Intervall" },
    { id: "finder",    label: "Finder"    },
  ];
  const STUDIO_TABS = [
    { id: "tuner",     label: "Stimmgerät" },
    { id: "metronome", label: "Metronom"   },
    { id: "chords",    label: "Akkorde"    },
  ];
  const currentTabs = category === "theorie" ? SCHULE_TABS : STUDIO_TABS;

  const switchCategory = (cat) => {
    if (cat === category) return;
    setCategory(cat);
    if (cat === "theorie") { setMode("scales"); stopTuner(); stopMetronome(); }
    else                   { setMode("tuner");  stopMetronome(); }
  };

  return (
    <div style={{ fontFamily:"'DM Mono','Menlo',monospace", fontWeight:300, background:BG, color:FG, minHeight:"100vh", padding:"16px", boxSizing:"border-box", WebkitFontSmoothing:"antialiased" }}>
      <div style={{ maxWidth:960, margin:"0 auto" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <h1 style={{ fontFamily:"'Instrument Serif',Georgia,serif", fontStyle:"italic", fontWeight:400, fontSize:"clamp(1.6rem,4vw,2.2rem)", margin:"0 0 20px", color:FG, letterSpacing:"-0.02em", lineHeight:1.05 }}>
          Griffbrett-Trainer
        </h1>

        {/* ── Category bar ────────────────────────────────────────────────── */}
        <div style={{ display:"flex", gap:0, borderBottom:`1px solid ${RULE}`, marginBottom:0 }}>
          {["theorie","praxis"].map(cat => (
            <button key={cat} onClick={() => switchCategory(cat)} style={{
              padding:"6px 0 9px", marginRight:24, border:"none",
              borderBottom: category===cat ? `1px solid ${FG}` : "1px solid transparent",
              marginBottom:"-1px", background:"transparent", cursor:"pointer",
              fontSize:"0.5625rem", fontWeight: category===cat ? 400 : 300,
              fontFamily:"'DM Mono','Menlo',monospace",
              letterSpacing:"0.15em", textTransform:"uppercase", transition:"all 0.15s",
              color: category===cat ? FG : MUTED,
            }}>{CAT_LABELS[cat]}</button>
          ))}
        </div>

        {/* ── Sub-tab bar ─────────────────────────────────────────────────── */}
        <div style={{ display:"flex", gap:0, marginBottom:16, marginTop:12, borderBottom:`1px solid ${RULE}` }}>
          {currentTabs.map(t => (
            <button key={t.id} onClick={() => setMode(t.id)} style={{
              flex:1, padding:"8px 0 10px", border:"none",
              borderBottom: mode===t.id ? `1px solid ${FG}` : "1px solid transparent",
              marginBottom:"-1px", background:"transparent", cursor:"pointer",
              fontSize:"0.6875rem", fontWeight:400, fontFamily:"'DM Mono','Menlo',monospace",
              letterSpacing:"0.1em", textTransform:"uppercase", transition:"all 0.15s",
              color: mode===t.id ? FG : MUTED,
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── Praxis panels ───────────────────────────────────────────────── */}
        {mode === "tuner" && (
          <TunerPanel
            tunerActive={tunerActive} tunerNote={tunerNote} tunerError={tunerError}
            startTuner={startTuner} stopTuner={stopTuner}
          />
        )}
        {mode === "metronome" && (
          <MetronomePanel
            bpm={bpm} setBpm={setBpm} beatsPerBar={beatsPerBar} setBeatsPerBar={setBeatsPerBar}
            isPlaying={metroPlaying} currentBeat={currentBeat}
            onStart={startMetronome} onStop={stopMetronome} onTap={handleTap}
            timingActive={timingActive} timingHits={timingHits} timingError={timingError}
            onToggleTiming={() => timingActive ? stopTiming() : startTiming()}
          />
        )}

        {/* ── Fretboard modes ────────────────────────────────────────────── */}
        {(category === "theorie" || mode === "chords") && (<>

          {/* Controls */}
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"flex-end" }}>

            {mode !== "finder" && (
              <div style={{ flex:"1 1 110px" }}>
                <label style={labelStyle}>Grundton</label>
                <select value={rootNote} onChange={e => setRootNote(+e.target.value)} style={selectStyle}>
                  {NOTES.map((_, i) => <option key={i} value={i}>{displayName(i)}</option>)}
                </select>
              </div>
            )}

            {mode === "scales" && (
              <div style={{ flex:"2 1 160px" }}>
                <label style={labelStyle}>Skala / Modus</label>
                <select value={selectedScale} onChange={e => setSelectedScale(e.target.value)} style={selectStyle}>
                  {Object.keys(SCALES).map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}

            {mode === "caged" && (
              <div style={{ flex:"0 0 auto" }}>
                <label style={labelStyle}>Form</label>
                <div style={{ display:"flex", gap:4 }}>
                  {["C","A","G","E","D"].map(sh => (
                    <button key={sh} onClick={() => setCagedShape(sh)} style={{
                      width:36, height:36, border:`1px solid`, borderRadius:2, cursor:"pointer",
                      fontSize:"0.8125rem", fontWeight:400, fontFamily:"'DM Mono','Menlo',monospace",
                      transition:"all 0.15s",
                      background:  cagedShape===sh ? FG : "transparent",
                      borderColor: cagedShape===sh ? FG : RULE,
                      color:       cagedShape===sh ? BG : MUTED,
                    }}>{sh}</button>
                  ))}
                </div>
              </div>
            )}

            {mode === "triads" && (<>
              <div style={{ flex:"1 1 110px" }}>
                <label style={labelStyle}>Akkordtyp</label>
                <select value={triadType} onChange={e => setTriadType(e.target.value)} style={selectStyle}>
                  {Object.keys(TRIAD_TYPES).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex:"0 0 auto" }}>
                <label style={labelStyle}>Lage</label>
                <div style={{ display:"flex", gap:3 }}>
                  {TRIAD_INVERSIONS.map((lbl, i) => (
                    <button key={i} onClick={() => setTriadInversion(i)} style={{
                      padding:"7px 10px", border:`1px solid`, borderRadius:2, cursor:"pointer",
                      fontSize:"0.625rem", fontWeight:400, fontFamily:"'DM Mono','Menlo',monospace",
                      letterSpacing:"0.06em", textTransform:"uppercase", whiteSpace:"nowrap", transition:"all 0.15s",
                      background:  triadInversion===i ? FG : "transparent",
                      borderColor: triadInversion===i ? FG : RULE,
                      color:       triadInversion===i ? BG : MUTED,
                    }}>{lbl}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex:"0 0 auto" }}>
                <label style={labelStyle}>Saiten</label>
                <div style={{ display:"flex", gap:3 }}>
                  {TRIAD_GROUP_LABELS.map((lbl, i) => (
                    <button key={i} onClick={() => setTriadGroup(i)} style={{
                      padding:"7px 10px", border:`1px solid`, borderRadius:2, cursor:"pointer",
                      fontSize:"0.625rem", fontWeight:400, fontFamily:"'DM Mono','Menlo',monospace",
                      letterSpacing:"0.06em", textTransform:"uppercase", whiteSpace:"nowrap", transition:"all 0.15s",
                      background:  triadGroup===i ? ACCENT : "transparent",
                      borderColor: triadGroup===i ? ACCENT : RULE,
                      color:       triadGroup===i ? "#fff" : MUTED,
                    }}>{lbl}</button>
                  ))}
                </div>
              </div>
            </>)}

            {mode === "intervals" && (
              <div style={{ flex:"2 1 160px" }}>
                <label style={labelStyle}>Intervall</label>
                <select value={selectedInterval} onChange={e => setSelectedInterval(e.target.value)} style={selectStyle}>
                  {Object.keys(INTERVALS).map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}

            {mode === "finder" && (
              <div style={{ flex:"1 1 140px" }}>
                <label style={labelStyle}>Ton finden</label>
                <select value={finderNote} onChange={e => setFinderNote(+e.target.value)} style={selectStyle}>
                  {NOTES.map((_, i) => <option key={i} value={i}>{displayName(i)}</option>)}
                </select>
              </div>
            )}

            {mode === "chords" && (
              <div style={{ flex:"1 1 130px" }}>
                <label style={labelStyle}>Akkordtyp</label>
                <select value={chordType} onChange={e => { setChordType(e.target.value); setChordVoicingIdx(0); }} style={selectStyle}>
                  {Object.keys(CHORD_VOICING_TEMPLATES).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Info strip */}
          <div style={{ borderTop:`1px solid ${RULE}`, borderBottom:`1px solid ${RULE}`, padding:"8px 0", marginBottom:12, fontSize:"0.75rem", minHeight:32, display:"flex", alignItems:"center" }}>
            {mode === "scales" && <span>
              <span style={{ fontFamily:"'Instrument Serif',Georgia,serif", fontStyle:"italic", fontSize:"0.9375rem", color:ACCENT }}>{displayName(rootNote)} {selectedScale}</span>
              <span style={{ color:RULE, margin:"0 10px" }}>—</span>
              <span style={{ color:MUTED, letterSpacing:"0.03em" }}>{SCALES[selectedScale].map(i => displayName((rootNote+i)%12)).join("  ·  ")}</span>
            </span>}

            {mode === "caged" && <span>
              <span style={{ fontFamily:"'Instrument Serif',Georgia,serif", fontStyle:"italic", fontSize:"0.9375rem", color:ACCENT }}>{displayName(rootNote)}</span>
              <span style={{ color:MUTED }}> · {cagedShape}-Form</span>
              {cagedData && <span style={{ color:RULE }}> · Bund {cagedData.minFret}–{cagedData.maxFret}</span>}
              <span style={{ color:RULE, margin:"0 10px" }}>—</span>
              <span style={{ color:MUTED }}>{[0,4,7].map(i => displayName((rootNote+i)%12)).join("  ·  ")}</span>
            </span>}

            {mode === "triads" && <span>
              <span style={{ fontFamily:"'Instrument Serif',Georgia,serif", fontStyle:"italic", fontSize:"0.9375rem", color:ACCENT }}>{displayName(rootNote)} {triadType}</span>
              <span style={{ color:MUTED }}> · {TRIAD_INVERSIONS[triadInversion]}</span>
              <span style={{ color:RULE, margin:"0 10px" }}>—</span>
              <span style={{ color:MUTED }}>{triadIntervals.map(i => displayName((rootNote+i)%12)).join("  ·  ")}</span>
            </span>}

            {mode === "intervals" && <span>
              <span style={{ fontFamily:"'Instrument Serif',Georgia,serif", fontStyle:"italic", fontSize:"0.9375rem", color:ACCENT }}>{displayName(rootNote)}</span>
              <span style={{ color:MUTED, margin:"0 8px" }}>→</span>
              <span style={{ fontFamily:"'Instrument Serif',Georgia,serif", fontStyle:"italic", fontSize:"0.9375rem", color:INTERVAL_COLORS[intervalSemitones] }}>{displayName((rootNote+intervalSemitones)%12)}</span>
              <span style={{ color:RULE, margin:"0 10px" }}>—</span>
              <span style={{ color:MUTED }}>{selectedInterval}</span>
            </span>}

            {mode === "finder" && <span>
              <span style={{ color:MUTED }}>Alle </span>
              <span style={{ fontFamily:"'Instrument Serif',Georgia,serif", fontStyle:"italic", fontSize:"0.9375rem", color:ACCENT }}>{displayName(finderNote)}</span>
              <span style={{ color:MUTED }}> auf dem Griffbrett</span>
            </span>}

            {mode === "chords" && chordVoicingData && <span>
              <span style={{ fontFamily:"'Instrument Serif',Georgia,serif", fontStyle:"italic", fontSize:"0.9375rem", color:ACCENT }}>{displayName(rootNote)} {chordType}</span>
              <span style={{ color:MUTED }}> · {chordVoicingData.template.name}</span>
              <span style={{ color:RULE, margin:"0 10px" }}>—</span>
              <span style={{ color:MUTED }}>{(CHORD_TYPE_INTERVALS[chordType]||[]).map(i => displayName((rootNote+i)%12)).join("  ·  ")}</span>
            </span>}
          </div>

          {/* ── Fretboard ──────────────────────────────────────────────── */}
          <div style={{ overflowX:"auto", paddingBottom:4 }}>
            <div style={{ minWidth:totalWidth+40, position:"relative" }}>

              {/* Fret numbers */}
              <div style={{ display:"flex", marginLeft:30, marginBottom:4 }}>
                {fretWidths.map((w, f) => (
                  <div key={f} style={{ width:w, textAlign:"center", fontSize:"0.5625rem", color:"#b5b1aa", flexShrink:0, fontWeight:400, letterSpacing:"0.05em" }}>
                    {f === 0 ? "" : f}
                  </div>
                ))}
              </div>

              {/* Board */}
              <div style={{ background:CARD, borderRadius:3, padding:"10px 0", position:"relative", border:`1px solid ${RULE}`, overflow:"hidden" }}>

                {/* Dot markers */}
                <div style={{ display:"flex", position:"absolute", top:0, bottom:0, left:30, pointerEvents:"none" }}>
                  {fretWidths.map((w, f) => (
                    <div key={f} style={{ width:w, flexShrink:0, position:"relative" }}>
                      {DOT_FRETS.includes(f) && (DOUBLE_DOT.includes(f) ? <>
                        <div style={{ position:"absolute", left:"50%", top:"25%", transform:"translate(-50%,-50%)", width:5, height:5, borderRadius:"50%", background:RULE }} />
                        <div style={{ position:"absolute", left:"50%", top:"75%", transform:"translate(-50%,-50%)", width:5, height:5, borderRadius:"50%", background:RULE }} />
                      </> : <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", width:5, height:5, borderRadius:"50%", background:RULE }} />)}
                    </div>
                  ))}
                </div>

                {/* Strings */}
                {TUNING.map((_, s) => (
                  <div key={s} style={{ display:"flex", alignItems:"center", height:36 }}>
                    <div style={{ width:30, textAlign:"center", fontSize:"0.625rem", fontWeight:400, color:"#b5b1aa", flexShrink:0, zIndex:3, letterSpacing:"0.05em" }}>
                      {STRING_NAMES[s]}
                    </div>
                    {fretWidths.map((w, f) => {
                      const cell = getCellInfo(s, f);
                      const isHov = hoveredFret?.s===s && hoveredFret?.f===f;
                      return (
                        <div key={f}
                          style={{
                            width:w, height:36, flexShrink:0, position:"relative",
                            borderRight: f===0 ? `2px solid #c8c4be` : `1px solid #ece9e3`,
                            background:  f===0 ? "#f9f6f1" : "transparent",
                            display:"flex", alignItems:"center", justifyContent:"center",
                          }}
                          onMouseEnter={() => setHoveredFret({s,f})}
                          onMouseLeave={() => setHoveredFret(null)}
                        >
                          {f > 0 && (
                            <div style={{ position:"absolute", left:0, right:0, top:"50%", height:Math.max(1,1+s*0.4), background:"#ccc9c2", transform:"translateY(-50%)" }} />
                          )}
                          {cell.active ? (
                            <div style={{
                              width:  cell.dimmed ? 19 : 25,
                              height: cell.dimmed ? 19 : 25,
                              borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                              background: cell.bg, border:`1.5px solid ${cell.border}`,
                              color: cell.color, fontSize: cell.dimmed ? 8 : "0.5625rem", fontWeight:400,
                              fontFamily:"'DM Mono','Menlo',monospace",
                              zIndex:2, position:"relative",
                              opacity: cell.dimmed ? 0.35 : 1,
                              boxShadow: cell.isRoot ? `0 0 8px ${ACCENT}44` : "none",
                              transform: isHov && !cell.dimmed ? "scale(1.15)" : "scale(1)",
                              transition:"transform 0.12s",
                            }}>
                              {cell.dimmed ? "" : (cell.label || cell.noteName)}
                            </div>
                          ) : isHov && f > 0 ? (
                            <div style={{
                              width:20, height:20, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                              border:`1px solid ${RULE}`, color:"#c4c0ba",
                              fontSize:"0.5rem", fontWeight:400, fontFamily:"'DM Mono','Menlo',monospace",
                              zIndex:2, position:"relative",
                            }}>
                              {NOTES[getNoteAt(s,f)]}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* ── Legends ──────────────────────────────────────────────── */}

              {mode === "scales" && (
                <div style={{ display:"flex", gap:4, marginTop:10, flexWrap:"wrap", justifyContent:"center" }}>
                  {SCALES[selectedScale].map((interval, idx) => {
                    const ni = (rootNote+interval)%12;
                    return (
                      <div key={idx} style={{ display:"flex", alignItems:"center", gap:5, borderRadius:2, padding:"3px 8px", fontSize:"0.625rem", border:`1px solid ${RULE}`, fontWeight:400, letterSpacing:"0.05em", background:CARD }}>
                        <div style={{ width:14, height:14, borderRadius:"50%", background:idx===0?ACCENT:`${DEGREE_COLORS[idx]}18`, border:`1.5px solid ${idx===0?"#a33515":DEGREE_COLORS[idx]}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.5rem", fontWeight:400, color:idx===0?"#fff":DEGREE_COLORS[idx] }}>{idx+1}</div>
                        <span style={{ color:"#5a5651" }}>{displayName(ni)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {(mode === "caged" || mode === "triads") && (
                <div style={{ display:"flex", gap:8, marginTop:10, justifyContent:"center" }}>
                  {[["R",0],["3",1],["5",2]].map(([lbl, i]) => {
                    const ivs = mode==="caged" ? [0,4,7] : triadIntervals;
                    return (
                      <div key={lbl} style={{ display:"flex", alignItems:"center", gap:6, borderRadius:2, padding:"3px 10px", fontSize:"0.625rem", border:`1px solid ${RULE}`, fontWeight:400, letterSpacing:"0.08em", background:CARD }}>
                        <div style={{ width:10, height:10, borderRadius:"50%", background:CHORD_COLORS[i], flexShrink:0 }} />
                        <span style={{ color:"#5a5651", textTransform:"uppercase" }}>{lbl} = {displayName((rootNote+ivs[i])%12)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {mode === "chords" && (
                <div style={{ display:"flex", gap:8, marginTop:10, justifyContent:"center", flexWrap:"wrap" }}>
                  {(CHORD_TYPE_INTERVALS[chordType]||[]).map((iv, i) => {
                    const degColors = [ACCENT, "#e67e22", "#2ecc71", "#3498db"];
                    const labels = ["R","3","5","7"];
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:6, borderRadius:2, padding:"3px 10px", fontSize:"0.625rem", border:`1px solid ${RULE}`, fontWeight:400, letterSpacing:"0.08em", background:CARD }}>
                        <div style={{ width:10, height:10, borderRadius:"50%", background:degColors[i], flexShrink:0 }} />
                        <span style={{ color:"#5a5651", textTransform:"uppercase" }}>{labels[i]} = {displayName((rootNote+iv)%12)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom panels ──────────────────────────────────────────── */}

          {mode === "intervals" && (
            <div style={{ marginTop:14 }}>
              <p style={sectionLabel}>Schnellwahl</p>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {Object.entries(INTERVALS).map(([name, semi]) => (
                  <button key={name} onClick={() => setSelectedInterval(name)} style={{
                    padding:"5px 10px", border:`1px solid`, borderRadius:2, cursor:"pointer",
                    fontSize:"0.6875rem", fontWeight:400, fontFamily:"'DM Mono','Menlo',monospace",
                    letterSpacing:"0.04em", transition:"all 0.15s",
                    background:  selectedInterval===name ? INTERVAL_COLORS[semi] : "transparent",
                    borderColor: selectedInterval===name ? INTERVAL_COLORS[semi] : RULE,
                    color:       selectedInterval===name ? "#fff" : MUTED,
                  }}>{name.match(/\((.+)\)/)?.[1]}</button>
                ))}
              </div>
            </div>
          )}

          {mode === "finder" && (
            <div style={{ marginTop:14, borderTop:`1px solid ${RULE}`, paddingTop:12 }}>
              <p style={sectionLabel}>{displayName(finderNote)} – alle Positionen</p>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {TUNING.flatMap((_,sIdx) =>
                  Array.from({length:FRET_COUNT+1},(_,f)=>({s:sIdx,f}))
                    .filter(({s,f})=>getNoteAt(s,f)===finderNote)
                ).map(({s,f},i)=>(
                  <span key={i} style={{ padding:"3px 9px", background:ACCENT_SOFT, border:`1px solid ${ACCENT}30`, borderRadius:2, fontSize:"0.6875rem", color:ACCENT, fontWeight:400, letterSpacing:"0.04em" }}>
                    {STRING_NAMES[s]}{f===0?" leer":` Bund ${f}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {mode === "triads" && (
            <div style={{ marginTop:14, borderTop:`1px solid ${RULE}`, paddingTop:12 }}>
              <p style={sectionLabel}>Alle Lagen – {TRIAD_GROUP_LABELS[triadGroup]}</p>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {[0,1,2].map(inv => {
                  const v = getTriadVoicing(rootNote, triadIntervals, inv, triadGroup);
                  if (!v) return null;
                  const active = triadInversion === inv;
                  return (
                    <button key={inv} onClick={()=>setTriadInversion(inv)} style={{
                      padding:"9px 14px", border:`1px solid`, borderRadius:2, cursor:"pointer",
                      background:  active ? FG : "transparent",
                      borderColor: active ? FG : RULE,
                      textAlign:"left", transition:"all 0.15s", flex:"1 1 auto",
                      fontFamily:"'DM Mono','Menlo',monospace",
                    }}>
                      <div style={{ fontSize:"0.5625rem", fontWeight:400, color:active?"#888":MUTED, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.12em" }}>{TRIAD_INVERSIONS[inv]}</div>
                      <div style={{ display:"flex", gap:0 }}>
                        {v.map((n,ni)=>(
                          <span key={ni} style={{ fontSize:"0.75rem", fontWeight:400 }}>
                            <span style={{ color: active ? CHORD_COLORS[n.d] : CHORD_COLORS[n.d]+"66" }}>
                              {STRING_NAMES[n.s]}{n.f}
                            </span>
                            {ni < v.length-1 && <span style={{ color:active?"#666":RULE, fontWeight:300 }}> – </span>}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mode === "chords" && (
            <div style={{ marginTop:14, borderTop:`1px solid ${RULE}`, paddingTop:12 }}>
              <p style={sectionLabel}>Griffvarianten — {displayName(rootNote)} {chordType}</p>
              <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:4 }}>
                {(CHORD_VOICING_TEMPLATES[chordType] || []).map((tmpl, i) => (
                  <ChordDiagram
                    key={i} rootNote={rootNote} template={tmpl}
                    isActive={chordVoicingIdx === i}
                    onClick={() => setChordVoicingIdx(i)}
                  />
                ))}
              </div>
            </div>
          )}

        </>)}
      </div>
    </div>
  );
}

// ─── Tuner Panel ──────────────────────────────────────────────────────────────

function TunerPanel({ tunerActive, tunerNote, tunerError, startTuner, stopTuner }) {
  const cents = tunerNote?.cents ?? 0;
  const inTune = tunerNote && Math.abs(cents) <= 5;
  const meterColor = inTune ? "#2ecc71" : Math.abs(cents) <= 20 ? "#e67e22" : ACCENT;
  const meterPct = Math.min(Math.max((cents + 50) / 100, 0), 1);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:20 }}>

      {/* Main display */}
      <div style={{ background:CARD, border:`1px solid ${RULE}`, padding:"28px 20px 32px", textAlign:"center", borderRadius:3 }}>
        <div style={{ fontFamily:"'Instrument Serif',Georgia,serif", fontStyle:"italic", fontSize:"clamp(4rem,14vw,6rem)", fontWeight:400, lineHeight:1, letterSpacing:"-0.03em", minHeight:"4.5rem", color:tunerNote ? meterColor : "#d4d0ca", transition:"color 0.1s" }}>
          {tunerNote ? tunerNote.noteName : "—"}
          {tunerNote && <span style={{ fontSize:"1.5rem", fontWeight:400, color:MUTED, letterSpacing:0, marginLeft:4 }}>{tunerNote.octave}</span>}
        </div>
        <div style={{ fontSize:"0.6875rem", color:MUTED, marginTop:6, fontWeight:300, letterSpacing:"0.08em" }}>
          {tunerNote ? `${tunerNote.freq.toFixed(1)} Hz` : tunerActive ? "Warte auf Signal…" : "—"}
        </div>

        {/* Cents meter */}
        <div style={{ marginTop:24, position:"relative", height:44, padding:"0 12px" }}>
          <div style={{ position:"absolute", top:"50%", left:12, right:12, height:1, background:RULE, transform:"translateY(-50%)" }} />
          <div style={{ position:"absolute", top:6, bottom:6, left:"50%", width:1, background:RULE, transform:"translateX(-50%)" }} />
          {tunerNote && (
            <div style={{
              position:"absolute", top:"50%", width:14, height:14, borderRadius:"50%",
              background:meterColor, transform:"translate(-50%,-50%)",
              left:`calc(12px + ${meterPct} * (100% - 24px))`,
              transition:"left 0.08s ease-out, background 0.1s",
              boxShadow:`0 0 10px ${meterColor}88`,
            }} />
          )}
          <div style={{ position:"absolute", bottom:0, left:12, fontSize:"0.625rem", color:MUTED }}>♭</div>
          <div style={{ position:"absolute", bottom:0, right:12, fontSize:"0.625rem", color:MUTED }}>♯</div>
          <div style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", fontSize:"0.6875rem", fontWeight:400, transition:"color 0.1s", letterSpacing:"0.04em",
            color: inTune ? "#2ecc71" : tunerNote ? MUTED : RULE }}>
            {inTune ? "✓" : tunerNote ? `${cents>0?"+":""}${cents}¢` : "0¢"}
          </div>
        </div>
      </div>

      {/* String reference */}
      <div style={{ background:CARD, borderRadius:3, border:`1px solid ${RULE}`, padding:"12px 14px" }}>
        <p style={sectionLabel}>Standard-Stimmung</p>
        <div style={{ display:"flex", gap:4 }}>
          {GUITAR_STRING_FREQS.map((freq, i) => {
            const sIdx = 5 - i;
            const targetNote = TUNING[sIdx];
            const isActive = tunerNote?.noteIdx === targetNote;
            const isTuned  = isActive && Math.abs(tunerNote.cents) <= 10;
            const bg = isTuned ? "#2ecc71" : isActive ? meterColor : "transparent";
            const bdr = isTuned ? "#2ecc71" : isActive ? meterColor : RULE;
            return (
              <div key={i} style={{ flex:1, textAlign:"center" }}>
                <div style={{ border:`1px solid ${bdr}`, borderRadius:2, padding:"7px 4px", background:bg, transition:"all 0.1s" }}>
                  <div style={{ fontSize:"0.875rem", fontWeight:400, fontFamily:"'DM Mono','Menlo',monospace", color:isActive?"#fff":MUTED }}>{STRING_NAMES[sIdx]}</div>
                  <div style={{ fontSize:"0.5rem", color:isActive?"rgba(255,255,255,0.65)":RULE, marginTop:1, letterSpacing:"0.03em" }}>{freq}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Button */}
      <button onClick={tunerActive ? stopTuner : startTuner} style={{
        padding:"12px 24px", border:`1px solid`, borderRadius:3, cursor:"pointer",
        fontSize:"0.6875rem", fontWeight:400, fontFamily:"'DM Mono','Menlo',monospace",
        letterSpacing:"0.1em", textTransform:"uppercase", transition:"all 0.2s",
        background: tunerActive ? "transparent" : FG,
        borderColor: tunerActive ? RULE : FG,
        color:       tunerActive ? MUTED : BG,
      }}>
        {tunerActive ? "Mikrofon stoppen" : "Mikrofon starten"}
      </button>

      {tunerError && <div style={{ color:ACCENT, fontSize:"0.75rem", textAlign:"center", fontWeight:400, letterSpacing:"0.04em" }}>{tunerError}</div>}
    </div>
  );
}

// ─── Metronome Panel ──────────────────────────────────────────────────────────

function MetronomePanel({ bpm, setBpm, beatsPerBar, setBeatsPerBar, isPlaying, currentBeat, onStart, onStop, onTap, timingActive, timingHits, timingError, onToggleTiming }) {
  const [bpmEditing, setBpmEditing] = useState(false);
  const btnBase = {
    border:`1px solid ${RULE}`, borderRadius:3, cursor:"pointer",
    background:"transparent", fontFamily:"'DM Mono','Menlo',monospace",
    fontWeight:400, letterSpacing:"0.06em", transition:"all 0.15s", color:FG,
  };
  const bigTextStyle = {
    fontFamily:"'Instrument Serif',Georgia,serif", fontStyle:"italic", fontWeight:400,
    fontSize:"clamp(3.5rem,12vw,5rem)", lineHeight:1, letterSpacing:"-0.03em",
    minWidth:"3.5ch", textAlign:"center", transition:"color 0.2s",
  };
  const timingScore = timingHits.length > 0
    ? Math.round(timingHits.filter(h => h.quality === "gut").length / timingHits.length * 100)
    : null;
  const timingColors = { gut:"#2ecc71", knapp:"#e67e22", daneben:ACCENT };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:20 }}>

      {/* BPM display */}
      <div style={{ background:CARD, border:`1px solid ${RULE}`, borderRadius:3, padding:"28px 20px 24px", textAlign:"center" }}>
        <div style={{ fontSize:"0.5625rem", color:MUTED, textTransform:"uppercase", letterSpacing:"0.12em", fontFamily:"'DM Mono','Menlo',monospace", marginBottom:14 }}>Tempo</div>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:20 }}>
          <button onPointerDown={() => setBpm(b => Math.max(40, b - 1))} style={{ ...btnBase, padding:"8px 16px", fontSize:"1.25rem", lineHeight:1 }}>−</button>
          {bpmEditing ? (
            <input
              type="number" autoFocus defaultValue={bpm} min={40} max={240}
              onBlur={e => { setBpm(Math.round(Math.min(240, Math.max(40, +e.target.value || bpm)))); setBpmEditing(false); }}
              onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setBpmEditing(false); }}
              style={{ ...bigTextStyle, color: isPlaying ? ACCENT : FG, background:"transparent", border:"none", outline:`1px solid ${RULE}`, borderRadius:2, padding:"0 4px", width:"4ch" }}
            />
          ) : (
            <div onClick={() => setBpmEditing(true)} title="Klicken zum Eingeben" style={{ ...bigTextStyle, color: isPlaying ? ACCENT : FG, cursor:"text" }}>
              {bpm}
            </div>
          )}
          <button onPointerDown={() => setBpm(b => Math.min(240, b + 1))} style={{ ...btnBase, padding:"8px 16px", fontSize:"1.25rem", lineHeight:1 }}>+</button>
        </div>

        <div style={{ fontSize:"0.5625rem", color:MUTED, textTransform:"uppercase", letterSpacing:"0.12em", fontFamily:"'DM Mono','Menlo',monospace", marginTop:6 }}>bpm</div>

        {/* Beat dots */}
        <div style={{ display:"flex", justifyContent:"center", gap:10, marginTop:22 }}>
          {Array.from({ length: beatsPerBar }).map((_, i) => (
            <div key={i} style={{
              width:10, height:10, borderRadius:"50%",
              background: i === currentBeat ? (i === 0 ? ACCENT : FG) : RULE,
              transition:"background 0.05s",
            }} />
          ))}
        </div>

        {/* Timing hit dots */}
        {timingActive && timingHits.length > 0 && (
          <div style={{ marginTop:16, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
              {timingHits.map((h, i) => (
                <div key={i} style={{ width:10, height:10, borderRadius:"50%", background:timingColors[h.quality], transition:"background 0.1s" }} title={`${h.delta > 0 ? "+" : ""}${h.delta}ms`} />
              ))}
            </div>
            {timingScore !== null && (
              <div style={{ fontSize:"0.6875rem", fontWeight:400, color: timingScore >= 80 ? "#2ecc71" : timingScore >= 50 ? "#e67e22" : ACCENT, letterSpacing:"0.06em" }}>
                {timingScore}%
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls row */}
      <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
        <div style={{ flex:"0 0 90px" }}>
          <div style={{ fontSize:"0.5625rem", color:MUTED, display:"block", marginBottom:5, fontWeight:400, textTransform:"uppercase", letterSpacing:"0.12em", fontFamily:"'DM Mono','Menlo',monospace" }}>Taktart</div>
          <select value={beatsPerBar} onChange={e => setBeatsPerBar(+e.target.value)} style={{ width:"100%", padding:"7px 9px", borderRadius:2, border:`1px solid ${RULE}`, background:CARD, color:FG, fontSize:"0.8125rem", fontWeight:300, outline:"none", cursor:"pointer", fontFamily:"'DM Mono','Menlo',monospace" }}>
            {[2,3,4,6].map(n => <option key={n} value={n}>{n}/4</option>)}
          </select>
        </div>
        <button onClick={onTap} style={{ ...btnBase, flex:"1 1 0", padding:"8px 14px", fontSize:"0.6875rem", textTransform:"uppercase", letterSpacing:"0.1em", alignSelf:"flex-end", color:MUTED }}>
          Tap Tempo
        </button>
      </div>

      {/* Play / Stop + Timing toggle */}
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={isPlaying ? onStop : onStart} style={{
          flex:2, padding:"12px 24px", border:`1px solid`, borderRadius:3, cursor:"pointer",
          fontSize:"0.6875rem", fontWeight:400, fontFamily:"'DM Mono','Menlo',monospace",
          letterSpacing:"0.1em", textTransform:"uppercase", transition:"all 0.2s",
          background: isPlaying ? "transparent" : FG,
          borderColor: isPlaying ? RULE : FG,
          color:       isPlaying ? MUTED : BG,
        }}>
          {isPlaying ? "Stoppen" : "Starten"}
        </button>
        {isPlaying && (
          <button onClick={onToggleTiming} style={{
            flex:1, padding:"12px 14px", border:`1px solid`, borderRadius:3, cursor:"pointer",
            fontSize:"0.6875rem", fontWeight:400, fontFamily:"'DM Mono','Menlo',monospace",
            letterSpacing:"0.08em", textTransform:"uppercase", transition:"all 0.2s",
            background: timingActive ? FG : "transparent",
            borderColor: timingActive ? FG : RULE,
            color:       timingActive ? BG : MUTED,
          }}>
            {timingActive ? "● Timing" : "Timing"}
          </button>
        )}
      </div>

      {timingError && <div style={{ color:ACCENT, fontSize:"0.75rem", textAlign:"center", fontWeight:400, letterSpacing:"0.04em" }}>{timingError}</div>}
    </div>
  );
}

// ─── Chord Diagram ────────────────────────────────────────────────────────────

function ChordDiagram({ rootNote, template, isActive, onClick }) {
  const frets = getVoicingFrets(rootNote, template);
  const activeFrets = frets.filter(f => f !== -1);
  const minFret = activeFrets.length ? Math.min(...activeFrets) : 1;
  const maxFret = activeFrets.length ? Math.max(...activeFrets) : 5;
  const startFret = minFret <= 1 ? 1 : minFret;
  const FRETS = 5;
  const SS = 16; // string spacing
  const FS = 16; // fret spacing
  const PL = 18, PT = 24, PR = 8, PB = 16;
  const W = 5 * SS + PL + PR;
  const H = FRETS * FS + PT + PB;

  return (
    <div onClick={onClick} style={{
      cursor:"pointer", flexShrink:0, textAlign:"center",
      border:`1px solid`, borderRadius:3, padding:"10px 8px 8px",
      background: isActive ? ACCENT_SOFT : CARD,
      borderColor: isActive ? ACCENT : RULE,
      transition:"all 0.15s",
    }}>
      <svg width={W} height={H} style={{ display:"block", margin:"0 auto" }}>
        {/* Nut or fret number */}
        {startFret === 1
          ? <rect x={PL} y={PT - 3} width={5 * SS} height={3} fill={FG} rx={1} />
          : <text x={PL - 4} y={PT + FS / 2 + 4} textAnchor="end" fontSize={9} fill={MUTED} fontFamily="'DM Mono',monospace">{startFret}</text>
        }
        {/* Fret lines */}
        {Array.from({ length: FRETS + 1 }, (_, i) => (
          <line key={i} x1={PL} x2={PL + 5 * SS} y1={PT + i * FS} y2={PT + i * FS} stroke={RULE} strokeWidth={1} />
        ))}
        {/* String lines */}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={i} x1={PL + i * SS} x2={PL + i * SS} y1={PT} y2={PT + FRETS * FS} stroke={RULE} strokeWidth={1} />
        ))}
        {/* Dots and mute/open markers */}
        {frets.map((f, strIdx) => {
          const x = PL + (5 - strIdx) * SS;
          if (f === -1) return (
            <text key={strIdx} x={x} y={PT - 6} textAnchor="middle" fontSize={10} fill={MUTED} fontFamily="'DM Mono',monospace">×</text>
          );
          if (f === 0) return (
            <circle key={strIdx} cx={x} cy={PT - 8} r={4} fill="none" stroke={MUTED} strokeWidth={1} />
          );
          const row = f - startFret + 1;
          if (row < 1 || row > FRETS) return null;
          const y = PT + (row - 0.5) * FS;
          const isRoot = strIdx === template.rootStr;
          return (
            <circle key={strIdx} cx={x} cy={y} r={6} fill={isRoot ? ACCENT : FG} />
          );
        })}
      </svg>
      <div style={{ fontSize:"0.5625rem", color: isActive ? ACCENT : MUTED, fontFamily:"'DM Mono','Menlo',monospace", letterSpacing:"0.06em", marginTop:4, textTransform:"uppercase" }}>
        {template.name}
      </div>
    </div>
  );
}

// ─── Style constants ───────────────────────────────────────────────────────────

const labelStyle = {
  fontSize:"0.5625rem", color:MUTED, display:"block", marginBottom:5,
  fontWeight:400, textTransform:"uppercase", letterSpacing:"0.12em",
  fontFamily:"'DM Mono','Menlo',monospace",
};

const sectionLabel = {
  fontSize:"0.5625rem", color:MUTED, marginBottom:8,
  fontWeight:400, textTransform:"uppercase", letterSpacing:"0.12em",
  fontFamily:"'DM Mono','Menlo',monospace",
};

const selectStyle = {
  width:"100%", padding:"7px 9px", borderRadius:2, border:`1px solid ${RULE}`,
  background:CARD, color:FG, fontSize:"0.8125rem", fontWeight:300, outline:"none",
  appearance:"auto", cursor:"pointer", fontFamily:"'DM Mono','Menlo',monospace",
  WebkitAppearance:"auto",
};
