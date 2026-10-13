# FrameXTV review — v1.1.2

Reviewed with **Spider-Man: Brand New Day**, TMDB movie ID **969681**, on **13 October 2026**. These are point-in-time results, not a guarantee that every provider stays available.

## Live results

| Provider | Results | Verification / limitation |
| --- | --- | --- |
| Super Barbarian | 4 options | Auto, 1080p, 720p, 360p; a downloaded 720p segment contained H.264 video and AAC audio. An English subtitle file downloaded successfully. |
| Miner | 4 options | A focused final lookup returned three fixed qualities plus an Auto master in 23 seconds. The Auto master uses external audio and a `.json` URL that serves valid HLS. Fixed-quality media probes timed out here. |
| Bowler | 14 options | A downloaded segment contained H.264 video and six AAC audio tracks. An English WebVTT subtitle file downloaded successfully. |
| Headhunter | 0 | FrameXTV reported no playable VidLink sources for this title. |
| Valkyrie | 0 | FrameXTV reported an upstream Videasy seed rate limit (HTTP 429). |
| Hog Rider | 0 | FrameXTV reported a VidUp fetch failure (`unexpected EOF`). |
| Lava Hound | 0 | FrameXTV reported a VidFast fetch failure (`unexpected EOF`). |

Successful results carried 67 subtitle entries for Super Barbarian, 68 for Bowler, and 2 for Miner. Only one subtitle file from each of Super Barbarian and Bowler was downloaded; every language was not individually tested. The subtitle contents also contained Spider-Man/Peter Parker/Hulk references consistent with the requested film.

Native phone/TV playback, the complete movie, seeking, and every language/quality combination were not tested. The media checks cover short segments and downloadable subtitle files.

## Changes from the review

- Preserve external audio and subtitle renditions by keeping their HLS master as Auto; do not expose child playlists that lose those tracks.
- Preserve audio labels and explicit transport types, including HLS served from a `.json` URL.
- Normalize relative, parent-directory, protocol-relative, and query-only playlist URLs before invoking limited Nuvio URL bindings. Preserve signed query parameters.
- Omit confirmed HTML/JSON error bodies and HTTP 404/410 playlists. Keep API-provided links when a probe fails in a way that may depend on device or region.
- Add optional request deadlines to all providers. Older runtimes without timers continue to use the app's timeout.
- Allow Miner seeds up to 20 seconds: a successful 19-second response was previously discarded by the 12-second deadline. Its fallback API wait uses the remaining lookup budget.
- Accept `tmdb:` / `tmdb/` prefixes without case sensitivity.

These changes address plugin behavior. They cannot repair unavailable sources in FrameXTV's upstream providers.

## Regression checks

Run:

```sh
node test-review.cjs
node test-miner.cjs
```

**106 regression checks passed**: 91 across all seven providers and 15 for the Miner client protocol/fallback, including a simulated 19-second seed response. All seven providers also passed ES5 parsing and QuickJS helper checks. QuickJS checks use a limited URL shim; they are not a replay of every native Nuvio binding.

Test fixtures use mock sources and a fixed, artificial encryption seed. Live streams and transient tokens are not included in the repository fixtures.
