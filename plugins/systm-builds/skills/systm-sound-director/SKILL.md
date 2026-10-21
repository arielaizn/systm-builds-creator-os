---
name: systm-sound-director
description: "Design and check the soundtrack of a SYSTM BUILDS episode: voice first, licensed music and SFX only, subtle UI sounds, silence at the twist, exactly one reveal hit, a sonic logo, timecoded cues with ducking under the voice and a peak check. Use for 'sound for the episode', 'music', 'SFX', 'ducking', 'פסקול'. Triggers: פסקול, מוזיקה, SFX, sound design, sound-cues, ducking."
---

# systm-sound-director

## Engine

Deterministic work (validation, ranking, timing, exports, gates) runs through the `systm` CLI. Run `systm where` first. If `systm` is not on PATH, call `node <plugin-root>/scripts/systm.mjs ...`; the plugin root is two folders above this file (`../../scripts/systm.mjs`). Work in the project's `systm/` workspace (`systm init` creates it). Exit codes: 0 ok, 1 FAIL, 2 BLOCKED, 3 refused because it needs a human.

The soundtrack serves the voice. If a cue competes with a word, the cue loses.

## The cue plan

Fill `script.json › sound`. Each event: `beat`, `type`, `offset_s` (from the start of the beat), `asset`, `license`, `duck_db`, `note`.

| Type | Rule |
|---|---|
| `MUSIC` | one bed for the whole episode, `duck_db` about -12 under the voice. Licensed |
| `UI` | subtle clicks and confirmations on real screen actions. Low level |
| `SILENCE` | at the twist, **after** the spoken line ends (inside `pause_after_s`), never on top of speech. The verifier fails a silence that lands on speech |
| `REVEAL_HIT` | exactly one, at the product name |
| `SONIC_LOGO` | exactly one, at the end |
| `SFX` | sparing; each one has a reason on screen |

The VO rows in `build/sound-cues.csv` are generated for you.

## Licensing

Only assets whose licence you can name: the creator's own library, a stock service they are subscribed to, or music they commissioned. Write the licence in the `license` field of each event that has an `asset`. If the asset is not chosen yet, leave `asset` empty and say so in `note`; the verifier will not accept a named asset without a licence. If the creator uses a media service with an MCP/connector, search its stock library first and generate only when nothing fits.

## Mix targets (checked by `systm qa-media`)

Integrated loudness -14 LUFS plus or minus 2, true peak at or below -1 dBTP, no dead air over 1.5 seconds except the twist, voice intelligible on a phone speaker. Duck music 10 to 14 dB under speech with a fast attack and a slow release.

## Done when

`systm verify` shows V14 PASS, every named asset has a licence, and the rendered file passes the loudness and peak checks.
