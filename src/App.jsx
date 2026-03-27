import { useState, useCallback, useMemo, useRef, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_LABELS = { "C#": "C#/Db", "D#": "D#/Eb", "F#": "F#/Gb", "G#": "G#/Ab", "A#": "A#/Bb" };
const TUNING = [4, 11, 7, 2, 9, 4]; // e B G D A E (index 0 = highest string)
const STRING_NAMES = ["e", "B", "G", "D", "A", "E"];
const FRET_COUNT = 15;
const DOT_FRETS = [3, 5, 7, 9, 12, 15];
const DOUBLE_DOT = [12];

const ACCENT = "#ff2b49";
const ACCENT_SOFT = "#ff2b4922";
const DEGREE_COLORS = ["#ff2b49","#e67e22","#d4a017","#2ecc71","#1abc9c","#3498db","#9b59b6","#e91e63","#00bcd4","#8bc34a","#ff5722","#607d8b"];
const INTERVAL_COLORS = { 3:"#e74c3c", 4:"#e67e22", 5:"#d4a017", 7:"#2ecc71", 10:"#3498db", 11:"#9b59b6", 12:"#1abc9c" };
// Root, 3rd, 5th
const CHORD_COLORS = ["#ff2b49", "#e67e22", "#2ecc71"];

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
// Each group = [lowString, midString, highString]
const TRIAD_GROUPS = [[2,1,0], [3,2,1], [4,3,2], [5,4,3]];
const TRIAD_GROUP_LABELS = ["G–B–e", "D–G–B", "A–D–G", "E–A–D"];

// Guitar string reference frequencies (E2 A2 D3 G3 B3 E4), index 0 = low E
const GUITAR_STRING_FREQS = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNoteAt(s, f) { return (TUNING[s] + f) % 12; }
function displayName(i) { const n = NOTES[i]; return NOTE_LABELS[n] || n; }
// Shift negative frets up one octave
function normF(f) { return f < 0 ? f + 12 : f; }

// ─── CAGED Shapes ─────────────────────────────────────────────────────────────
// Each shape returns [{s, f, d}] where d: 0=root, 1=M3, 2=P5
// Verified against open chord shapes; || 12 forces closed (barre) position for A/G/C shapes

const CAGED_SHAPES = {
  // Open E shape (barre at fret 0 for E major, slide up for other roots)
  E: (root) => {
    const f = ((root - TUNING[5]) % 12 + 12) % 12;
    return [
      { s:5, f: f,   d:0 },  // root on low E
      { s:4, f: f+2, d:2 },  // P5 on A
      { s:3, f: f+2, d:0 },  // root on D
      { s:2, f: f+1, d:1 },  // M3 on G
      { s:1, f: f,   d:2 },  // P5 on B
      { s:0, f: f,   d:0 },  // root on e
    ].filter(n => n.f >= 0 && n.f <= FRET_COUNT);
  },
  // Open A shape (barre chord, root on A string)
  A: (root) => {
    const f = ((root - TUNING[4]) % 12 + 12) % 12 || 12;
    return [
      { s:4, f: f,   d:0 },  // root on A
      { s:3, f: f+2, d:2 },  // P5 on D
      { s:2, f: f+2, d:0 },  // root on G
      { s:1, f: f+2, d:1 },  // M3 on B
      { s:0, f: f,   d:2 },  // P5 on e (same fret as A root)
    ].filter(n => n.f >= 0 && n.f <= FRET_COUNT);
  },
  // Open G shape (root on both E strings)
  G: (root) => {
    const f = ((root - TUNING[5]) % 12 + 12) % 12 || 12;
    return [
      { s:5, f: f,           d:0 },  // root on low E
      { s:4, f: normF(f-1),  d:1 },  // M3 on A
      { s:3, f: normF(f-3),  d:2 },  // P5 on D
      { s:2, f: normF(f-3),  d:0 },  // root on G
      { s:1, f: normF(f-3),  d:1 },  // M3 on B
      { s:0, f: f,           d:0 },  // root on high e
    ].filter(n => n.f >= 0 && n.f <= FRET_COUNT);
  },
  // Open C shape (root on A string, muted low E)
  C: (root) => {
    const f = ((root - TUNING[4]) % 12 + 12) % 12 || 12;
    return [
      { s:4, f: f,           d:0 },  // root on A
      { s:3, f: normF(f-1),  d:1 },  // M3 on D
      { s:2, f: normF(f-3),  d:2 },  // P5 on G
      { s:1, f: normF(f-2),  d:0 },  // root on B
      { s:0, f: normF(f-3),  d:1 },  // M3 on e
    ].filter(n => n.f >= 0 && n.f <= FRET_COUNT);
  },
  // Open D shape (root on D string, mutes low strings)
  D: (root) => {
    const f = ((root - TUNING[3]) % 12 + 12) % 12;
    return [
      { s:3, f: f,   d:0 },  // root on D
      { s:2, f: f+2, d:2 },  // P5 on G
      { s:1, f: f+3, d:0 },  // root on B
      { s:0, f: f+2, d:1 },  // M3 on e
    ].filter(n => n.f >= 0 && n.f <= FRET_COUNT);
  },
};

// ─── Triad voicing ────────────────────────────────────────────────────────────
// Finds the lowest close-position (span ≤ 4 frets) voicing for a given
// inversion on a 3-string group.

function getTriadVoicing(rootNote, intervals, inversion, groupIdx) {
  const group = TRIAD_GROUPS[groupIdx];
  const pool = intervals.map(i => (rootNote + i) % 12);
  // inversion sets the degree order [low, mid, high]
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
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = buf.length - 1;
  for (let i = 0; i < buf.length / 2; i++) { if (Math.abs(buf[i]) < 0.2) { r1 = i; break; } }
  for (let i = 1; i < buf.length / 2; i++) { if (Math.abs(buf[buf.length-i]) < 0.2) { r2 = buf.length-i; break; } }

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

// ─── Font ─────────────────────────────────────────────────────────────────────

const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // Navigation
  const [mode, setMode] = useState("scales");
  const [tunerOpen, setTunerOpen] = useState(false);

  // Shared
  const [rootNote, setRootNote]     = useState(0);
  const [hoveredFret, setHoveredFret] = useState(null);

  // Scales
  const [selectedScale, setSelectedScale] = useState("Moll-Pentatonik");
  const [highlightRoot, setHighlightRoot] = useState(true);

  // CAGED
  const [cagedShape, setCagedShape] = useState("E");

  // Triads
  const [triadType, setTriadType]           = useState("Dur");
  const [triadInversion, setTriadInversion] = useState(0);
  const [triadGroup, setTriadGroup]         = useState(0);

  // Intervals
  const [selectedInterval, setSelectedInterval] = useState("Reine Quinte (P5)");

  // Finder
  const [finderNote, setFinderNote] = useState(0);

  // Tuner
  const [tunerActive, setTunerActive]   = useState(false);
  const [tunerNote, setTunerNote]       = useState(null);
  const [tunerError, setTunerError]     = useState(null);
  const audioCtxRef    = useRef(null);
  const analyserRef    = useRef(null);
  const streamRef      = useRef(null);
  const rafRef         = useRef(null);
  const smoothFreqRef  = useRef(0);
  const stableRef      = useRef({ key: null, count: 0 });
  const silenceRef     = useRef(0);

  const stopTuner = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current) audioCtxRef.current.close();
    audioCtxRef.current = analyserRef.current = streamRef.current = rafRef.current = null;
    smoothFreqRef.current = 0;
    stableRef.current = { key: null, count: 0 };
    silenceRef.current = 0;
    setTunerActive(false);
    setTunerNote(null);
  }, []);

  const startTuner = useCallback(async () => {
    setTunerError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(stream).connect(analyser);
      setTunerActive(true);

      const buf = new Float32Array(analyser.fftSize);
      let lastTs = 0;

      const tick = (ts) => {
        rafRef.current = requestAnimationFrame(tick);
        if (ts - lastTs < 70) return; // ~14 fps display
        lastTs = ts;

        analyser.getFloatTimeDomainData(buf);
        const raw = autoCorrelate(buf, ctx.sampleRate);

        if (raw < 0) {
          silenceRef.current++;
          if (silenceRef.current > 8) {
            setTunerNote(null);
            smoothFreqRef.current = 0;
            stableRef.current = { key: null, count: 0 };
          }
          return;
        }
        silenceRef.current = 0;

        // Heavy exponential smoothing (α=0.15)
        smoothFreqRef.current = smoothFreqRef.current > 0
          ? 0.15 * raw + 0.85 * smoothFreqRef.current
          : raw;

        const info = freqToNoteInfo(smoothFreqRef.current);
        if (!info) return;

        // Require 2 consecutive readings of same note before updating display
        const key = info.noteName + info.octave;
        if (stableRef.current.key === key) {
          stableRef.current.count++;
        } else {
          stableRef.current = { key, count: 1 };
        }
        if (stableRef.current.count >= 2) setTunerNote(info);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setTunerError("Mikrofon-Zugriff verweigert.");
    }
  }, []);

  useEffect(() => () => stopTuner(), [stopTuner]);

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
    return {
      map,
      minFret: frets.length ? Math.min(...frets) : 0,
      maxFret: frets.length ? Math.max(...frets) : 0,
    };
  }, [mode, rootNote, cagedShape]);

  const triadIntervals = TRIAD_TYPES[triadType];

  const triadVoicing = useMemo(() => {
    if (mode !== "triads") return null;
    return getTriadVoicing(rootNote, triadIntervals, triadInversion, triadGroup);
  }, [mode, rootNote, triadIntervals, triadInversion, triadGroup]);

  const voicingKeys = useMemo(() =>
    triadVoicing ? new Set(triadVoicing.map(n => `${n.s}-${n.f}`)) : new Set(),
  [triadVoicing]);

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
        border: isRoot && highlightRoot ? "#d9203c" : DEGREE_COLORS[deg],
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
        border: isRoot ? "#d9203c" : col,
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
      return { active: true, noteName, color: "#fff", bg: ACCENT, border: "#d9203c", isRoot: false };
    }

    return { active: false, noteName };
  }, [mode, scaleNotes, rootNote, highlightRoot, cagedData, triadIntervals, voicingKeys, intervalSemitones, selectedInterval, finderNote]);

  // ─── Fret geometry ────────────────────────────────────────────────────────

  const fretWidths = useMemo(() => {
    const w = [];
    for (let i = 0; i <= FRET_COUNT; i++) w.push(i === 0 ? 38 : Math.max(42, 72 - i * 1.8));
    return w;
  }, []);
  const totalWidth = fretWidths.reduce((a, b) => a + b, 0);

  // ─── JSX ──────────────────────────────────────────────────────────────────

  const TABS = [
    { id: "scales",    label: "Skalen"    },
    { id: "caged",     label: "CAGED"     },
    { id: "triads",    label: "Triaden"   },
    { id: "intervals", label: "Intervall" },
    { id: "finder",    label: "Finder"    },
  ];

  return (
    <div style={{ fontFamily:"'Manrope',-apple-system,sans-serif", background:"#fafafa", color:"#1a1a1a", minHeight:"100vh", padding:"16px", boxSizing:"border-box" }}>
      <div style={{ maxWidth:960, margin:"0 auto" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div>
            <h1 style={{ fontSize:20, fontWeight:800, margin:0, color:"#111", letterSpacing:"-0.5px" }}>Griffbrett-Trainer</h1>
          </div>
          <button
            onClick={() => { setTunerOpen(o => { if (o) stopTuner(); return !o; }); }}
            style={{
              padding:"8px 14px", border:"1px solid", borderRadius:9, cursor:"pointer",
              fontSize:12, fontWeight:700, letterSpacing:"0.3px", transition:"all 0.2s",
              background: tunerOpen ? ACCENT : "#fff",
              borderColor: tunerOpen ? ACCENT : "#e0e0e0",
              color: tunerOpen ? "#fff" : "#999",
              boxShadow: tunerOpen ? `0 2px 10px ${ACCENT}44` : "none",
            }}
          >
            {tunerActive ? "● LIVE" : "Stimmgerät"}
          </button>
        </div>

        {/* ── Tuner panel ────────────────────────────────────────────────── */}
        {tunerOpen && (
          <TunerPanel
            tunerActive={tunerActive} tunerNote={tunerNote} tunerError={tunerError}
            startTuner={startTuner} stopTuner={stopTuner}
          />
        )}

        {/* ── Fretboard modes ────────────────────────────────────────────── */}
        {!tunerOpen && (<>

          {/* Tab bar */}
          <div style={{ display:"flex", gap:3, marginBottom:14, background:"#f0f0f0", borderRadius:10, padding:3 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setMode(t.id)} style={{
                flex:1, padding:"9px 0", border:"none", borderRadius:8, cursor:"pointer",
                fontSize:12, fontWeight:700, transition:"all 0.15s",
                background: mode === t.id ? "#fff" : "transparent",
                color:      mode === t.id ? ACCENT : "#999",
                boxShadow:  mode === t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}>{t.label}</button>
            ))}
          </div>

          {/* Controls */}
          <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap", alignItems:"flex-end" }}>

            {/* Root note – shown for all modes except finder */}
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
                      width:38, height:38, border:"1px solid", borderRadius:8, cursor:"pointer",
                      fontSize:14, fontWeight:800, transition:"all 0.15s",
                      background:   cagedShape === sh ? ACCENT : "#fff",
                      borderColor:  cagedShape === sh ? ACCENT : "#e0e0e0",
                      color:        cagedShape === sh ? "#fff" : "#aaa",
                      boxShadow:    cagedShape === sh ? `0 2px 8px ${ACCENT}33` : "none",
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
                      padding:"8px 10px", border:"1px solid", borderRadius:8, cursor:"pointer",
                      fontSize:11, fontWeight:700, whiteSpace:"nowrap", transition:"all 0.15s",
                      background:  triadInversion === i ? ACCENT : "#fff",
                      borderColor: triadInversion === i ? ACCENT : "#e0e0e0",
                      color:       triadInversion === i ? "#fff" : "#aaa",
                    }}>{lbl}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex:"0 0 auto" }}>
                <label style={labelStyle}>Saiten</label>
                <div style={{ display:"flex", gap:3 }}>
                  {TRIAD_GROUP_LABELS.map((lbl, i) => (
                    <button key={i} onClick={() => setTriadGroup(i)} style={{
                      padding:"8px 10px", border:"1px solid", borderRadius:8, cursor:"pointer",
                      fontSize:11, fontWeight:700, transition:"all 0.15s",
                      background:  triadGroup === i ? "#1a1a1a" : "#fff",
                      borderColor: triadGroup === i ? "#1a1a1a" : "#e0e0e0",
                      color:       triadGroup === i ? "#fff" : "#aaa",
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
          </div>

          {/* Info strip */}
          <div style={{ background:"#fff", borderRadius:9, padding:"8px 14px", marginBottom:10, fontSize:12, fontWeight:500, border:"1px solid #eee", minHeight:34, display:"flex", alignItems:"center" }}>
            {mode === "scales" && <span>
              <strong style={{ color:ACCENT }}>{displayName(rootNote)} {selectedScale}</strong>
              <span style={{ color:"#ddd", margin:"0 8px" }}>|</span>
              <span style={{ color:"#aaa" }}>{SCALES[selectedScale].map(i => displayName((rootNote+i)%12)).join(" – ")}</span>
            </span>}

            {mode === "caged" && <span>
              <strong style={{ color:ACCENT }}>{displayName(rootNote)} · {cagedShape}-Form</strong>
              {cagedData && <span style={{ color:"#ccc" }}> Bund {cagedData.minFret}–{cagedData.maxFret}</span>}
              <span style={{ color:"#ddd", margin:"0 8px" }}>|</span>
              <span style={{ color:"#aaa" }}>{[0,4,7].map(i => displayName((rootNote+i)%12)).join(" – ")}</span>
            </span>}

            {mode === "triads" && <span>
              <strong style={{ color:ACCENT }}>{displayName(rootNote)} {triadType}</strong>
              <span style={{ color:"#ddd", margin:"0 6px" }}>·</span>
              <span style={{ color:ACCENT, fontWeight:700 }}>{TRIAD_INVERSIONS[triadInversion]}</span>
              <span style={{ color:"#ddd", margin:"0 8px" }}>|</span>
              <span style={{ color:"#aaa" }}>{triadIntervals.map(i => displayName((rootNote+i)%12)).join(" – ")}</span>
            </span>}

            {mode === "intervals" && <span>
              <strong style={{ color:ACCENT }}>{displayName(rootNote)}</strong>
              <span style={{ margin:"0 8px", color:"#ddd" }}>→</span>
              <strong style={{ color:INTERVAL_COLORS[intervalSemitones] }}>{displayName((rootNote+intervalSemitones)%12)}</strong>
              <span style={{ color:"#ddd", margin:"0 8px" }}>|</span>
              <span style={{ color:"#aaa" }}>{selectedInterval}</span>
            </span>}

            {mode === "finder" && <span>
              <span style={{ color:"#aaa" }}>Alle </span>
              <strong style={{ color:ACCENT }}>{displayName(finderNote)}</strong>
              <span style={{ color:"#aaa" }}> auf dem Griffbrett</span>
            </span>}
          </div>

          {/* ── Fretboard ──────────────────────────────────────────────── */}
          <div style={{ overflowX:"auto", paddingBottom:4 }}>
            <div style={{ minWidth:totalWidth+40, position:"relative" }}>

              {/* Fret numbers */}
              <div style={{ display:"flex", marginLeft:30, marginBottom:4 }}>
                {fretWidths.map((w, f) => (
                  <div key={f} style={{ width:w, textAlign:"center", fontSize:10, color:"#bbb", flexShrink:0, fontWeight:600 }}>
                    {f === 0 ? "" : f}
                  </div>
                ))}
              </div>

              {/* Board */}
              <div style={{ background:"#fff", borderRadius:12, padding:"10px 0", position:"relative", border:"1px solid #e8e8e8", boxShadow:"0 2px 12px rgba(0,0,0,0.04)", overflow:"hidden" }}>

                {/* Dot markers */}
                <div style={{ display:"flex", position:"absolute", top:0, bottom:0, left:30, pointerEvents:"none" }}>
                  {fretWidths.map((w, f) => (
                    <div key={f} style={{ width:w, flexShrink:0, position:"relative" }}>
                      {DOT_FRETS.includes(f) && (DOUBLE_DOT.includes(f) ? <>
                        <div style={{ position:"absolute", left:"50%", top:"25%", transform:"translate(-50%,-50%)", width:6, height:6, borderRadius:"50%", background:"#e8e8e8" }} />
                        <div style={{ position:"absolute", left:"50%", top:"75%", transform:"translate(-50%,-50%)", width:6, height:6, borderRadius:"50%", background:"#e8e8e8" }} />
                      </> : <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", width:6, height:6, borderRadius:"50%", background:"#e8e8e8" }} />)}
                    </div>
                  ))}
                </div>

                {/* Strings */}
                {TUNING.map((_, s) => (
                  <div key={s} style={{ display:"flex", alignItems:"center", height:36 }}>
                    <div style={{ width:30, textAlign:"center", fontSize:11, fontWeight:700, color:"#bbb", flexShrink:0, zIndex:3 }}>
                      {STRING_NAMES[s]}
                    </div>
                    {fretWidths.map((w, f) => {
                      const cell = getCellInfo(s, f);
                      const isHov = hoveredFret?.s === s && hoveredFret?.f === f;
                      return (
                        <div key={f}
                          style={{
                            width:w, height:36, flexShrink:0, position:"relative",
                            borderRight: f===0 ? "3px solid #ccc" : "1px solid #f0f0f0",
                            background:  f===0 ? "#fafafa" : "transparent",
                            display:"flex", alignItems:"center", justifyContent:"center",
                          }}
                          onMouseEnter={() => setHoveredFret({s,f})}
                          onMouseLeave={() => setHoveredFret(null)}
                        >
                          {f > 0 && (
                            <div style={{ position:"absolute", left:0, right:0, top:"50%", height:Math.max(1,1+s*0.5), background:"#ddd", transform:"translateY(-50%)" }} />
                          )}
                          {cell.active ? (
                            <div style={{
                              width:  cell.dimmed ? 20 : 26,
                              height: cell.dimmed ? 20 : 26,
                              borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                              background: cell.bg, border:`2px solid ${cell.border}`,
                              color: cell.color, fontSize: cell.dimmed ? 8 : 10, fontWeight:700,
                              zIndex:2, position:"relative",
                              opacity: cell.dimmed ? 0.4 : 1,
                              boxShadow: cell.isRoot ? `0 0 10px ${ACCENT}44` : cell.dimmed ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
                              transform: isHov && !cell.dimmed ? "scale(1.2)" : "scale(1)",
                              transition:"transform 0.15s",
                            }}>
                              {cell.dimmed ? "" : (cell.label || cell.noteName)}
                            </div>
                          ) : isHov && f > 0 ? (
                            <div style={{
                              width:22, height:22, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                              background:"rgba(0,0,0,0.03)", border:"1px solid rgba(0,0,0,0.06)",
                              color:"#ccc", fontSize:9, fontWeight:600, zIndex:2, position:"relative",
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
                <div style={{ display:"flex", gap:5, marginTop:10, flexWrap:"wrap", justifyContent:"center" }}>
                  {SCALES[selectedScale].map((interval, idx) => {
                    const ni = (rootNote+interval)%12;
                    return (
                      <div key={idx} style={{ display:"flex", alignItems:"center", gap:5, background:"#fff", borderRadius:8, padding:"4px 9px", fontSize:11, border:"1px solid #eee", fontWeight:600 }}>
                        <div style={{ width:16, height:16, borderRadius:"50%", background:idx===0?ACCENT:`${DEGREE_COLORS[idx]}18`, border:`2px solid ${idx===0?"#d9203c":DEGREE_COLORS[idx]}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:800, color:idx===0?"#fff":DEGREE_COLORS[idx] }}>{idx+1}</div>
                        <span style={{ color:"#666" }}>{displayName(ni)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {(mode === "caged" || mode === "triads") && (
                <div style={{ display:"flex", gap:8, marginTop:10, justifyContent:"center" }}>
                  {[["R",0],["3",1],["5",2]].map(([lbl, i]) => {
                    const ivs = mode === "caged" ? [0,4,7] : triadIntervals;
                    return (
                      <div key={lbl} style={{ display:"flex", alignItems:"center", gap:6, background:"#fff", borderRadius:8, padding:"4px 12px", fontSize:11, border:"1px solid #eee", fontWeight:700 }}>
                        <div style={{ width:12, height:12, borderRadius:"50%", background:CHORD_COLORS[i], flexShrink:0 }} />
                        <span style={{ color:"#444" }}>{lbl} = {displayName((rootNote+ivs[i])%12)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom panels ──────────────────────────────────────────── */}

          {mode === "intervals" && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:10, color:"#aaa", marginBottom:6, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px" }}>Schnellwahl</div>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {Object.entries(INTERVALS).map(([name, semi]) => (
                  <button key={name} onClick={() => setSelectedInterval(name)} style={{
                    padding:"6px 10px", border:"1px solid", borderRadius:8, cursor:"pointer",
                    fontSize:12, fontWeight:700, transition:"all 0.15s",
                    background:  selectedInterval===name ? INTERVAL_COLORS[semi] : "#fff",
                    borderColor: selectedInterval===name ? INTERVAL_COLORS[semi] : "#eee",
                    color:       selectedInterval===name ? "#fff" : "#999",
                  }}>{name.match(/\((.+)\)/)?.[1]}</button>
                ))}
              </div>
            </div>
          )}

          {mode === "finder" && (
            <div style={{ marginTop:12, background:"#fff", borderRadius:10, padding:"12px 14px", border:"1px solid #eee" }}>
              <div style={{ fontSize:10, color:"#aaa", marginBottom:8, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px" }}>{displayName(finderNote)} – alle Positionen</div>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {TUNING.flatMap((_,sIdx) =>
                  Array.from({length:FRET_COUNT+1},(_,f)=>({s:sIdx,f}))
                    .filter(({s,f})=>getNoteAt(s,f)===finderNote)
                ).map(({s,f},i)=>(
                  <span key={i} style={{ padding:"4px 10px", background:ACCENT_SOFT, border:`1px solid ${ACCENT}33`, borderRadius:6, fontSize:11, color:ACCENT, fontWeight:700 }}>
                    {STRING_NAMES[s]}{f===0?" leer":` Bund ${f}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {mode === "triads" && (
            <div style={{ marginTop:12, background:"#fff", borderRadius:10, padding:"12px 14px", border:"1px solid #eee" }}>
              <div style={{ fontSize:10, color:"#aaa", marginBottom:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px" }}>
                Alle Lagen – {TRIAD_GROUP_LABELS[triadGroup]}
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {[0,1,2].map(inv => {
                  const v = getTriadVoicing(rootNote, triadIntervals, inv, triadGroup);
                  if (!v) return null;
                  const active = triadInversion === inv;
                  return (
                    <button key={inv} onClick={()=>setTriadInversion(inv)} style={{
                      padding:"9px 14px", border:"1px solid", borderRadius:10, cursor:"pointer",
                      background:  active ? "#1a1a1a" : "#fff",
                      borderColor: active ? "#1a1a1a" : "#eee",
                      textAlign:"left", transition:"all 0.15s", flex:"1 1 auto",
                    }}>
                      <div style={{ fontSize:10, fontWeight:700, color:active?"#666":"#bbb", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.5px" }}>{TRIAD_INVERSIONS[inv]}</div>
                      <div style={{ display:"flex", gap:0, flexWrap:"wrap" }}>
                        {v.map((n,ni)=>(
                          <span key={ni} style={{ fontSize:12, fontWeight:800 }}>
                            <span style={{ color: active ? CHORD_COLORS[n.d] : CHORD_COLORS[n.d]+"66" }}>
                              {STRING_NAMES[n.s]}{n.f}
                            </span>
                            {ni < v.length-1 && <span style={{ color:active?"#444":"#ccc", fontWeight:400 }}> – </span>}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
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
  const meterColor = inTune ? "#2ecc71" : Math.abs(cents) <= 20 ? "#f39c12" : ACCENT;
  const meterPct = Math.min(Math.max((cents + 50) / 100, 0), 1);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>

      {/* Main display */}
      <div style={{ background:"#fff", borderRadius:14, border:"1px solid #eee", padding:"24px 20px 30px", textAlign:"center" }}>
        <div style={{ fontSize:76, fontWeight:800, lineHeight:1, letterSpacing:"-3px", minHeight:80, color:tunerNote ? meterColor : "#e8e8e8", transition:"color 0.1s" }}>
          {tunerNote ? tunerNote.noteName : "–"}
          {tunerNote && <span style={{ fontSize:26, fontWeight:600, color:"#ccc", letterSpacing:0, marginLeft:3 }}>{tunerNote.octave}</span>}
        </div>
        <div style={{ fontSize:12, color:"#ccc", marginTop:4, fontWeight:600 }}>
          {tunerNote ? `${tunerNote.freq.toFixed(1)} Hz` : tunerActive ? "Warte auf Signal…" : "–"}
        </div>

        {/* Cents meter */}
        <div style={{ marginTop:22, position:"relative", height:44, padding:"0 12px" }}>
          {/* Track */}
          <div style={{ position:"absolute", top:"50%", left:12, right:12, height:3, background:"#f0f0f0", borderRadius:3, transform:"translateY(-50%)" }} />
          {/* Center mark */}
          <div style={{ position:"absolute", top:4, bottom:4, left:"50%", width:1, background:"#e0e0e0", transform:"translateX(-50%)" }} />
          {/* Needle */}
          {tunerNote && (
            <div style={{
              position:"absolute", top:"50%", width:16, height:16, borderRadius:"50%",
              background:meterColor, transform:"translate(-50%,-50%)",
              left:`calc(12px + ${meterPct} * (100% - 24px))`,
              transition:"left 0.08s ease-out, background 0.1s",
              boxShadow:`0 0 12px ${meterColor}99`,
            }} />
          )}
          <div style={{ position:"absolute", bottom:2, left:12, fontSize:11, color:"#ccc", fontWeight:700 }}>♭</div>
          <div style={{ position:"absolute", bottom:2, right:12, fontSize:11, color:"#ccc", fontWeight:700 }}>♯</div>
          <div style={{ position:"absolute", bottom:2, left:"50%", transform:"translateX(-50%)", fontSize:11, fontWeight:800, transition:"color 0.1s",
            color: inTune ? "#2ecc71" : tunerNote ? "#bbb" : "#ddd" }}>
            {inTune ? "✓" : tunerNote ? `${cents>0?"+":""}${cents}¢` : "0¢"}
          </div>
        </div>
      </div>

      {/* String reference */}
      <div style={{ background:"#fff", borderRadius:12, border:"1px solid #eee", padding:"12px 14px" }}>
        <div style={{ fontSize:10, color:"#bbb", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>Standard-Stimmung</div>
        <div style={{ display:"flex", gap:5 }}>
          {GUITAR_STRING_FREQS.map((freq, i) => {
            const sIdx = 5 - i;
            const targetNote = TUNING[sIdx];
            const isActive = tunerNote?.noteIdx === targetNote;
            const isTuned  = isActive && Math.abs(tunerNote.cents) <= 10;
            const bg = isTuned ? "#2ecc71" : isActive ? meterColor : "#f5f5f5";
            return (
              <div key={i} style={{ flex:1, textAlign:"center" }}>
                <div style={{ borderRadius:9, padding:"8px 4px", background:bg, transition:"background 0.1s", boxShadow:isActive?`0 2px 8px ${bg}66`:"none" }}>
                  <div style={{ fontSize:15, fontWeight:800, color:isActive?"#fff":"#bbb" }}>{STRING_NAMES[sIdx]}</div>
                  <div style={{ fontSize:8, fontWeight:600, color:isActive?"rgba(255,255,255,0.65)":"#ccc", marginTop:1 }}>{freq}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Button */}
      <button onClick={tunerActive ? stopTuner : startTuner} style={{
        padding:"13px 24px", border:"none", borderRadius:12, cursor:"pointer",
        fontSize:14, fontWeight:800, transition:"all 0.2s",
        background: tunerActive ? "#f0f0f0" : ACCENT,
        color:      tunerActive ? "#999" : "#fff",
        boxShadow:  tunerActive ? "none" : `0 4px 16px ${ACCENT}44`,
      }}>
        {tunerActive ? "Mikrofon stoppen" : "Mikrofon starten"}
      </button>

      {tunerError && <div style={{ color:ACCENT, fontSize:12, textAlign:"center", fontWeight:600 }}>{tunerError}</div>}
    </div>
  );
}

// ─── Style constants ───────────────────────────────────────────────────────────

const labelStyle = {
  fontSize:10, color:"#aaa", display:"block", marginBottom:4,
  fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px",
};

const selectStyle = {
  width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid #e0e0e0",
  background:"#fff", color:"#333", fontSize:13, fontWeight:600, outline:"none",
  appearance:"auto", cursor:"pointer", fontFamily:"'Manrope',sans-serif",
};
