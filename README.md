# FrameXTV for Nuvio

An unofficial plugin that brings FrameXTV movie and TV episode streams to Nuvio.

## Features

- Individual provider switches, including Miner, Bowler, Executioner, Root Rider, Giant, Titan, Royal Champion, Skeleton King, and Archer Queen.
- Available quality options, including adaptive Auto streams.
- Resolution-only stream labels, such as Auto, 4K, 1080p, and 720p.
- Available audio tracks and subtitles when supplied by the source.
- Choose which providers to enable in Nuvio.

## Installation

1. Open **Settings → Plugins** in a Nuvio build that supports plugins.
2. Add this repository URL:

   ```text
   https://raw.githubusercontent.com/GaloreMacow/framextv-nuvio/main/manifest.json
   ```

3. Enable the providers you want to use, such as **Super Barbarian**, **Miner**, or **Bowler**.
4. Open a movie or TV episode and select a FrameXTV stream.

After updates, refresh the repository, enable your preferred providers (including any new ones), and reload the title’s sources. Stream availability, quality, and subtitles depend on FrameXTV and its providers. Some older providers are disabled upstream; their existing settings are retained.

## Development

Run `npm ci` and `npm test`. Edit shared logic in `providers/framextv.js` or Miner’s client in `scripts/miner-client.js`, then run `npm run build` to update all standalone providers. `npm run test:live` makes an optional live movie lookup; availability depends on upstream sources.
