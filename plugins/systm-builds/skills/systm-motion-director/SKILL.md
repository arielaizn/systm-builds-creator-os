---
name: systm-motion-director
description: "Plan and build the MOTION layer of a SYSTM BUILDS episode from build/motion-props.json: the eight compositions (ColdOpen, Dilemma, Insight, Reveal, StressTest, Proof, Caveat, Giveaway), Hebrew RTL kinetic text, minimal flow diagrams, deterministic frame-driven animation, optional Remotion. Use for 'build the graphics', the MOTION beats, or an optional Remotion render. Triggers: מושן, motion, Remotion, קינטיק טייפ, גרפיקה לפרק, ColdOpen, systm motion."
---

# systm-motion-director · optional milestone M4

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`. When installed as a plugin, the plugin root is two folders above this file (`../../scripts/systm.mjs`); after `./install.sh` the launcher `systm` is on PATH and the root is the repository's `plugins/systm-builds`. Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

The plugin ships the contract, not a video project. `systm build` writes `build/motion-props.json`; you build the compositions with whatever frame-driven renderer the creator has (Remotion, HyperFrames or similar). Check `systm doctor` for Remotion and Hebrew fonts first. If the creator has other motion skills installed, use them for craft and keep this skill for the contract.

## The contract (`motion-props.json`)

```
format:    { width: 1080, height: 1920, fps: 30, durationInFrames }
brand:     { bg: #0B0B0C, accent: #7FD4FF, fg: #FFFFFF }
safe_zone: { top, bottom, side }
direction: "rtl"
segments:  [{ composition, from, durationInFrames, beats: [n...], lines: [{ beat, text, mode, from, durationInFrames }] }]
```

Everything is an integer frame count. The same input gives the same file.

## The eight compositions

| Composition | Beats | What it shows |
|---|---|---|
| ColdOpen | 1 | the verified result, framed tight; the label for demo data is part of the frame |
| Dilemma | 2, 3, 4 | the question, two diverging costs, the open question |
| Insight | 5, 6 | one process card gaining two fields; alternatives closing with a reason each |
| Reveal | 7, 8 | the honest source line, then the name lock. One reveal hit, no logo animation |
| StressTest | 9 | the edge case: the cursor crosses the risky rows, then a hold |
| Proof | 10, 11 | input, action, output and the before/after. Real captures sit under the graphics |
| Caveat | 12 | one limitation in a short line |
| Giveaway | 13 | the question for the next build; the giveaway card only when the launch gate is OPEN |

Only `MOTION` beats are fully graphic. In `SCREEN` and `A-CAM` beats the composition contributes overlays (headline, label, cursor highlight) on top of footage.

## Rules for the build

- **Deterministic.** All animation is a function of the frame number. No `Math.random`, no `Date.now`, no network at render time. Assets are local files.
- **RTL.** `direction: rtl` on the root. Mixed Hebrew and Latin or digits are checked on a rendered frame. Use Heebo, Assistant or Rubik at medium weight or heavier.
- **Minimal.** One idea per frame, 7 words per headline, no decorative loops, no generic robots or stock icons.
- **Safe zone.** Nothing important outside `safe_zone`.
- **Honesty on screen.** A demo is labelled `נתוני דמו`. An accelerated clip is labelled. A mock-up is never presented as the deployed product.
- **Timing comes from the props.** Do not retime by hand. If the line is too long for its frames, shorten the line or change the script and rebuild.

## Check

Render one still at the middle of each beat and look at it at phone size (`remotion still` or the renderer's equivalent). Verify: the Hebrew is correct and ordered right, the label is present where the data is synthetic, nothing sits in the unsafe area. Then render the video and run `systm qa-media out.mp4 --episode EPxxx --frames frames/`.
