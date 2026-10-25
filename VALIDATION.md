# FrameXTV review — v1.1.4

Reviewed on **25 October 2026**. All seven provider IDs, settings switches, and API provider selections are retained. These checks describe this version and point-in-time upstream availability.

## Changes

- v1.1.4 removes the redundant `FrameXTV |` prefix from all seven provider display names. Provider IDs and API selections remain unchanged. The processing improvements below were introduced in v1.1.3.

- Removed the redundant `FrameXTV |` prefix from result names and titles, plus the uninformative `API source` suffix. Source/server names, source tags, quality, bitrate, and audio labels remain available. Subtitle labels fall back to their language or `Subtitles`.
- Normalize common payload subtitles once instead of repeating that work for every source. Source-specific captions and subtitle request headers are retained.
- Reuse the fetch and parse of an identical HLS playlist within one lookup. Cache keys include playback headers; different referrers or authorization remain separate. Each new lookup starts fresh.
- Skip splitting and scanning segment lines when a playlist has no master variants. Sort parsed master variants once, rather than again for every source using that master.
- Serialize duplicate playback metadata only when a URL repeats. Deduplication now preserves versions with different headers, captions, audio labels, quality, or transport type instead of discarding everything after the first URL match.
- Extend optional request deadlines through response body reads, including API JSON, Miner seed/city responses, and HLS text. Runtimes without timers continue to depend on the application's timeout; network cancellation is not required.
- Keep Miner's public client decoder, three independent city lookups, and API fallback. An invalid decoded city payload cannot discard another city's results. Its fallback does not start after the lookup budget is exhausted.
- Generate standalone provider scripts from one shared template plus the Miner client fragment, and check consistency automatically. Distributed scripts still need no runtime imports, Node APIs, DOM, or eval.

External HLS audio/subtitle groups retain their parent Auto master. Signed query parameters, relative playlist paths, subtitle headers, and explicit HLS types (including HLS served at `.json` URLs) remain supported. Confirmed HTML/JSON errors and HTTP 404/410 are excluded; device/region-dependent probe failures retain API-provided URLs.

## Automated checks

```sh
npm ci
npm test
```

**212 checks pass:** 91 existing provider regression checks, 15 Miner protocol/fallback checks, 92 optimization/reliability checks, and 14 ES5/QuickJS runtime checks. The Miner fixtures include a successful seed response at 19 seconds and execution without BigInt or Math.imul. Runtime checks use a limited URL shim and no Node APIs or timers; they do not reproduce every native Nuvio binding.

A controlled fixture with **20 sources and 67 common captions** reduced common-subtitle normalization passes from **20 to 1**, with identical playback URLs, qualities, headers, and captions compared with v1.1.2. This measures redundant work, not a universal speedup or download-size reduction.

## Live checks

Use `npm run test:live` for an optional live lookup. Environment variables `LIVE_ID`, `LIVE_TYPE`, `LIVE_SEASON`, `LIVE_EPISODE`, and `LIVE_PROVIDER` select a title/provider. The default is movie TMDB **969681** (Spider-Man: Brand New Day). Normal output omits full playback URLs and request query strings.

| Selection | Super Barbarian | Miner | Headhunter | Valkyrie | Hog Rider | Lava Hound | Bowler |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Spider-Man: Brand New Day, movie 969681 | 0 | 0 | 0 | 0 | 0 | 0 | 8 |
| Jailer, movie 937020 | 0 | 0 | 0 | 0 | 0 | 0 | 7 |
| Game of Thrones, TV 1399, S1 E1 | Not run | Not run | Not run | Not run | Not run | Not run | 4 |

Miner's public seed endpoint returned HTTP 403 from this environment for both movies, and its fallback produced no streams. The Super Barbarian API explicitly reported no working Cinejoy streams for movie 969681. The other empty provider results were returned through their API lookups; fixtures verify that successful responses still resolve, but live availability for those providers was not established.

A Bowler 480p playlist and one segment downloaded successfully. The segment had a PNG prefix; explicitly probing it as MPEG-TS found **H.264 video and AAC audio**. One supplied subtitle downloaded as WebVTT. This is not proof of automatic native-player format detection or successful playback of every option.

Native phone/TV playback, seeking, full movies/episodes, and every language/quality combination were not tested. Temporary live responses and signed URLs are kept out of repository fixtures. Upstream availability and player compatibility can change independently of the plugin.
