import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { round } from './util.mjs';

const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
export const has = (cmd) => spawnSync(cmd, ['-version'], { encoding: 'utf8' }).status === 0;

export function probe(file) {
  const r = run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  if (r.status !== 0) throw new Error(`ffprobe failed: ${r.stderr.trim().slice(0, 200)}`);
  return JSON.parse(r.stdout);
}

export function qaMedia(file, cfg, { timing = null, framesDir = null } = {}) {
  if (!has('ffmpeg') || !has('ffprobe')) return { verdict: 'BLOCKED', checks: [{ id: 'M00', status: 'BLOCKED', msg: 'ffmpeg/ffprobe not found' }] };
  const info = probe(file);
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  const dur = Number(info.format.duration);
  const [num, den] = (v?.avg_frame_rate ?? '0/1').split('/').map(Number);
  const fps = den ? num / den : 0;
  const checks = [];
  const add = (id, status, msg) => checks.push({ id, status, msg });
  const f = cfg.format;
  add('M01', v && v.width === f.width && v.height === f.height ? 'PASS' : 'FAIL', `resolution ${v?.width}x${v?.height}, expected ${f.width}x${f.height}`);
  add('M02', Math.abs(fps - f.fps) < 0.01 ? 'PASS' : 'FAIL', `frame rate ${round(fps, 3)}, expected ${f.fps}`);
  add('M03', dur >= f.target_min_s && dur <= f.target_max_s ? 'PASS' : dur >= f.hard_min_s && dur <= f.hard_max_s ? 'WARN' : 'FAIL', `duration ${round(dur, 2)}s, target ${f.target_min_s}-${f.target_max_s}s`);
  if (timing) add('M04', Math.abs(dur - timing.total_s) <= 1.5 ? 'PASS' : 'WARN', `rendered ${round(dur, 2)}s vs planned ${timing.total_s}s`);
  add('M05', a ? 'PASS' : 'FAIL', a ? `audio ${a.codec_name} ${a.channels}ch` : 'no audio stream');

  const black = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vf', 'blackdetect=d=0.15:pix_th=0.05', '-an', '-f', 'null', '-']);
  const blacks = [...black.stderr.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)/g)].map((m) => ({ start: +m[1], end: +m[2] }));
  const lastBlackAtEnd = blacks.some((b) => b.end >= dur - 0.2 && b.end - b.start > 0.5);
  add('M06', blacks.length === 0 ? 'PASS' : lastBlackAtEnd || blacks.some((b) => b.end - b.start >= 0.5) ? 'FAIL' : 'WARN', blacks.length ? `black frames: ${blacks.map((b) => `${round(b.start, 2)}-${round(b.end, 2)}s`).join(', ')}` : 'no black frames');

  if (a) {
    const vol = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-']);
    const max = vol.stderr.match(/max_volume:\s*(-?[\d.]+) dB/);
    const mean = vol.stderr.match(/mean_volume:\s*(-?[\d.]+) dB/);
    if (max) add('M07', Number(max[1]) >= -0.1 ? 'FAIL' : Number(max[1]) > cfg.loudness.peak_ceiling_db + 0.5 ? 'WARN' : 'PASS', `sample peak ${max[1]} dB (ceiling ${cfg.loudness.peak_ceiling_db} dB), mean ${mean?.[1]} dB`);
    const ln = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
    const j = ln.stderr.match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/);
    if (j) {
      try {
        const o = JSON.parse(j[0]);
        const lufs = Number(o.input_i);
        const tp = Number(o.input_tp);
        add('M08', Math.abs(lufs - cfg.loudness.target_lufs) <= cfg.loudness.tolerance_lu ? 'PASS' : 'WARN', `integrated ${lufs} LUFS (target ${cfg.loudness.target_lufs} ±${cfg.loudness.tolerance_lu}), true peak ${tp} dBTP`);
        if (tp > -0.5) add('M09', 'FAIL', `true peak ${tp} dBTP will clip after platform re-encode`);
      } catch { /* loudnorm output not parseable */ }
    }
    const sil = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'silencedetect=n=-45dB:d=1.5', '-f', 'null', '-']);
    const gaps = [...sil.stderr.matchAll(/silence_start:\s*([\d.]+)[\s\S]*?silence_end:\s*([\d.]+)/g)].map((m) => ({ start: +m[1], end: +m[2] }));
    add('M10', gaps.length === 0 ? 'PASS' : 'WARN', gaps.length ? `silences over 1.5s: ${gaps.map((g) => `${round(g.start, 1)}-${round(g.end, 1)}s`).join(', ')} (only the twist should be silent)` : 'no dead air');
  }

  let frames = [];
  if (framesDir) {
    fs.mkdirSync(framesDir, { recursive: true });
    const points = timing ? timing.beats.filter((b) => b.dur_s > 0).map((b) => ({ n: b.n, t: (b.start_s + b.end_s) / 2 })) : Array.from({ length: 13 }, (_, i) => ({ n: i + 1, t: ((i + 0.5) * dur) / 13 }));
    for (const p of points) {
      const out = path.join(framesDir, `beat-${String(p.n).padStart(2, '0')}.png`);
      run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(round(p.t, 3)), '-i', file, '-frames:v', '1', out]);
      if (fs.existsSync(out)) frames.push(out);
    }
    add('M11', frames.length ? 'PASS' : 'FAIL', `${frames.length} beat frames written to ${framesDir}: open them on a phone-sized view to check legibility and safe zones`);
  }
  const rank = { FAIL: 3, BLOCKED: 2, WARN: 1, PASS: 0 };
  const verdict = checks.reduce((w, c) => (rank[c.status] > rank[w] ? c.status : w), 'PASS');
  return { verdict, duration_s: round(dur, 3), checks, frames };
}
