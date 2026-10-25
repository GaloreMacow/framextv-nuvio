# FrameXTV review — v1.2.0

Reviewed on **25 October 2026**. The plugin now exposes 14 independent providers. Existing provider IDs and settings are retained.

## Changes

- Result `name`, `title`, and `quality` now contain only a resolution, `Auto`, or `Unknown`. Source names, audio language labels, bitrate annotations, and redundant descriptive text are removed from the result labels. Embedded audio tracks and attached captions remain available to the player. Adaptive API ranges such as `4K / 1080p` are shown as `Auto` until a fixed variant is identified.
- Fixed Miner's stale Origin/Referer: the website now uses `https://www.movy.sx/` instead of `.bz`. A paired seed test returned HTTP 403 with the old origin and HTTP 200 with the current one. The updated client returned sources for all four test titles.
- Updated Miner's city list to match the retrieved public website client: Miami, Boise, and Atlanta first; Seattle, Phoenix, Oakland, Vegas, Portland, and Dallas only if the primary group returns no usable sources. Requests respect the lookup budget and retain the existing API fallback.
- Added seven missing API providers: Royal Champion, Skeleton King, Titan, Giant, Executioner, Root Rider, and Archer Queen. Every addition returned results for at least one title in the matrix below.
- Preserved per-lookup playlist reuse, shared-caption normalization, full-response deadlines, alternate playback headers/captions/audio versions, and external HLS audio/subtitle groups. No persistent signed-URL cache or runtime imports were added.

## Why only one or two providers returned results

1. FrameXTV's API explicitly reports Headhunter, Valkyrie, Hog Rider, and Lava Hound as **provider disabled by configuration**. Miner's API backend is disabled too; its public client lookup is the usable path when the current origin and cities are used.
2. The old plugin catalog did not include seven API providers that currently supply streams.
3. Super Barbarian returned no Cinejoy streams for Inception. For other selections it supplied a playlist that returned an HTML **Site Unavailable** page, which the plugin correctly rejected.
4. Some newer sources remain title-dependent or intermittent: recorded errors include an open failure circuit, a server-side decoding HTTP 500, no sources, upstream validation failure, and rate limiting. Adding a provider does not guarantee results for every title.

## Live lookup results

Each TV selection used season 1, episode 1. Counts are returned stream options after plugin normalization, HLS expansion, and filtering, not full-playback guarantees. All four final lookups used the updated 14-provider catalog.

| Provider | Inception (27205) | Interstellar (157336) | Breaking Bad (1396) | Wednesday (119051) |
| --- | --- | --- | --- | --- |
| Super Barbarian | 0 | 0 | 0 | 0 |
| Miner | 11 | 11 | 10 | 11 |
| Headhunter | 0 | 0 | 0 | 0 |
| Valkyrie | 0 | 0 | 0 | 0 |
| Hog Rider | 0 | 0 | 0 | 0 |
| Lava Hound | 0 | 0 | 0 | 0 |
| Bowler | 7 | 7 | 8 | 6 |
| Royal Champion | 9 | 0 | 0 | 0 |
| Skeleton King | 0 | 0 | 3 | 0 |
| Titan | 1 | 1 | 1 | 1 |
| Giant | 1 | 0 | 1 | 1 |
| Executioner | 13 | 16 | 14 | 15 |
| Root Rider | 3 | 3 | 3 | 3 |
| Archer Queen | 0 | 24 | 0 | 0 |
| **Total options** | 45 | 62 | 40 | 37 |
| **Providers with results** | 7 | 6 | 7 | 6 |

Some playlist probes timed out; player-provided URLs are retained for failures that may depend on region or device. Full native playback, seeking, and every audio/subtitle/quality option were not tested. The earlier v1.1.3 sample check downloaded a Bowler segment containing H.264 video and AAC audio, plus a WebVTT subtitle; that is not a playback test for the newly added providers.

## Website comparison

The public homepage redirected from `framextv.tech` to `framextv.cc`. The website opened in the live browser, but its script then logged **You don't have permission to use DEVTOOL** and redirected the tab to `about:blank`, including after a recovery attempt. No safeguard was disabled or bypassed. Consequently the website player's end-to-end behavior could not be compared in that browser.

The public website JavaScript retrieved before that restriction shows browser-side handlers for some sources, including Miner. Its current Miner origin and city list informed the protocol update. The plugin's API diagnostics separately recorded provider failure reasons and active alternate IDs. A website-side provider label does not imply that the same provider is enabled on the backend API.

## Checks and reproducibility

```sh
npm ci
npm test
npm run test:live
```

**424 checks pass:** 182 provider regression checks, 17 Miner protocol/fallback checks, 197 optimization/label checks, and 28 ES5/QuickJS checks. Checks cover exact API provider selections, resolution-only labels, language/HDR stripping, adaptive range labels, captions/headers, independent city failures, secondary-city fallback, and avoiding secondary requests when primary cities work.

The shared-caption fixture still normalizes 67 common captions once for 20 sources. Standalone provider consistency is checked by the generator. All runtime scripts remain ES5-compatible without DOM, Node APIs, eval, BigInt, or Math.imul requirements. Limited-binding engine tests do not reproduce every native Nuvio binding.

`LIVE_ID`, `LIVE_TYPE`, `LIVE_SEASON`, `LIVE_EPISODE`, and `LIVE_PROVIDER` select live test inputs. Normal diagnostic output records API source counts and failure reasons while omitting full playback URLs and request query strings. Temporary payloads, signed links, and live media are not published as repository fixtures.

Refresh the repository in Nuvio, enable the new providers you want, and reload the title's sources. Unavailable legacy providers remain optional settings rather than being removed or silently mapped to a different source.
