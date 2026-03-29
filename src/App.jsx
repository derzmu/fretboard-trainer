import { useState, useCallback, useMemo, useRef, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_LABELS = { "C#": "C#/Db", "D#": "D#/Eb", "F#": "F#/Gb", "G#": "G#/Ab", "A#": "A#/Bb" };
const TUNING = [4, 11, 7, 2, 9, 4]; // e B G D A E (index 0 = highest string) — default / module-level
const STRING_NAMES = ["e", "B", "G", "D", "A", "E"];
const FRET_COUNT = 15; // module-level default; runtime value is activeFretCount
const DOT_FRETS = [3, 5, 7, 9, 12, 15];
const DOUBLE_DOT = [12];

// Portfolio palette
const ACCENT      = "#c4401a";
const ACCENT_SOFT = "#c4401a18";
const BG          = "#f5f2ed";
const CARD        = "#fff";
const RULE        = "#d4d0ca";
const FG          = "#1a1a18";
const MUTED       = "#9e9a93";

const DEGREE_COLORS = ["#c4401a","#e67e22","#b8920a","#2ecc71","#1abc9c","#3498db","#9b59b6","#e91e63","#00bcd4","#8bc34a","#ff5722","#607d8b"];
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

// ─── Tuning presets ───────────────────────────────────────────────────────────

const TUNING_PRESETS = {
  "Standard E": [4,11,7,2,9,4],
  "Drop D":     [4,11,7,2,9,2],
  "Eb (♭½)":    [3,10,6,1,8,3],
  "D (♭1)":     [2, 9,5,0,7,2],
  "Open G":     [2,11,7,2,7,2],
  "DADGAD":     [2, 9,7,2,9,2],
};

// ─── Diatonic chords (7-note scales only) ─────────────────────────────────────

const ROMAN = ["I","II","III","IV","V","VI","VII"];

function getDiatonicChords(scale, rootNote) {
  if (scale.length !== 7) return null;
  return scale.map((deg, i) => {
    const root = (rootNote + deg) % 12;
    const thirdInterval = ((scale[(i+2)%7] - deg) % 12 + 12) % 12;
    const fifthInterval = ((scale[(i+4)%7] - deg) % 12 + 12) % 12;
    const quality = thirdInterval === 4 && fifthInterval === 7 ? "maj"
                  : thirdInterval === 3 && fifthInterval === 7 ? "min"
                  : thirdInterval === 3 && fifthInterval === 6 ? "dim" : "";
    return { root, quality, degree: i };
  });
}

// ─── Chord Voicing Templates ───────────────────────────────────────────────────

const CHORD_VOICING_TEMPLATES = {
  "Dur": [
    { name:"E-Form",  rootStr:5, nativeRoot:4, relFrets:[0,2,2,1,0,0]       },
    { name:"A-Form",  rootStr:4, nativeRoot:9, relFrets:[-1,0,2,2,2,0]      },
    { name:"D-Form",  rootStr:3, nativeRoot:2, relFrets:[-1,-1,0,2,3,2]     },
    { name:"G-Form",  rootStr:5, nativeRoot:7, relFrets:[0,-3,-3,-3,-1,0]   },
    { name:"C-Form",  rootStr:4, nativeRoot:0, relFrets:[-1,0,-1,-3,-2,-3]  },
  ],
  "Moll": [
    { name:"Em-Form", rootStr:5, nativeRoot:4, relFrets:[0,2,2,0,0,0]       },
    { name:"Am-Form", rootStr:4, nativeRoot:9, relFrets:[-1,0,2,2,1,0]      },
    { name:"Dm-Form", rootStr:3, nativeRoot:2, relFrets:[-1,-1,0,2,3,1]     },
    { name:"Gm-Form", rootStr:5, nativeRoot:7, relFrets:[0,0,-3,-3,-2,0]    },
  ],
  "Dom7": [
    { name:"E7-Form", rootStr:5, nativeRoot:4, relFrets:[0,2,0,1,0,0]       },
    { name:"A7-Form", rootStr:4, nativeRoot:9, relFrets:[-1,0,2,0,2,0]      },
    { name:"G7-Form", rootStr:5, nativeRoot:7, relFrets:[-2,-3,-3,-3,-1,0]  },
    { name:"C7-Form", rootStr:4, nativeRoot:0, relFrets:[-3,-2,0,-1,0,-1]   },
  ],
  "Maj7": [
    { name:"Emaj7",   rootStr:5, nativeRoot:4, relFrets:[0,2,1,1,0,0]       },
    { name:"Amaj7",   rootStr:4, nativeRoot:9, relFrets:[-1,0,2,1,2,0]      },
    { name:"Gmaj7",   rootStr:5, nativeRoot:7, relFrets:[-1,-3,-3,-3,-1,0]  },
    { name:"Cmaj7",   rootStr:4, nativeRoot:0, relFrets:[-3,-3,-3,-1,0,-1]  },
  ],
  "Moll7": [
    { name:"Em7-Form",rootStr:5, nativeRoot:4, relFrets:[0,2,0,0,0,0]       },
    { name:"Am7-Form",rootStr:4, nativeRoot:9, relFrets:[-1,0,2,0,1,0]      },
    { name:"Gm7-Form",rootStr:5, nativeRoot:7, relFrets:[-2,0,-3,-3,-2,0]   },
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
  let rootFret = ((rootNote - TUNING[rootStr]) % 12 + 12) % 12 || 12;
  let frets = relFrets.map(f => f === -1 ? -1 : rootFret + f);
  if (frets.some(f => f !== -1 && f < 0)) {
    rootFret += 12;
    frets = relFrets.map(f => f === -1 ? -1 : rootFret + f);
  }
  return frets;
}

const GUITAR_STRING_FREQS = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNoteAt(s, f) { return (TUNING[s] + f) % 12; }
function displayName(i) { const n = NOTES[i]; return NOTE_LABELS[n] || n; }

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
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 1500); return () => clearTimeout(t); }, []);

  const [category, setCategory] = useState("praxis"); // "theorie" | "praxis"
  const [mode, setMode]         = useState("tuner");

  const [rootNote, setRootNote]       = useState(0);
  const [hoveredFret, setHoveredFret] = useState(null);

  const [selectedScale, setSelectedScale] = useState("Dur (Ionisch)");
  const [highlightRoot, setHighlightRoot] = useState(true);

  const [finderNote, setFinderNote] = useState(0);

  const [chordType, setChordType]             = useState("Dur");
  const [chordVoicingIdx, setChordVoicingIdx] = useState(0);

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fbt-settings")) || {}; } catch { return {}; }
  });

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
      setTimeout(() => setCurrentBeat(b), delay);
      nextNoteTimeRef.current += 60 / bpmRef.current;
      currentBeatRef.current++;
    }
  }, [scheduleClick]);

  const stopMetronome = useCallback(() => {
    if (schedulerRef.current) clearInterval(schedulerRef.current);
    schedulerRef.current = null;
    setMetroPlaying(false);
    setCurrentBeat(-1);
  }, []);

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

  // ─── Settings ─────────────────────────────────────────────────────────────

  const setSetting = (key, val) => setSettings(s => ({ ...s, [key]: val }));
  useEffect(() => {
    try { localStorage.setItem("fbt-settings", JSON.stringify(settings)); } catch {}
  }, [settings]);

  const leftHanded     = settings.leftHanded  ?? false;
  const tuningKey      = settings.tuningKey   ?? "Standard E";
  const activeFretCount = settings.fretCount  ?? 15;
  const activeTuning   = TUNING_PRESETS[tuningKey] ?? TUNING_PRESETS["Standard E"];

  useEffect(() => {
    if (mode === "chords") setChordVoicingIdx(0);
  }, [rootNote, mode]);

  // ─── Computed ─────────────────────────────────────────────────────────────

  const scaleNotes = useMemo(() =>
    mode === "scales" ? SCALES[selectedScale].map(i => (rootNote + i) % 12) : [],
  [mode, rootNote, selectedScale]);

  const sortedChordTemplates = useMemo(() => {
    const templates = CHORD_VOICING_TEMPLATES[chordType] || [];
    return [...templates].sort((a, b) => {
      const da = Math.min((rootNote - a.nativeRoot + 12) % 12, (a.nativeRoot - rootNote + 12) % 12);
      const db = Math.min((rootNote - b.nativeRoot + 12) % 12, (b.nativeRoot - rootNote + 12) % 12);
      return da - db;
    });
  }, [chordType, rootNote]);

  const chordVoicingData = useMemo(() => {
    if (mode !== "chords") return null;
    const idx = Math.min(chordVoicingIdx, sortedChordTemplates.length - 1);
    const template = sortedChordTemplates[idx];
    if (!template) return null;
    const absoluteFrets = getVoicingFrets(rootNote, template);
    return { template, absoluteFrets };
  }, [mode, sortedChordTemplates, chordVoicingIdx, rootNote]);

  // ─── Cell info ────────────────────────────────────────────────────────────

  const getCellInfo = useCallback((s, f) => {
    const noteIdx = (activeTuning[s] + f) % 12;
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
  }, [mode, scaleNotes, rootNote, highlightRoot, finderNote, chordVoicingData, chordType, activeTuning]);

  const fretWidths = useMemo(() => {
    const w = [];
    for (let i = 0; i <= activeFretCount; i++) w.push(i === 0 ? 38 : Math.max(42, 72 - i * 1.8));
    return w;
  }, [activeFretCount]);
  const totalWidth = fretWidths.reduce((a, b) => a + b, 0);

  // ─── JSX ──────────────────────────────────────────────────────────────────

  const CAT_LABELS = { praxis: "Studio", theorie: "Theorie" };

  const STUDIO_TABS = [
    { id: "tuner",     label: "Stimmgerät" },
    { id: "metronome", label: "Metronom"   },
  ];
  const THEORIE_TABS = [
    { id: "finder", label: "Töne"    },
    { id: "scales", label: "Skalen"  },
    { id: "chords", label: "Akkorde" },
  ];
  const currentTabs = category === "praxis" ? STUDIO_TABS : THEORIE_TABS;

  const switchCategory = (cat) => {
    if (cat === category) return;
    setCategory(cat);
    if (cat === "praxis")  { setMode("tuner");  stopMetronome(); }
    else                   { setMode("finder"); stopTuner(); stopMetronome(); }
  };

  return (
    <div style={{ fontFamily:"'DM Mono','Menlo',monospace", fontWeight:300, background:BG, color:FG, minHeight:"100vh", padding:"16px", boxSizing:"border-box", WebkitFontSmoothing:"antialiased" }}>

      {/* ── Loading overlay ─────────────────────────────────────────────── */}
      <div style={{
        position:"fixed", inset:0, background:BG, zIndex:9999,
        display:"flex", alignItems:"center", justifyContent:"center",
        pointerEvents: loading ? "all" : "none",
        opacity: loading ? 1 : 0,
        transition: "opacity 0.5s ease",
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24.73 28.65" style={{ width:160, height:160 }}>
          <path fill={FG} d="M24.71,2.71c-.05-.88-.46-1.6-1.18-2.09-.47-.32-.96-.51-1.45-.59-.71-.11-1.43.05-2.07.46-.64.41-1.19.9-1.6,1.41-1.09,1.38-2.03,2.66-2.89,3.92-.98,1.44-1.87,2.99-2.64,4.62-.96-2.42-1.97-4.38-3.16-6.08-1.27-1.83-2.61-2.99-4.21-3.63-.41-.17-.79-.27-1.15-.33C2.87.2,1.75.86.91,2.44.21,3.77-.08,5.24.02,6.96c.02.19.02.37.03.54.02.44.04.89.15,1.35.2.85.5,1.66.76,2.33.82,2.11,1.9,4.16,3.31,6.27,1.51,2.28,3.09,4.71,4.29,7.29.44.95.95,1.84,1.46,2.76.47.82,1.05,1.07,1.46,1.13.41.06,1.2.01,1.9-.99.1-.14.18-.28.26-.43.04-.07.08-.15.12-.22.21-.33.41-.67.61-1,.45-.75.87-1.46,1.36-2.14,4.12-5.72,6.63-12.1,8.36-17.03.49-1.41.7-2.76.62-4.12ZM21.89,5.46c-.33,1.12-.7,2.25-1.14,3.33-1.52,3.66-3.06,7.31-5.29,10.62-1.14,1.69-2.3,3.37-3.45,5.06-.21.31-.38.36-.57,0-.39-.73-.73-1.48-1.17-2.18-1.4-2.27-2.84-4.51-4.26-6.77-1.44-2.29-2.82-4.61-3.52-7.27-.34-1.29-.3-2.57.06-3.83.13-.48.4-.93.68-1.36.23-.35.56-.44,1.02-.31,1.33.36,2.28,1.23,3.08,2.25.63.8,1.17,1.67,1.67,2.55.97,1.71,1.77,3.49,2.43,5.34v-.02s1.37,2.99,1.03,4.7c-.34,1.71,1.12.57,1.12,0s.21-1.61,1.02-3.52c.01-.03.02-.04.04-.07.05-.12.09-.23.13-.35,1.47-3.53,3.31-6.85,5.7-9.85.22-.27.46-.56.74-.75.2-.13.52-.19.74-.12.13.04.26.39.25.58-.06.66-.13,1.33-.31,1.96Z"/>
        </svg>
      </div>
      <div style={{ maxWidth:960, margin:"0 auto" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <h1 style={{ fontFamily:"'Instrument Serif',Georgia,serif", fontStyle:"italic", fontWeight:400, fontSize:"clamp(1.6rem,4vw,2.2rem)", margin:0, color:FG, letterSpacing:"-0.02em", lineHeight:1.05 }}>
            Griffbrett-Trainer
          </h1>
          <button onClick={() => setSettingsOpen(o => !o)} style={{
            padding:"7px 12px", border:`1px solid`, borderRadius:3, cursor:"pointer",
            fontSize:"0.875rem", background: settingsOpen ? FG : "transparent",
            borderColor: settingsOpen ? FG : RULE, color: settingsOpen ? BG : MUTED,
            transition:"all 0.2s", fontFamily:"'DM Mono','Menlo',monospace",
          }}>⚙</button>
        </div>

        {/* ── Settings panel ──────────────────────────────────────────────── */}
        {settingsOpen && (
          <div style={{ background:CARD, border:`1px solid ${RULE}`, borderRadius:3, padding:"14px 16px", marginBottom:16, display:"flex", gap:16, flexWrap:"wrap", alignItems:"flex-end" }}>
            <div>
              <div style={{ fontSize:"0.5625rem", color:MUTED, fontFamily:"'DM Mono','Menlo',monospace", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:6 }}>Linkshändig</div>
              <button onClick={() => setSetting("leftHanded", !leftHanded)} style={{
                padding:"6px 14px", border:`1px solid`, borderRadius:2, cursor:"pointer",
                fontSize:"0.6875rem", fontFamily:"'DM Mono','Menlo',monospace", letterSpacing:"0.08em",
                background: leftHanded ? FG : "transparent", borderColor: leftHanded ? FG : RULE,
                color: leftHanded ? BG : MUTED, transition:"all 0.15s",
              }}>{leftHanded ? "An" : "Aus"}</button>
            </div>
            <div style={{ flex:"1 1 160px" }}>
              <div style={{ fontSize:"0.5625rem", color:MUTED, fontFamily:"'DM Mono','Menlo',monospace", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:6 }}>Stimmung</div>
              <select value={tuningKey} onChange={e => setSetting("tuningKey", e.target.value)} style={{ width:"100%", padding:"7px 9px", borderRadius:2, border:`1px solid ${RULE}`, background:BG, color:FG, fontSize:"0.8125rem", fontWeight:300, outline:"none", cursor:"pointer", fontFamily:"'DM Mono','Menlo',monospace" }}>
                {Object.keys(TUNING_PRESETS).map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:"0.5625rem", color:MUTED, fontFamily:"'DM Mono','Menlo',monospace", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:6 }}>Bünde</div>
              <select value={activeFretCount} onChange={e => setSetting("fretCount", +e.target.value)} style={{ padding:"7px 9px", borderRadius:2, border:`1px solid ${RULE}`, background:BG, color:FG, fontSize:"0.8125rem", fontWeight:300, outline:"none", cursor:"pointer", fontFamily:"'DM Mono','Menlo',monospace" }}>
                {[12,15,17,22].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── Category bar ────────────────────────────────────────────────── */}
        <div style={{ display:"flex", gap:0, borderBottom:`1px solid ${RULE}`, marginBottom:0 }}>
          {["praxis","theorie"].map(cat => (
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
            activeTuning={activeTuning} tuningKey={tuningKey}
          />
        )}
        {mode === "metronome" && (
          <MetronomePanel
            bpm={bpm} setBpm={setBpm} beatsPerBar={beatsPerBar} setBeatsPerBar={setBeatsPerBar}
            isPlaying={metroPlaying} currentBeat={currentBeat}
            onStart={startMetronome} onStop={stopMetronome} onTap={handleTap}
          />
        )}

        {/* ── Fretboard modes ────────────────────────────────────────────── */}
        {category === "theorie" && (<>

          {/* Controls */}
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"flex-end" }}>

            {(mode === "scales" || mode === "chords") && (
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

            {mode === "finder" && (
              <div style={{ flex:"1 1 140px" }}>
                <label style={labelStyle}>Ton</label>
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
            <div style={{ minWidth:totalWidth+40, position:"relative", transform: leftHanded ? "scaleX(-1)" : "none" }}>

              {/* Fret numbers */}
              <div style={{ display:"flex", marginLeft:30, marginBottom:4 }}>
                {fretWidths.map((w, f) => (
                  <div key={f} style={{ width:w, textAlign:"center", fontSize:"0.5625rem", color:"#b5b1aa", flexShrink:0, fontWeight:400, letterSpacing:"0.05em", transform: leftHanded ? "scaleX(-1)" : "none" }}>
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
                {activeTuning.map((_, s) => (
                  <div key={s} style={{ display:"flex", alignItems:"center", height:36 }}>
                    <div style={{ width:30, textAlign:"center", fontSize:"0.625rem", fontWeight:400, color:"#b5b1aa", flexShrink:0, zIndex:3, letterSpacing:"0.05em", transform: leftHanded ? "scaleX(-1)" : "none" }}>
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
                              {cell.dimmed ? "" : <span style={{ transform: leftHanded ? "scaleX(-1)" : "none", display:"inline-block" }}>{cell.label || cell.noteName}</span>}
                            </div>
                          ) : isHov && f > 0 ? (
                            <div style={{
                              width:20, height:20, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                              border:`1px solid ${RULE}`, color:"#c4c0ba",
                              fontSize:"0.5rem", fontWeight:400, fontFamily:"'DM Mono','Menlo',monospace",
                              zIndex:2, position:"relative",
                            }}>
                              <span style={{ transform: leftHanded ? "scaleX(-1)" : "none", display:"inline-block" }}>{NOTES[(activeTuning[s]+f)%12]}</span>
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
                <>
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
                  {(() => {
                    const diatonic = getDiatonicChords(SCALES[selectedScale], rootNote);
                    if (!diatonic) return null;
                    return (
                      <div style={{ display:"flex", gap:4, marginTop:8, flexWrap:"wrap", justifyContent:"center" }}>
                        {diatonic.map((ch, i) => (
                          <button key={i} onClick={() => setRootNote(ch.root)} style={{
                            display:"flex", alignItems:"center", gap:4, borderRadius:2, padding:"4px 9px",
                            fontSize:"0.625rem", border:`1px solid ${RULE}`, fontWeight:400, letterSpacing:"0.04em",
                            background:"transparent", cursor:"pointer", fontFamily:"'DM Mono','Menlo',monospace",
                            color: ch.quality === "dim" ? MUTED : FG, transition:"all 0.12s",
                          }}>
                            <span style={{ color:DEGREE_COLORS[i], fontWeight:400 }}>{ROMAN[i]}{ch.quality==="dim"?"°":""}</span>
                            <span style={{ color:MUTED, margin:"0 2px" }}>·</span>
                            <span>{displayName(ch.root)}</span>
                            <span style={{ color:MUTED, marginLeft:1 }}>{ch.quality}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </>
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

          {mode === "finder" && (
            <div style={{ marginTop:14, borderTop:`1px solid ${RULE}`, paddingTop:12 }}>
              <p style={sectionLabel}>{displayName(finderNote)} – alle Positionen</p>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {activeTuning.flatMap((_,sIdx) =>
                  Array.from({length:activeFretCount+1},(_,f)=>({s:sIdx,f}))
                    .filter(({s,f})=>(activeTuning[s]+f)%12===finderNote)
                ).map(({s,f},i)=>(
                  <span key={i} style={{ padding:"3px 9px", background:ACCENT_SOFT, border:`1px solid ${ACCENT}30`, borderRadius:2, fontSize:"0.6875rem", color:ACCENT, fontWeight:400, letterSpacing:"0.04em" }}>
                    {STRING_NAMES[s]}{f===0?" leer":` Bund ${f}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {mode === "chords" && (
            <div style={{ marginTop:14, borderTop:`1px solid ${RULE}`, paddingTop:12 }}>
              <p style={sectionLabel}>Griffvarianten — {displayName(rootNote)} {chordType}</p>
              <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:4 }}>
                {sortedChordTemplates.map((tmpl, i) => (
                  <ChordDiagram
                    key={tmpl.name} rootNote={rootNote} template={tmpl}
                    isActive={chordVoicingIdx === i}
                    onClick={() => setChordVoicingIdx(i)}
                    leftHanded={leftHanded}
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

function TunerPanel({ tunerActive, tunerNote, tunerError, startTuner, stopTuner, activeTuning, tuningKey }) {
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
        <p style={sectionLabel}>Stimmung — {tuningKey}</p>
        <div style={{ display:"flex", gap:4 }}>
          {activeTuning.map((noteIdx, sIdx) => {
            const isActive = tunerNote?.noteIdx === noteIdx;
            const isTuned  = isActive && Math.abs(tunerNote.cents) <= 10;
            const bg = isTuned ? "#2ecc71" : isActive ? meterColor : "transparent";
            const bdr = isTuned ? "#2ecc71" : isActive ? meterColor : RULE;
            return (
              <div key={sIdx} style={{ flex:1, textAlign:"center" }}>
                <div style={{ border:`1px solid ${bdr}`, borderRadius:2, padding:"7px 4px", background:bg, transition:"all 0.1s" }}>
                  <div style={{ fontSize:"0.875rem", fontWeight:400, fontFamily:"'DM Mono','Menlo',monospace", color:isActive?"#fff":MUTED }}>{STRING_NAMES[sIdx]}</div>
                  <div style={{ fontSize:"0.5rem", color:isActive?"rgba(255,255,255,0.65)":RULE, marginTop:1, letterSpacing:"0.03em" }}>{NOTES[noteIdx]}</div>
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

function MetronomePanel({ bpm, setBpm, beatsPerBar, setBeatsPerBar, isPlaying, currentBeat, onStart, onStop, onTap }) {
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

      {/* Play / Stop */}
      <button onClick={isPlaying ? onStop : onStart} style={{
        padding:"12px 24px", border:`1px solid`, borderRadius:3, cursor:"pointer",
        fontSize:"0.6875rem", fontWeight:400, fontFamily:"'DM Mono','Menlo',monospace",
        letterSpacing:"0.1em", textTransform:"uppercase", transition:"all 0.2s",
        background: isPlaying ? "transparent" : FG,
        borderColor: isPlaying ? RULE : FG,
        color:       isPlaying ? MUTED : BG,
      }}>
        {isPlaying ? "Stoppen" : "Starten"}
      </button>
    </div>
  );
}

// ─── Chord Diagram ────────────────────────────────────────────────────────────

function ChordDiagram({ rootNote, template, isActive, onClick, leftHanded }) {
  const frets = getVoicingFrets(rootNote, template);
  const activeFrets = frets.filter(f => f !== -1 && f !== 0);
  const minFret = activeFrets.length ? Math.min(...activeFrets) : 1;
  const startFret = minFret <= 1 ? 1 : minFret;
  const FRETS = 5;
  const SS = 16;
  const FS = 16;
  const PL = 18, PT = 24, PR = 8, PB = 16;
  const W = 5 * SS + PL + PR;
  const H = FRETS * FS + PT + PB;
  const sx = (strIdx) => leftHanded ? PL + strIdx * SS : PL + (5 - strIdx) * SS;

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
          <line key={i} x1={sx(i)} x2={sx(i)} y1={PT} y2={PT + FRETS * FS} stroke={RULE} strokeWidth={1} />
        ))}
        {/* Dots and mute/open markers */}
        {frets.map((f, strIdx) => {
          const x = sx(strIdx);
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
