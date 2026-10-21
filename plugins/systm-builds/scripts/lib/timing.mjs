import { BEATS } from './model.mjs';
import { round, wordCount } from './util.mjs';

export function computeTiming(script, cfg) {
  const fps = cfg.format.fps;
  const wps = script.calibration?.wps ?? cfg.voice.wps;
  const rows = [];
  let t = 0;
  for (const b of [...script.beats].sort((a, c) => a.n - c.n)) {
    const w = wordCount(b.vo);
    const pause = b.pause_after_s ?? 0;
    let dur;
    if (b.combined_with) dur = 0;
    else if (b.duration_s) dur = b.duration_s;
    else dur = Math.max(cfg.voice.min_beat_s, w / wps + pause);
    dur = round(dur, 3);
    rows.push({ n: b.n, name: BEATS[b.n - 1].name, start_s: round(t, 3), end_s: round(t + dur, 3), dur_s: dur, words: w, pause_after_s: pause, combined_with: b.combined_with ?? null });
    t = round(t + dur, 3);
  }
  const total = round(t, 3);
  const totalFrames = Math.round(total * fps);
  for (const r of rows) {
    r.start_frame = Math.round(r.start_s * fps);
    r.end_frame = r.n === rows[rows.length - 1].n ? totalFrames : Math.round(r.end_s * fps);
  }
  return {
    fps,
    wps,
    wps_source: script.calibration?.wps ? 'calibrated_from_recording' : 'config_estimate',
    total_s: total,
    total_frames: totalFrames,
    total_words: rows.reduce((s, r) => s + r.words, 0),
    in_target_range: total >= cfg.format.target_min_s && total <= cfg.format.target_max_s,
    beats: rows,
  };
}

export function smpte(frames, fps) {
  const f = frames % fps;
  const s = Math.floor(frames / fps) % 60;
  const m = Math.floor(frames / fps / 60) % 60;
  const h = Math.floor(frames / fps / 3600);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`;
}

// Split a beat window into shots by weight, frames only, so shots stay contiguous.
export function shotsForBeat(beat, row) {
  const list = beat.shots?.length ? beat.shots : [{ mode: beat.mode, asset: beat.asset, framing: beat.framing, action: beat.action, overlay: beat.on_screen_text, audio: beat.sound_cue, evidence: beat.evidence }];
  const span = row.end_frame - row.start_frame;
  const totalW = list.reduce((s, x) => s + (x.weight ?? 1), 0);
  let cursor = row.start_frame;
  return list.map((s, i) => {
    const last = i === list.length - 1;
    const end = last ? row.end_frame : cursor + Math.round((span * (s.weight ?? 1)) / totalW);
    const out = {
      id: list.length > 1 ? `B${String(beat.n).padStart(2, '0')}.${i + 1}` : `B${String(beat.n).padStart(2, '0')}`,
      beat: beat.n,
      start_frame: cursor,
      end_frame: end,
      mode: s.mode ?? beat.mode,
      asset: s.asset ?? beat.asset,
      framing: s.framing ?? beat.framing,
      action: s.action ?? beat.action,
      overlay: s.overlay ?? beat.on_screen_text,
      audio: s.audio ?? beat.sound_cue,
      evidence: (s.evidence ?? beat.evidence ?? []).join(' '),
      transition: beat.transition,
    };
    cursor = end;
    return out;
  });
}

function fitLines(ws, max) {
  const one = ws.join(' ');
  if (one.length <= max) return [one];
  let best = null;
  for (let k = 1; k < ws.length; k++) {
    const a = ws.slice(0, k).join(' ');
    const b = ws.slice(k).join(' ');
    if (a.length <= max && b.length <= max) {
      const d = Math.abs(a.length - b.length);
      if (!best || d < best.d) best = { d, lines: [a, b] };
    }
  }
  return best ? best.lines : null;
}

function cutInto(ws, k) {
  const total = ws.join(' ').length;
  const target = total / k;
  const parts = [];
  let cur = [];
  for (let i = 0; i < ws.length; i++) {
    cur.push(ws[i]);
    const len = cur.join(' ').length;
    const next = ws[i + 1];
    const over = next === undefined ? Infinity : len + 1 + next.length - target;
    if (parts.length < k - 1 && next !== undefined && over > target - len) { parts.push(cur); cur = []; }
  }
  if (cur.length) parts.push(cur);
  return parts;
}

// Sentences first, then the fewest balanced cues that each fit max_lines x max_chars.
export function splitCaptions(vo, cfg) {
  const max = cfg.captions.max_chars_per_line;
  const fits = (c) => (cfg.captions.max_lines >= 2 ? fitLines(c, max) : c.join(' ').length <= max);
  const ws = String(vo).split(/\s+/).filter(Boolean);
  const sentences = [];
  let cur = [];
  for (const w of ws) { cur.push(w); if (/[.!?]$/.test(w)) { sentences.push(cur); cur = []; } }
  if (cur.length) sentences.push(cur);
  const chunks = [];
  for (const sw of sentences) {
    if (fits(sw)) { chunks.push(sw); continue; }
    let parts = null;
    for (let k = 2; k <= sw.length && !parts; k++) { const p = cutInto(sw, k); if (p.every(fits)) parts = p; }
    chunks.push(...(parts ?? sw.map((w) => [w])));
  }
  // A cue under 3 words flashes by faster than it can be read: fold it into a neighbour when it fits.
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].length >= 3 || chunks.length === 1) continue;
    const j = i + 1 < chunks.length ? i + 1 : i - 1;
    const merged = j > i ? [...chunks[i], ...chunks[j]] : [...chunks[j], ...chunks[i]];
    if (fits(merged)) { chunks.splice(Math.min(i, j), 2, merged); i = Math.max(-1, Math.min(i, j) - 1); }
  }
  return chunks.map((c) => ({ words: c.length, lines: fitLines(c, max) ?? [c.join(' ')] }));
}

export function buildCaptions(script, timing, cfg) {
  const cues = [];
  for (const b of [...script.beats].sort((a, c) => a.n - c.n)) {
    const row = timing.beats.find((r) => r.n === b.n);
    if (!b.vo?.trim() || row.dur_s === 0) continue;
    const chunks = splitCaptions(b.vo, cfg);
    const speechEnd = row.end_s - row.pause_after_s;
    const span = Math.max(0.1, speechEnd - row.start_s);
    // weight floor of 3 words: a two-word cue still gets enough time to be read
    const weight = (c) => Math.max(c.words, 3);
    const totalWeight = chunks.reduce((s, c) => s + weight(c), 0);
    let cursor = row.start_s;
    chunks.forEach((c, i) => {
      const end = i === chunks.length - 1 ? speechEnd : cursor + (span * weight(c)) / totalWeight;
      cues.push({ beat: b.n, start_s: round(cursor, 3), end_s: round(end, 3), lines: c.lines });
      cursor = end;
    });
  }
  return cues;
}
