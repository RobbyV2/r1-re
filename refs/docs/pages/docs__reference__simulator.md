# Simulator | Documentation

Source: https://hub.evenrealities.com/docs/reference/simulator

[Skip to content](#VPContent)

[![](/docs/imgs/icon.svg)Documentation](/docs/getting-started/overview)

Search`⌘``Ctrl``K`

 Main Navigation [Portal](https://evenhub.evenrealities.com)

Menu

On this page

 Sidebar Navigation 

## Getting-started

[Overview](/docs/getting-started/overview)

[Installation](/docs/getting-started/installation)

[Your First App](/docs/getting-started/first-app)

[Architecture](/docs/getting-started/architecture)

## Guides

[Page Lifecycle](/docs/guides/page-lifecycle)

[Input & Events](/docs/guides/input-events)

[Display & UI System](/docs/guides/display)

[Device APIs](/docs/guides/device-apis)

[UI/UX Design Guidelines](/docs/guides/design-guidelines)

[Networking](/docs/guides/networking)

[Headless Testing](/docs/guides/headless-testing)

## AI-tooling

[### Claude Code](/docs/AI-tooling/claude%20code/index)

[Skill Catalog](/docs/AI-tooling/claude%20code/skill-catalog)

## Reference

[Simulator](/docs/reference/simulator)

[Packaging & Deployment](/docs/reference/packaging)

[CLI](/docs/reference/cli)

[App Submission & QA Guidelines](/docs/reference/app-submission)

## Community

[Community Resources](/docs/community/resources)

On this page

* [Installation](#installation "Installation")
* [Usage](#usage "Usage")
* [Options](#options "Options")
* [Default Config File Paths](#default-config-file-paths "Default Config File Paths")
* [Audio](#audio "Audio")
* [Screenshot (v0.5.0+)](#screenshot "Screenshot (v0.5.0+)")
* [Headless Automation (v0.7.0+)](#headless-automation "Headless Automation (v0.7.0+)")
* [Caveats](#caveats "Caveats")

The simulator (`v0.7.2`) lets you preview UI layouts and test logic without physical hardware. It is a supplement to — not a replacement for — hardware testing.

## Installation [​](#installation)

bash

```
npm install -g @evenrealities/evenhub-simulator
```

> **npm:** [@evenrealities/evenhub-simulator](https://www.npmjs.com/package/@evenrealities/evenhub-simulator) — cross-platform (macOS, Linux, Windows)

## Usage [​](#usage)

bash

```
evenhub-simulator [OPTIONS] [targetUrl]
```

## Options [​](#options)

| Option | Description |
| --- | --- |
| `-c`, `--config <path>` | Path to config file (use `--print-config-path` to see the default) |
| `-g`, `--glow` | Enable glow effect on glasses display |
| `--no-glow` | Disable glow effect (overrides config) |
| `-b`, `--bounce <type>` | Bounce animation type: `default` or `spring` |
| `--list-audio-input-devices` | List available audio input devices |
| `--aid <device>` | Choose a specific audio input device |
| `--no-aid` | Use default audio device (overrides config) |
| `--print-config-path` | Print the default config file path and exit |
| `--completions <shell>` | Generate shell completions: `bash`, `elvish`, `fish`, `powershell`, `zsh` |
| `-V`, `--version` | Print version |
| `-h`, `--help` | Print help |

## Default Config File Paths [​](#default-config-file-paths)

| Platform | Location |
| --- | --- |
| Linux | `$XDG_CONFIG_HOME` or `$HOME/.config` |
| macOS | `$HOME/Library/Application Support` |
| Windows | `{FOLDERID_RoamingAppData}` (e.g., `C:\Users\<user>\AppData\Roaming`) |

## Audio [​](#audio)

The simulator emits `audioEvents` with the following specification:

* Sample rate: 16,000 Hz
* Format: signed 16-bit little-endian PCM
* 100ms of data per event (3,200 bytes / 1,600 samples)

## Screenshot (v0.5.0+) [​](#screenshot)

The simulator supports exporting the glasses display as an RGBA PNG file. Upon clicking the screenshot button, it exports to your current working directory with a timestamp-based filename. The file path is logged to both the simulator stdout and the glasses web inspector console.

The screenshot is not affected by the glow flag — that is a visual post-processing effect only.

## Headless Automation (v0.7.0+) [​](#headless-automation)

Simulator `0.7.x` ships a full HTTP control plane. Start the simulator with `--automation-port` to expose it:

bash

```
evenhub-simulator <url> --automation-port 9898
# → control plane on http://127.0.0.1:9898
```

Use it to drive the simulator from CI, test harnesses, or any scripting language that can speak HTTP.

### Endpoints [​](#endpoints)

| Endpoint | Purpose |
| --- | --- |
| `GET /api/ping` | Health check → returns `pong`. |
| `GET /api/screenshot/glasses` | 576×288 **RGBA** PNG of the LVGL framebuffer. Keep RGBA — converting to RGB fuses background and text (both pure green). Use `alpha > 0` as the lit-pixel test. |
| `GET /api/screenshot/webview` | PNG of the host webview, captured via `html2canvas` (10 s timeout). |
| `GET /api/console[?since_id=N]` | Returns `{ entries, total }`. Captures `console.`\*, uncaught exceptions, unhandled rejections, and failed `fetch` calls. Use `since_id` for incremental polling. |
| `DELETE /api/console` | Clears the buffer. Read startup logs **before** clearing — they are emitted once and lost if you clear too early. |
| `POST /api/input` body: `{ "action": "up | down |

### Tips [​](#tips)

* **Screenshot polling:** the LVGL framebuffer is RGBA. Treat any pixel with `alpha > 0` as lit — comparing RGB channels alone collapses background and foreground because both are pure green.
* **Console buffer:** poll `/api/console?since_id=N` and bump `N` to the last `entries[i].id` you received. This avoids re-processing entries you've already seen.
* **Input warm-up:** the simulator silently drops input until the first event-capturing container exists. After boot, wait for an `app-ready` log (or your own readiness signal) before issuing `POST /api/input`.

For an end-to-end walkthrough — boot the simulator, wait for ready, screenshot, send a `double_click`, and assert the system exit dialog — see the [Headless Testing guide](/docs/guides/headless-testing).

## Caveats [​](#caveats)

* **Display rendering** may not perfectly match hardware (font rendering, greyscale levels). Sufficient for layout validation and logic testing.
* **List scrolling** behavior (focused-item positioning) can differ from real glasses.
* **Image processing** is faster and does not enforce hardware size limits.
* **Events:** Status events are not emitted (user/device profiles are hardcoded). Supported inputs: Up, Down, Click, Double Click.
* **Error handling** may differ from hardware under abnormal conditions.

Always validate on actual hardware before deployment. If you find discrepancies that affect logic, please file a bug report in the [Discord](https://discord.gg/Y4jHMCU4sv).

Pager

[Previous pageSkill Catalog](/docs/AI-tooling/claude%20code/skill-catalog)

[Next pagePackaging & Deployment](/docs/reference/packaging)