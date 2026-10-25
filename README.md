# FrameXTV for Nuvio

An unofficial plugin that brings FrameXTV movie and TV episode streams to Nuvio.

## Features

- Seven providers: Super Barbarian, Miner, Headhunter, Valkyrie, Hog Rider, Lava Hound, and Bowler.
- Available quality options, including adaptive Auto streams.
- Audio labels and subtitles when supplied by the source.
- Clean stream labels showing the source and quality.
- Choose which providers to enable in Nuvio.

## Installation

1. Open **Settings → Plugins** in a Nuvio build that supports plugins.
2. Add this repository URL:

   ```text
   https://raw.githubusercontent.com/GaloreMacow/framextv-nuvio/main/manifest.json
   ```

3. Enable the FrameXTV providers you want to use.
4. Open a movie or TV episode and select a FrameXTV stream.

After updates, refresh the repository and reload the title’s sources. Stream availability, quality, and subtitles depend on FrameXTV and its providers.

## Development

Run `npm ci` and `npm test`. Edit shared logic in `providers/framextv.js` or Miner’s client in `scripts/miner-client.js`, then run `npm run build` to update all standalone providers. `npm run test:live` makes an optional live movie lookup; availability depends on upstream sources.
