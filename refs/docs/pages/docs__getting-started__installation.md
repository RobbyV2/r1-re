# Installation | Documentation

Source: https://hub.evenrealities.com/docs/getting-started/installation

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

* [Prerequisites](#prerequisites "Prerequisites")
* [Install the SDK](#install-the-sdk "Install the SDK")
* [Install the Simulator](#install-the-simulator "Install the Simulator")
* [Install the CLI](#install-the-cli "Install the CLI")

> **Last updated:** 2026-04-22

This page walks you through the tooling you need on your machine — the Even Hub SDK, simulator, and CLI — plus the hardware (or simulator) you will use to exercise Even G2 apps end to end.

## Prerequisites [​](#prerequisites)

* **Node.js** — **v20 LTS** or **v22+** (the SDK declares `engines.node = "^20.0.0 || >=22.0.0"`; **Node 18 is not supported**)
* A web framework of your choice (Vite recommended)
* A phone with the **Even Realities App** installed (for hardware testing)
* **Even G2 glasses** (for hardware testing; the simulator covers early development)
* **Even R1 ring** (optional — provides additional touchpad input)

## Install the SDK [​](#install-the-sdk)

bash

```
npm install @evenrealities/even_hub_sdk
```

Current version: **0.0.10** (published 2026-04-10). The SDK provides typed methods for display control, input handling, audio, device info, and local storage. Update your `app.json` `min_sdk_version` examples to `"0.0.10"` accordingly.

> **npm:** [@evenrealities/even\_hub\_sdk](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)

## Install the Simulator [​](#install-the-simulator)

The simulator lets you preview UI layouts and test logic without physical hardware. It is a supplement to — not a replacement for — hardware testing.

bash

```
npm install -g @evenrealities/evenhub-simulator
```

Current version: **0.7.2** (published 2026-04-15). Cross-platform (macOS, Linux, Windows).

> **npm:** [@evenrealities/evenhub-simulator](https://www.npmjs.com/package/@evenrealities/evenhub-simulator)

See the full [Simulator Reference](/docs/reference/simulator) for options and caveats.

## Install the CLI [​](#install-the-cli)

The CLI handles authentication, QR sideloading, and app packaging. The package ships an `evenhub` binary (and a shorter `eh` alias), so global installation is recommended:

bash

```
npm install -g @evenrealities/evenhub-cli
```

Alternative — pin the version per-repo:

bash

```
npm install -D @evenrealities/evenhub-cli
```

Current version: **0.1.12** (published 2026-04-16).

> **npm:** [@evenrealities/evenhub-cli](https://www.npmjs.com/package/@evenrealities/evenhub-cli)

See the full [CLI Reference](/docs/reference/cli) for all commands, and [Packaging & Deployment](/docs/reference/packaging) for the complete `app.json` schema and troubleshooting guide.

Pager

[Previous pageOverview](/docs/getting-started/overview)

[Next pageYour First App](/docs/getting-started/first-app)