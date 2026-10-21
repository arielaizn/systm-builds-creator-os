import { provenance } from './episode.mjs';
import { buildCaptions, computeTiming } from './timing.mjs';
import { edlCsv, motionProps, shotlistCsv, soundCuesCsv, srt, voText, vtt } from './exporters.mjs';

// Every derived file is a pure function of script.json + config. Same input, same bytes.
export function buildAll(p, script, cfg, id) {
  const timing = computeTiming(script, cfg);
  const cues = buildCaptions(script, timing, cfg);
  const timingDoc = { schema: 'systm/timing@1', episode_id: id, status: 'ready', ...timing, provenance: provenance('build', [p.script]) };
  const motion = motionProps(script, timing, cfg, id);
  motion.provenance = provenance('build', [p.script]);
  const files = new Map([
    [p.timing, JSON.stringify(timingDoc, null, 2) + '\n'],
    [p.vo, voText(script, timing) + '\n'],
    [p.shotlist, shotlistCsv(script, timing)],
    [p.edl, edlCsv(script, timing)],
    [p.srt, srt(cues, cfg)],
    [p.vtt, vtt(cues, cfg)],
    [p.cues, soundCuesCsv(script, timing, cfg)],
    [p.motion, JSON.stringify(motion, null, 2) + '\n'],
  ]);
  return { timing, cues, files };
}
