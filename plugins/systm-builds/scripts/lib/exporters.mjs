import { toCsv } from './csv.mjs';
import { RLM, hasHebrew } from './he.mjs';
import { round, timecode } from './util.mjs';
import { smpte, shotsForBeat } from './timing.mjs';

export function voText(script, timing) {
  const lines = [];
  for (const r of timing.beats) {
    const b = script.beats.find((x) => x.n === r.n);
    if (b.vo?.trim()) lines.push(b.vo.trim());
  }
  return lines.join('\n\n');
}

export function allShots(script, timing) {
  return timing.beats.flatMap((r) => {
    const b = script.beats.find((x) => x.n === r.n);
    return r.dur_s === 0 ? [] : shotsForBeat(b, r);
  });
}

export function shotlistCsv(script, timing) {
  const fps = timing.fps;
  const rows = allShots(script, timing).map((s) => ({
    id: s.id, beat: s.beat, in: smpte(s.start_frame, fps), out: smpte(s.end_frame, fps), mode: s.mode, asset: s.asset,
    framing: s.framing, action: s.action, overlay: s.overlay, audio: s.audio, evidence: s.evidence,
  }));
  return toCsv(['id', 'beat', 'in', 'out', 'mode', 'asset', 'framing', 'action', 'overlay', 'audio', 'evidence'], rows);
}

export function edlCsv(script, timing) {
  const sfxTypes = new Set(['SFX', 'UI', 'REVEAL_HIT', 'SONIC_LOGO', 'SILENCE']);
  const rows = allShots(script, timing).map((s) => {
    const sfx = (script.sound ?? []).filter((x) => x.beat === s.beat && sfxTypes.has(x.type)).map((x) => `${x.type}:${x.asset || x.note}`).join(' | ');
    return {
      start_frame: s.start_frame, end_frame: s.end_frame, asset: s.asset,
      transform: s.framing, caption: s.overlay, sfx: sfx || s.audio, transition: s.transition,
    };
  });
  return toCsv(['start_frame', 'end_frame', 'asset', 'transform', 'caption', 'sfx', 'transition'], rows);
}

const lineOut = (l, rlm) => (rlm && hasHebrew(l) ? RLM + l : l);

export function srt(cues, cfg) {
  return cues.map((c, i) => `${i + 1}\n${timecode(c.start_s, ',')} --> ${timecode(c.end_s, ',')}\n${c.lines.map((l) => lineOut(l, cfg.captions.rlm)).join('\n')}\n`).join('\n');
}

export function vtt(cues, cfg) {
  return 'WEBVTT\n\n' + cues.map((c, i) => `${i + 1}\n${timecode(c.start_s, '.')} --> ${timecode(c.end_s, '.')}\n${c.lines.map((l) => lineOut(l, cfg.captions.rlm)).join('\n')}\n`).join('\n');
}

export function soundCuesCsv(script, timing, cfg) {
  const rows = [];
  for (const r of timing.beats) {
    const b = script.beats.find((x) => x.n === r.n);
    if (b.vo?.trim() && r.dur_s > 0) rows.push({ time_s: r.start_s, beat: r.n, type: 'VO', asset: 'vo_take', license: 'own', duck_db: '', note: 'voice first, music ducks under it' });
  }
  for (const s of script.sound ?? []) {
    const row = timing.beats.find((r) => r.n === s.beat);
    if (!row) continue;
    rows.push({ time_s: round(row.start_s + (s.offset_s ?? 0), 3), beat: s.beat, type: s.type, asset: s.asset ?? '', license: s.license ?? '', duck_db: s.type === 'MUSIC' ? (s.duck_db ?? -12) : '', note: s.note });
  }
  rows.sort((a, b) => a.time_s - b.time_s || a.type.localeCompare(b.type));
  return toCsv(['time_tc', 'time_s', 'beat', 'type', 'asset', 'license', 'duck_db', 'note'], rows.map((r) => ({ time_tc: smpte(Math.round(r.time_s * timing.fps), timing.fps), ...r })));
}

// Frame-driven props for an optional Remotion/HyperFrames build. Integers only, so output is reproducible.
export function motionProps(script, timing, cfg, episodeId) {
  const segments = [];
  const compOf = (n) => BEAT_COMP[n];
  for (const r of timing.beats) {
    if (r.dur_s === 0) continue;
    const b = script.beats.find((x) => x.n === r.n);
    const comp = compOf(r.n);
    const last = segments[segments.length - 1];
    const line = { beat: r.n, text: b.on_screen_text, mode: b.mode, from: r.start_frame - (last && last.composition === comp ? last.from : r.start_frame), durationInFrames: r.end_frame - r.start_frame };
    if (last && last.composition === comp) {
      last.beats.push(r.n);
      last.lines.push(line);
      last.durationInFrames = r.end_frame - last.from;
    } else {
      segments.push({ composition: comp, from: r.start_frame, durationInFrames: r.end_frame - r.start_frame, beats: [r.n], lines: [line] });
    }
  }
  return {
    schema: 'systm/motion-props@1',
    episode_id: episodeId,
    format: { width: cfg.format.width, height: cfg.format.height, fps: cfg.format.fps, durationInFrames: timing.total_frames },
    brand: cfg.brand,
    safe_zone: cfg.safe_zone,
    direction: 'rtl',
    segments,
  };
}

import { BEATS } from './model.mjs';
const BEAT_COMP = Object.fromEntries(BEATS.map((b) => [b.n, b.composition]));
