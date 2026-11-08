# IINA Coyote Audio Link

[简体中文](README.md)

Map IINA audio levels, onsets and zero-crossing rate to Coyote waveforms. Connect through **DG-LAB 4 Socket Control (V4)** or **directly over your Mac’s Bluetooth**. The plugin provides a separate control window, live audio meters, independent A/B intensity limits and a stop button.

Requires Coyote 3.0 and an IINA version with plugins and `standaloneWindow.isOpen()` (tested with IINA 1.5.1). Direct Bluetooth requires macOS 12 or later and supports Intel and Apple Silicon. App mode requires DG-LAB 4. Coyote 2.0 and the older V3 Socket protocol are not supported.

## Install and connect through the app

1. Download the `.iinaplgz` package from [Releases](https://github.com/Eric-Terminal/iina-dglab/releases/latest), open it in IINA and enable the plugin. Alternatively, install from the GitHub repository URL in IINA’s plugin settings. Restart IINA after updating so both plugin entry points reload together.
2. Open media with an audio track. In that playback window, choose **Plugins → Coyote Audio Link → Open Audio Link (use this window)**. Only the last window selected this way supplies audio.
3. Click **Connect app**. The default remote relay is `wss://trex.dungeon-lab.cn/v4`. You can enter a self-hosted V4 URL in Connection settings. This mode does not require Node.js.
4. Pair using **DG-LAB 4 → Socket Control → Connect to server**. Scan the QR code on your phone or paste the complete Socket address into the app.
5. Connect and enable Coyote 3.0 in the app. The plugin receives device state and channel limits. Select a device if more than one is available.
6. Set an intensity limit for the channels you want, click **Apply settings**, then **Enable Audio Link**. Both limits initially equal **0**. Pairing and previewing do not produce waveform output.

The Language selector supports System default, Simplified Chinese and English. Chinese system locales use Simplified Chinese; all other locales use English. Your selection is saved. Changing language does not reconnect, change settings or alter the enabled state.

**Enable Audio Link is a persistent switch.** You can enable it while playback is paused or audio is unavailable. Pause, mute, silence below the gate and temporary sampling interruptions silence output while keeping it enabled; fresh valid audio resumes output automatically. Applying settings while enabled clears old tasks and continues without another click. Device disconnection, command failure, changing media/source/device and closing the window disable the switch.

Channel intensity and waveform amplitude are separate: app mode uses the lower of your configured intensity limit and the app’s reported limit. Audio controls waveform amplitude from 0 to 100. Waveform amplitude 100 does not mean device intensity 100.

## Direct Bluetooth, without the official app

1. Disconnect Coyote 3.0 from other apps and turn it on. Running DG-LAB through PlayCover is not required.
2. Select **Direct Bluetooth · No app**, then **Scan devices**. Allow **Coyote Bluetooth** to access Bluetooth when macOS asks. If permission was previously denied, change it under System Settings → Privacy & Security → Bluetooth.
3. Select the nearby device and click **Connect device**. The helper first writes zero hardware limits, zero intensity and zero waveforms. It waits for the device’s zero-intensity acknowledgement before applying the configured limits. Connection alone does not enable Audio Link.
4. Apply your channel limits, then enable Audio Link manually. Reconnection does not automatically resume output.

The package includes a native Swift/CoreBluetooth helper. End users do not need Node.js or Xcode for this mode. IINA communicates with it using a random loopback port and session token; the token stays outside the WebView and is not sent to a relay. Disconnecting, closing the control window or losing the lease shuts down the helper.

**Direct connection calibration** exposes frequency balance and pulse-width balance, each 0–255 and initially 0, shared by both channels. The official BF command writes these values and the channel soft limits to the device. **These settings persist across device power cycles.** The plugin does not read or inherit the official app’s calibration. Connecting and applying settings overwrite these values; check your settings in the official app when switching back.

The bundled helper is ad-hoc signed, without an Apple Developer ID signature or notarization. macOS may block its first launch after download. After verifying the package source, approve the helper in System Settings → Privacy & Security, or build it from source. The plugin does not disable system security checks.

Protocol, helper process and UI tests pass without hardware. **Physical Bluetooth discovery, handshake, output and stop timing have not yet been verified on a Coyote device.** Remote app mode remains the default.

## Waveform advance and preview

**Waveform advance** accepts **0–1000 ms**, default **0**. For example, 100 makes output use audio features 100 ms ahead of the current sound. Apply settings to change it; the enabled state is preserved.

RMS, peak, ZCR, the level graph and waveform preview always use audio at the **current playback time**. Only device output uses the advance. The two paths have independent mapping history and smoothing, so the preview remains a calibration reference. Version 1.2.0 shared the advanced readings with the preview; 1.3.0 separates them.

The plugin selects timestamped frames from mpv’s decoded audio buffer. It does not change `audio-delay` or audiovisual offsets. Nonzero advance expands the audio buffer when needed; returning to 0, ending playback or closing the console restores the original setting. Larger buffers can increase waiting time after seeking, speed changes or filter changes. Advance is measured in real time: at 2× playback, 100 ms selects audio 200 ms ahead on the media timeline.

This is not an end-to-end latency measurement. The 100 ms send interval, audio frame boundaries, smoothing, drivers, network, app and Bluetooth can introduce delay or jitter. Adjust by observation. If future audio is unavailable during startup, seeking, live playback or near the end of a file, output waits for valid data. It does not predict sound or reuse old frames.

## Optional local app relay

If the official app and IINA run on the **same Mac**, select the local relay. It requires Node.js 22+. The plugin checks `/opt/homebrew/bin/node` and `/usr/local/bin/node`, or you can provide an absolute path. Copy the generated Socket address into the app.

The relay binds only to `127.0.0.1`; it does not expose a LAN port, contact the official relay or generate a `.cn` QR redirect. Each session has a random port and key. Reconnecting requires a new address. Disconnecting or closing the console stops the relay; losing its lease stops it after approximately 8–9 seconds. Device tasks still retain their separate 100/250 ms durations.

A PlayCover installation of DG-LAB 4.2.6 returned HTTP 403 with version 1.1.0. Version 1.1.1 moved the key into the URL path and allowed a trailing slash. The exact URL transformation and real-app compatibility after that change remain unverified. Use remote mode if local pairing fails.

## How audio becomes waveforms

mpv’s `astats` measures each decoded audio frame. `ametadata` writes features and timestamps to a temporary file, which the plugin reads incrementally every 100 ms. Current preview selects `audio-pts`; output selects `audio-pts + advance × speed`. The file contains neither raw audio nor media names, rotates at approximately 32 MiB and is deleted when capture ends. The in-memory timeline is bounded.

Only the selected IINA audio track is analyzed. The plugin does not capture your microphone or system audio. Its tagged filter is appended without replacing existing equalizers or other filters. Audio passthrough does not expose usable PCM statistics; disable passthrough in IINA to use this plugin.

The default hybrid mode primarily follows RMS and increases peak weighting during an onset:

```text
onset = max(current RMS − previous RMS, 0)
peak weight = 0.15 + 0.30 × clamp(onset / 12, 0, 1)
level = RMS + max(Peak − RMS, 0) × peak weight
normalized level = clamp((level − gate) / (ceiling − gate), 0, 1)
target amplitude = floor(normalized level ^ gamma × amplitude limit)
```

- Adaptive gate: the 20th percentile over about 8 seconds estimates background level, with 6 dB margin. It begins after 20 samples, moves at most 3 dB/s and rises no more than 12 dB above your configured gate, staying below the ceiling.
- Hysteresis: opening requires 2 dB above the gate; closing uses the gate itself. Below the closing threshold, output is silenced immediately.
- Envelope: 35 ms attack and 90 ms release above the gate. Default gamma is 1.1. Pure RMS and peak modes are also available.
- Frequency: per-channel ZCR is energy-weighted, normalized to a 48 kHz scale, then smoothed with a three-sample median and a 120 ms exponential filter. As ZCR rises from 0.02 to 0.22, the default frequency code falls from 100 to 10. Codes are not Hz; smaller values mean denser pulses.
- Packing: each 100 ms waveform has four frequency bytes followed by four amplitude bytes at 70%, 85%, 100% and 90% of the mapped amplitude.

ZCR and loudness do not reliably classify voices, impacts or music. An adaptive gate does not isolate background music. Sustained music or speech can raise the estimated noise floor; disable adaptation if you prefer a fixed gate. There are no physiological recovery or anti-numbness guarantees. `astats reset=1` resets statistics per decoded frame; it does not mean zero latency. Very short transients can fall between samples.

## Stop behavior and diagnostics

| Event | Behavior |
| --- | --- |
| Pause, mute, zero volume, buffering, seeking or closed gate | Silence output; remain enabled and resume on fresh valid audio |
| Apply settings while enabled | Clear old tasks, preserve the switch, then continue with new settings |
| No fresh sample for over 350 ms | Discard stale readings, silence and wait; do not replay missed frames |
| Media end/change, source/device change, disconnection or command failure | Disable Audio Link; manual enabling is required |
| Stop button or Esc inside the console | Disable Audio Link and stop output |
| Ctrl+Option+Esc in the playback window | Stop through the plugin menu shortcut |
| Close console | Stop, disconnect, clean up audio statistics, restore buffering and shut down helpers |

App mode sends only the current frame and replaces tasks using V4 `im: true`. Pending acknowledgements cause new frames to be dropped instead of queued. Waveform tasks last 100 ms and temporary intensity tasks 250 ms. Stop clears channel tasks and requests zero intensity. A disconnected network cannot deliver a stop command; physical stopping behavior still needs hardware verification.

App command acknowledgement timeout is **2 seconds**, independent of task duration. Waiting does not extend or replay the old task. Errors retain the original failure, command and channel. **App connected** means pairing is intact, not that every command has been acknowledged. A failed stop requires disconnection and reconnection. Do not schedule tasks from another controller on the same channels: clearing tasks is scoped to device and channel.

Direct Bluetooth sends one B0 packet containing both channels every 100 ms. Only the latest frame is retained, each frame is consumed once, cached frames expire after 100 ms and temporary intensity expires after 250 ms. Missing valid frames produce zero waveforms. Intensity changes wait for the matching B1 sequence; a 500 ms acknowledgement timeout attempts zeroing and disconnects. Cache expiry is not an exact physical stop timestamp: transfer and device consumption add delay. The 8-second helper lease manages process lifetime, not waveform duration.

An earlier real-app session stopped despite showing App connected. Its screenshot does not establish the original cause. Version 1.3.0 adds command diagnostics and longer acknowledgement waiting; resolution of that specific issue has not yet been confirmed on hardware.

## Permissions and troubleshooting

Network permission covers Socket traffic and local helper communication. Filesystem permission covers temporary statistics and launching the bundled helpers, plus mpv commands and buffering changes through IINA. Bluetooth permission is requested only when scanning. The plugin does not scan media folders. Remote mode sends device commands and receives app state; it does not upload media, filenames, raw audio or RMS/ZCR measurements. The official app’s own network behavior is outside the plugin.

If readings are missing, choose the plugin’s **use this window** menu item in the intended playback window. The status distinguishes pause, mute, buffering, unavailable PCM and filter errors. Connecting a device alone does not provide audio. In the player’s plugin developer console, `iina.mpv.getNative('af')` should contain `iina_dglab`. Reading this property does not start output.

## Build and test

Building requires Node.js 22+, macOS and Xcode Command Line Tools with a Swift compiler. The native build creates an ad-hoc signed universal helper targeting macOS 12+. End users install the bundled artifacts without developer tools.

```sh
git clone https://github.com/Eric-Terminal/iina-dglab.git
cd iina-dglab
npm ci
npm run check
npm run build:native
npm test
npm run test:native
npm run test:mpv
npm run test:timing
npm run pack
```

The mpv tests require local `ffmpeg` and `mpv`, synthesize audio/video and use null output. Tests cover mapping, persistent enabling, preview separation, localization, complete UI flow, IINA adapters, actual WebSocket RPC including delayed responses, helper authentication and lease shutdown, plus BF/B0/B1 validation and expiry. They do not scan or connect to Bluetooth hardware.

For a local synthetic UI preview, run `npm run build`, then `node node_modules/tsx/dist/cli.mjs scripts/preview.ts`. It uses a virtual app/device, with no physical output. `dist/` is committed so GitHub installation needs no build step. Package source, native source, build scripts and dependency lockfile are included in each release.

Earlier versions were checked by the user with IINA 1.5.1 / mpv 0.41.0 for audio curves, pause state, official relay pairing and device snapshots. Actual advance calibration, revised local-app pairing, direct Bluetooth operation and physical stopping time remain to be verified.

## References and license

- [IINA plugin API](https://docs.iina.io/)
- [DG-LAB 4 SDK and V4 protocol](https://github.com/dungeonlab-open/dglab-kit)
- [Official V4 relay](https://github.com/dungeonlab-open/dglab-websocket-server/blob/main/v4-server.ts)
- [Official Coyote 3.0 BLE protocol](https://github.com/dungeonlab-open/DG-LAB-OPENSOURCE/blob/main/coyote/v3/README.md)
- [OTCMultiPlugin](https://github.com/qianxiao1213/OTCMultiPlugin), referenced for connection/state/channel design; no code copied.

Licensed under [GPL-3.0-only](LICENSE), consistent with the bundled official SDK. See [third-party notices](THIRD_PARTY_NOTICES.md).
