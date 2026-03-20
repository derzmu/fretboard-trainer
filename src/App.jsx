import { useState, useCallback, useMemo } from "react";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_LABELS = { "C#": "C#/Db", "D#": "D#/Eb", "F#": "F#/Gb", "G#": "G#/Ab", "A#": "A#/Bb" };
const TUNING = [4, 11, 7, 2, 9, 4];
const STRING_NAMES = ["e", "B", "G", "D", "A", "E"];
const FRET_COUNT = 15;
const DOT_FRETS = [3, 5, 7, 9, 12, 15];
const DOUBLE_DOT = [12];

const ACCENT = "#ff2b49";
const ACCENT_SOFT = "#ff2b4922";

const SCALES = {
  "Dur (Ionisch)": [0, 2, 4, 5, 7, 9, 11],
  "Nat. Moll (Äolisch)": [0, 2, 3, 5, 7, 8, 10],
  "Harm. Moll": [0, 2, 3, 5, 7, 8, 11],
  "Melod. Moll": [0, 2, 3, 5, 7, 9, 11],
  "Dur-Pentatonik": [0, 2, 4, 7, 9],
  "Moll-Pentatonik": [0, 3, 5, 7, 10],
  "Blues": [0, 3, 5, 6, 7, 10],
  "Dorisch": [0, 2, 3, 5, 7, 9, 10],
  "Phrygisch": [0, 1, 3, 5, 7, 8, 10],
  "Lydisch": [0, 2, 4, 6, 7, 9, 11],
  "Mixolydisch": [0, 2, 4, 5, 7, 9, 10],
  "Lokrisch": [0, 1, 3, 5, 6, 8, 10],
};

const INTERVALS = {
  "Kleine Terz (m3)": 3,
  "Große Terz (M3)": 4,
  "Reine Quarte (P4)": 5,
  "Reine Quinte (P5)": 7,
  "Kleine Septime (m7)": 10,
  "Große Septime (M7)": 11,
  "Oktave (P8)": 12,
};

const INTERVAL_COLORS = {
  3: "#e74c3c",
  4: "#e67e22",
  5: "#d4a017",
  7: "#2ecc71",
  10: "#3498db",
  11: "#9b59b6",
  12: "#1abc9c",
};

const DEGREE_COLORS = ["#ff2b49","#e67e22","#d4a017","#2ecc71","#1abc9c","#3498db","#9b59b6","#e91e63","#00bcd4","#8bc34a","#ff5722","#607d8b"];

function getNoteAt(stringIdx, fret) {
  return (TUNING[stringIdx] + fret) % 12;
}
function getNoteName(noteIdx) {
  return NOTES[noteIdx];
}
function displayName(noteIdx) {
  const n = NOTES[noteIdx];
  return NOTE_LABELS[n] || n;
}

const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

export default function App() {
  const [mode, setMode] = useState("scales");
  const [rootNote, setRootNote] = useState(0);
  const [selectedScale, setSelectedScale] = useState("Moll-Pentatonik");
  const [selectedInterval, setSelectedInterval] = useState("Reine Quinte (P5)");
  const [finderNote, setFinderNote] = useState(0);
  const [highlightRoot, setHighlightRoot] = useState(true);
  const [hoveredFret, setHoveredFret] = useState(null);

  const scaleNotes = useMemo(() => {
    if (mode !== "scales") return [];
    const pattern = SCALES[selectedScale];
    return pattern.map(i => (rootNote + i) % 12);
  }, [mode, rootNote, selectedScale]);

  const intervalData = useMemo(() => {
    if (mode !== "intervals") return { root: rootNote, semitones: 0 };
    return { root: rootNote, semitones: INTERVALS[selectedInterval] };
  }, [mode, rootNote, selectedInterval]);

  const getCellInfo = useCallback((stringIdx, fret) => {
    const noteIdx = getNoteAt(stringIdx, fret);
    const noteName = getNoteName(noteIdx);

    if (mode === "scales") {
      const degreeIdx = scaleNotes.indexOf(noteIdx);
      if (degreeIdx === -1) return { active: false, noteName, noteIdx };
      const isRoot = noteIdx === rootNote;
      const color = isRoot && highlightRoot ? "#fff" : DEGREE_COLORS[degreeIdx];
      const bg = isRoot && highlightRoot ? ACCENT : `${DEGREE_COLORS[degreeIdx]}18`;
      const border = isRoot && highlightRoot ? "#d9203c" : DEGREE_COLORS[degreeIdx];
      return { active: true, noteName, noteIdx, color, bg, border, isRoot, degree: degreeIdx + 1 };
    }

    if (mode === "intervals") {
      const isRoot = noteIdx === intervalData.root;
      const isTarget = noteIdx === (intervalData.root + intervalData.semitones) % 12;
      if (!isRoot && !isTarget) return { active: false, noteName, noteIdx };
      const col = isRoot ? ACCENT : INTERVAL_COLORS[intervalData.semitones];
      return {
        active: true, noteName, noteIdx,
        color: "#fff", bg: col, border: col,
        isRoot, label: isRoot ? "R" : selectedInterval.match(/\((.+)\)/)?.[1]
      };
    }

    if (mode === "finder") {
      const isTarget = noteIdx === finderNote;
      if (!isTarget) return { active: false, noteName, noteIdx };
      return {
        active: true, noteName, noteIdx,
        color: "#fff", bg: ACCENT, border: "#d9203c", isRoot: false
      };
    }

    return { active: false, noteName, noteIdx };
  }, [mode, scaleNotes, rootNote, highlightRoot, intervalData, selectedInterval, finderNote]);

  const fretWidths = useMemo(() => {
    const widths = [];
    for (let i = 0; i <= FRET_COUNT; i++) {
      widths.push(i === 0 ? 38 : Math.max(42, 72 - i * 1.8));
    }
    return widths;
  }, []);

  const totalWidth = fretWidths.reduce((a, b) => a + b, 0);

  return (
    <div style={{ fontFamily: "'Manrope', -apple-system, sans-serif", background: "#fafafa", color: "#1a1a1a", minHeight: "100vh", padding: "20px 16px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 2px", color: "#111", letterSpacing: "-0.5px" }}>
          Griffbrett-Trainer
        </h1>
        <p style={{ fontSize: 12, color: "#999", margin: "0 0 20px", fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase" }}>Skalen · Intervalle · Ton-Finder</p>

        {/* Mode Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#f0f0f0", borderRadius: 10, padding: 3 }}>
          {[
            { id: "scales", label: "Skalen" },
            { id: "intervals", label: "Intervalle" },
            { id: "finder", label: "Ton-Finder" },
          ].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              flex: 1, padding: "10px 0", border: "none", borderRadius: 8, cursor: "pointer",
              fontSize: 13, fontWeight: 700, transition: "all 0.2s", letterSpacing: "-0.2px",
              background: mode === m.id ? "#fff" : "transparent",
              color: mode === m.id ? ACCENT : "#999",
              boxShadow: mode === m.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}>{m.label}</button>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {mode !== "finder" && (
            <div style={{ flex: "1 1 140px" }}>
              <label style={{ fontSize: 10, color: "#aaa", display: "block", marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Grundton</label>
              <select value={rootNote} onChange={e => setRootNote(+e.target.value)} style={selectStyle}>
                {NOTES.map((n, i) => <option key={i} value={i}>{displayName(i)}</option>)}
              </select>
            </div>
          )}

          {mode === "scales" && (
            <div style={{ flex: "2 1 200px" }}>
              <label style={{ fontSize: 10, color: "#aaa", display: "block", marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Skala / Modus</label>
              <select value={selectedScale} onChange={e => setSelectedScale(e.target.value)} style={selectStyle}>
                {Object.keys(SCALES).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {mode === "intervals" && (
            <div style={{ flex: "2 1 200px" }}>
              <label style={{ fontSize: 10, color: "#aaa", display: "block", marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Intervall</label>
              <select value={selectedInterval} onChange={e => setSelectedInterval(e.target.value)} style={selectStyle}>
                {Object.keys(INTERVALS).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {mode === "finder" && (
            <div style={{ flex: "1 1 140px" }}>
              <label style={{ fontSize: 10, color: "#aaa", display: "block", marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Ton finden</label>
              <select value={finderNote} onChange={e => setFinderNote(+e.target.value)} style={selectStyle}>
                {NOTES.map((n, i) => <option key={i} value={i}>{displayName(i)}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Info Bar */}
        <div style={{ background: "#fff", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, fontWeight: 500, border: "1px solid #eee" }}>
          {mode === "scales" && (
            <span>
              <strong style={{ color: ACCENT }}>{displayName(rootNote)} {selectedScale}</strong>
              <span style={{ color: "#ddd", margin: "0 10px" }}>|</span>
              <span style={{ color: "#888" }}>
                {SCALES[selectedScale].map(i => displayName((rootNote + i) % 12)).join(" – ")}
              </span>
            </span>
          )}
          {mode === "intervals" && (
            <span>
              <strong style={{ color: ACCENT }}>{displayName(rootNote)}</strong>
              <span style={{ color: "#ddd", margin: "0 10px" }}>→</span>
              <strong style={{ color: INTERVAL_COLORS[intervalData.semitones] }}>
                {displayName((rootNote + intervalData.semitones) % 12)}
              </strong>
              <span style={{ color: "#ddd", margin: "0 10px" }}>|</span>
              <span style={{ color: "#888" }}>{selectedInterval}</span>
            </span>
          )}
          {mode === "finder" && (
            <span>
              <span style={{ color: "#888" }}>Alle </span>
              <strong style={{ color: ACCENT }}>{displayName(finderNote)}</strong>
              <span style={{ color: "#888" }}> auf dem Griffbrett</span>
            </span>
          )}
        </div>

        {/* Fretboard */}
        <div style={{ overflowX: "auto", paddingBottom: 8 }}>
          <div style={{ minWidth: totalWidth + 40, position: "relative" }}>
            {/* Fret numbers */}
            <div style={{ display: "flex", marginLeft: 30, marginBottom: 4 }}>
              {fretWidths.map((w, fret) => (
                <div key={fret} style={{ width: w, textAlign: "center", fontSize: 10, color: "#bbb", flexShrink: 0, fontWeight: 600 }}>
                  {fret === 0 ? "" : fret}
                </div>
              ))}
            </div>

            {/* Strings */}
            <div style={{ background: "#fff", borderRadius: 12, padding: "10px 0", position: "relative", border: "1px solid #e8e8e8", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              {/* Dot markers */}
              <div style={{ display: "flex", position: "absolute", top: 0, bottom: 0, left: 30, pointerEvents: "none" }}>
                {fretWidths.map((w, fret) => (
                  <div key={fret} style={{ width: w, flexShrink: 0, position: "relative" }}>
                    {DOT_FRETS.includes(fret) && (
                      DOUBLE_DOT.includes(fret) ? (
                        <>
                          <div style={{ position: "absolute", left: "50%", top: "25%", transform: "translate(-50%,-50%)", width: 6, height: 6, borderRadius: "50%", background: "#e8e8e8" }} />
                          <div style={{ position: "absolute", left: "50%", top: "75%", transform: "translate(-50%,-50%)", width: 6, height: 6, borderRadius: "50%", background: "#e8e8e8" }} />
                        </>
                      ) : (
                        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 6, height: 6, borderRadius: "50%", background: "#e8e8e8" }} />
                      )
                    )}
                  </div>
                ))}
              </div>

              {TUNING.map((_, stringIdx) => (
                <div key={stringIdx} style={{ display: "flex", alignItems: "center", height: 36 }}>
                  <div style={{ width: 30, textAlign: "center", fontSize: 11, fontWeight: 700, color: "#bbb", flexShrink: 0 }}>
                    {STRING_NAMES[stringIdx]}
                  </div>
                  {fretWidths.map((w, fret) => {
                    const cell = getCellInfo(stringIdx, fret);
                    const isHovered = hoveredFret && hoveredFret.s === stringIdx && hoveredFret.f === fret;
                    return (
                      <div
                        key={fret}
                        style={{
                          width: w, height: 36, flexShrink: 0, position: "relative",
                          borderRight: fret === 0 ? "3px solid #ccc" : "1px solid #f0f0f0",
                          background: fret === 0 ? "#fafafa" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                        onMouseEnter={() => setHoveredFret({ s: stringIdx, f: fret })}
                        onMouseLeave={() => setHoveredFret(null)}
                      >
                        {fret > 0 && (
                          <div style={{
                            position: "absolute", left: 0, right: 0, top: "50%",
                            height: Math.max(1, 3 - stringIdx * 0.3),
                            background: "#ddd", transform: "translateY(-50%)"
                          }} />
                        )}

                        {cell.active ? (
                          <div style={{
                            width: 26, height: 26, borderRadius: "50%", display: "flex",
                            alignItems: "center", justifyContent: "center",
                            background: cell.bg, border: `2px solid ${cell.border}`,
                            color: cell.color, fontSize: 10, fontWeight: 700,
                            zIndex: 2, position: "relative",
                            boxShadow: cell.isRoot ? `0 0 10px ${ACCENT}44` : "0 1px 3px rgba(0,0,0,0.06)",
                            transform: isHovered ? "scale(1.2)" : "scale(1)",
                            transition: "transform 0.15s",
                          }}>
                            {cell.label || cell.noteName}
                          </div>
                        ) : isHovered && fret > 0 ? (
                          <div style={{
                            width: 22, height: 22, borderRadius: "50%", display: "flex",
                            alignItems: "center", justifyContent: "center",
                            background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)",
                            color: "#ccc", fontSize: 9, fontWeight: 600,
                            zIndex: 2, position: "relative",
                          }}>
                            {cell.noteName}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Scale degree legend */}
            {mode === "scales" && (
              <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap", justifyContent: "center" }}>
                {SCALES[selectedScale].map((interval, idx) => {
                  const noteIdx = (rootNote + interval) % 12;
                  return (
                    <div key={idx} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 11,
                      border: "1px solid #eee", fontWeight: 600,
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        background: idx === 0 ? ACCENT : `${DEGREE_COLORS[idx]}18`,
                        border: `2px solid ${idx === 0 ? "#d9203c" : DEGREE_COLORS[idx]}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 800, color: idx === 0 ? "#fff" : DEGREE_COLORS[idx],
                      }}>
                        {idx + 1}
                      </div>
                      <span style={{ color: "#666" }}>{displayName(noteIdx)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Interval quick reference */}
        {mode === "intervals" && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Schnellwahl</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {Object.entries(INTERVALS).map(([name, semi]) => (
                <button key={name} onClick={() => setSelectedInterval(name)} style={{
                  padding: "7px 12px", border: "1px solid", borderRadius: 8, cursor: "pointer",
                  fontSize: 12, fontWeight: 700, transition: "all 0.2s",
                  background: selectedInterval === name ? INTERVAL_COLORS[semi] : "#fff",
                  borderColor: selectedInterval === name ? INTERVAL_COLORS[semi] : "#eee",
                  color: selectedInterval === name ? "#fff" : "#999",
                  boxShadow: selectedInterval === name ? `0 2px 8px ${INTERVAL_COLORS[semi]}33` : "none",
                }}>
                  {name.match(/\((.+)\)/)?.[1]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Finder positions */}
        {mode === "finder" && (
          <div style={{ marginTop: 14, background: "#fff", borderRadius: 10, padding: "12px 14px", border: "1px solid #eee" }}>
            <div style={{ fontSize: 10, color: "#aaa", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {displayName(finderNote)} – alle Positionen
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {TUNING.flatMap((_, sIdx) =>
                Array.from({ length: FRET_COUNT + 1 }, (_, f) => ({ s: sIdx, f }))
                  .filter(({ s, f }) => getNoteAt(s, f) === finderNote)
              ).map(({ s, f }, i) => (
                <span key={i} style={{
                  padding: "4px 10px", background: ACCENT_SOFT, border: `1px solid ${ACCENT}33`,
                  borderRadius: 6, fontSize: 11, color: ACCENT, fontWeight: 700,
                }}>
                  {STRING_NAMES[s]}{f === 0 ? " leer" : ` Bund ${f}`}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const selectStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e0e0e0",
  background: "#fff", color: "#333", fontSize: 14, fontWeight: 600, outline: "none",
  appearance: "auto", cursor: "pointer", fontFamily: "'Manrope', sans-serif",
};
