# Skill Catalog | Documentation

Source: https://hub.evenrealities.com/docs/AI-tooling/claude%20code/skill-catalog

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

* [Full Skill Catalog](#full-skill-catalog "Full Skill Catalog")
* [Harness testing](#harness-testing "Harness testing")

Use this page as a lookup table for each EvenHub Claude Code skill — what it automates, representative prompts, and how skills chain together. Pair it with the [Claude Code setup guide](./index) when you are installing or updating the plugin.

Skill definitions ship from the open-source [`even-realities/everything-evenhub`](https://github.com/even-realities/everything-evenhub) repository (`skills/` directory). This catalog mirrors that layout.

## Full Skill Catalog [​](#full-skill-catalog)

### Tier 1 — One-Click Skills [​](#tier-1-—-one-click-skills)

#### quickstart [​](#quickstart)

**Purpose:** Scaffold a **blank** Even G2 app from scratch (Vite + TypeScript + `@evenrealities/even_hub_sdk`).  
**Trigger example:** `/quickstart my-weather-app` or “Build me a new Even G2 app called stopwatch.”  
**What it does:** Creates a fresh Vite project and wires the SDK — not a curated example app.  
**Related:** → `template` (when you want a starter instead of blank), `build-and-deploy`, `glasses-ui`

#### template [​](#template)

**Purpose:** Scaffold from a **curated** starter in [`even-realities/evenhub-templates`](https://github.com/even-realities/evenhub-templates) via `degit` — wiring included.  
**Trigger example:** `/template my-reader --text-heavy`, `/template --asr my-transcription-app`, `/template --image photo-frame`, `/template --minimal hello-glasses`  
**What it does:** Pulls `minimal`, `asr`, `image`, or `text-heavy` template; normalizes flags (`--withasr`, `--reader`, etc.); renames `package.json` / `app.json`; runs `npm install`.  
**Related:** → `quickstart` (blank slate), `build-and-deploy`, `font-measurement` (for `text-heavy` pagination)

#### build-and-deploy [​](#build-and-deploy)

**Purpose:** Package and publish your app to Even Hub.  
**Trigger example:** `/build-and-deploy` or “Package my app and upload it to the dev portal.”  
**What it does:** Uses the Even Hub CLI to build the `.ehpk` and complete the deployment flow.  
**Related:** → `quickstart`, `template`, `cli-reference`

### Tier 2 — Core Development [​](#tier-2-—-core-development)

#### glasses-ui [​](#glasses-ui)

**Purpose:** Build glasses display UI — containers, text, images, lists — for the Even G2 screen.  
**Trigger example:** `/glasses-ui "show a 3-item menu with a title bar"`  
**What it does:** Layout and components tuned to Even G2 display constraints.  
**Related:** → `handle-input`, `font-measurement`, `design-guidelines`

#### handle-input [​](#handle-input)

**Purpose:** Handle touchpad gestures, ring input, and lifecycle-related events.  
**Trigger example:** `/handle-input "single press cycles screens, double press exits"`  
**What it does:** Wires listeners and handlers for supported inputs.  
**Related:** → `glasses-ui`, `background-state`

#### device-features [​](#device-features)

**Purpose:** Use hardware-facing capabilities — audio capture, IMU, device info, local storage, etc.  
**Trigger example:** `/device-features "toggle microphone recording on click"`  
**What it does:** Interfaces with the SDK for sensors, audio, and related APIs.  
**Related:** → `sdk-reference`

#### background-state [​](#background-state)

**Purpose:** Persist plugin state across phone background / foreground when the host uses headless WebView migration.  
**Trigger example:** `/background-state src/main.ts` or “My app resets when the phone comes back from background.”  
**What it does:** Analyzes code and inserts `setBackgroundState` + `onBackgroundRestore` from `@evenrealities/even_hub_sdk` so mutable state survives `__getStateSnapshot` / `__restoreState`.  
**Related:** → `sdk-reference`, `handle-input`

#### test-with-simulator [​](#test-with-simulator)

**Purpose:** Run and debug the app in the Even Hub Simulator.  
**Trigger example:** `/test-with-simulator "debug my app with glow effect"`  
**What it does:** Launches the local simulator workflow for the current project.  
**Related:** → `simulator-automation`

#### simulator-automation [​](#simulator-automation)

**Purpose:** Drive the simulator over its HTTP API — screenshots, input injection, console logs.  
**Trigger example:** `/simulator-automation "take a screenshot and verify text is displayed"`  
**What it does:** Automates simulator actions for repeatable checks.  
**Related:** → `test-with-simulator`

#### font-measurement [​](#font-measurement)

**Purpose:** Pixel-accurate text and list measurement aligned with LVGL firmware rendering.  
**Trigger example:** `/font-measurement "size a text container for a long paragraph with 8px padding"`  
**What it does:** Measurement utilities for layout that matches on-device text metrics.  
**Related:** → `glasses-ui`

### Tier 3 — Reference Skills [​](#tier-3-—-reference-skills)

#### sdk-reference [​](#sdk-reference)

**Purpose:** Look up Even Hub SDK APIs, types, and patterns.  
**Trigger example:** `/sdk-reference createStartUpPageContainer`  
**What it does:** Surfaces SDK documentation for the symbol or topic you name.  
**Related:** → `device-features`, `background-state`

#### cli-reference [​](#cli-reference)

**Purpose:** Look up Even Hub CLI commands and flags.  
**Trigger example:** `/cli-reference evenhub qr`  
**What it does:** Usage and examples for CLI tooling (`evenhub`, packaging, QR, etc.).  
**Related:** → `build-and-deploy`

#### design-guidelines [​](#design-guidelines)

**Purpose:** Even G2 display design constraints and UX best practices.  
**Trigger example:** `/design-guidelines settings screen with 5 options`  
**What it does:** Design specs and guidance for readable, consistent glasses UI.  
**Related:** → `glasses-ui`

## Harness testing [​](#harness-testing)

The plugin repo includes a **harness** runner to regression-test skills with an AI agent. Example:

bash

```
/harness quickstart
```

See [`harness/README.md`](https://github.com/even-realities/everything-evenhub/blob/main/harness/README.md) in the source repo for how to add tests for new skills.

Pager

[Previous pageClaude Code](/docs/AI-tooling/claude%20code/index)

[Next pageSimulator](/docs/reference/simulator)