# Claude Code | Documentation

Source: https://hub.evenrealities.com/docs/AI-tooling/claude%20code/index

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

* [What is this?](#what-is-this "What is this?")
* [Install](#install "Install")
* [Try it](#try-it "Try it")
* [How it works](#how-it-works "How it works")

everything-evenhub is an open-source plugin for Claude Code that teaches Claude everything it needs to know about building Even G2 smart glasses apps — SDK APIs, display constraints, the simulator, packaging, and more. Install it once, then describe what you want to build in plain English.

> **Already using Claude Code?** Jump to [Install](#install) ↓

## What is this? [​](#what-is-this)

Claude Code is Anthropic's command-line AI coding tool. Instead of copy-pasting prompts into a chat window, Claude runs inside your terminal, reads your files, writes code, and runs commands for you. It's free to try, and works with the same Claude account you may already use. For more information, visit [claude.com/claude-code](https://claude.com/claude-code).

Out of the box, Claude Code doesn't know anything specific about the Even G2 platform. Our plugin adds 13 skills that cover the full development lifecycle:

| Tier | Skills | Purpose |
| --- | --- | --- |
| **Tier 1 — One-click** | `quickstart`, `template`, `build-and-deploy` | Scaffold a new app; package and publish |
| **Tier 2 — Core dev** | `glasses-ui`, `handle-input`, `device-features`, `background-state`, `test-with-simulator`, `simulator-automation`, `font-measurement` | Day-to-day coding tasks |
| **Tier 3 — Reference** | `sdk-reference`, `cli-reference`, `design-guidelines` | Look-up / deep-dive |

## Install [​](#install)

1. Install Claude Code — see [claude.com/claude-code](https://claude.com/claude-code)
2. In your terminal, add the marketplace:

   bash

   ```
   /plugin marketplace add even-realities/everything-evenhub
   ```
3. Install the plugin:

   bash

   ```
   /plugin install everything-evenhub
   ```

That's it — Claude will discover and invoke the skills on its own whenever you describe an Even G2-related task.

## Try it [​](#try-it)

In Claude Code, try:

> Build me a hello-world app for the Even G2 glasses that shows "Hello, Even!" on the display.

Claude will recognize the request, invoke the `quickstart` skill, scaffold the project, and walk you through running it in the simulator.

## How it works [​](#how-it-works)

You don't need to "teach" Claude about the skills or memorize skill names. Each skill is a markdown file with a short description; Claude reads those descriptions and automatically picks the right skill for whatever you ask. Behind the scenes it's pulling from the same SDK docs and design guidelines you'll find elsewhere on this site — just routed through Claude's context.

Pager

[Previous pageHeadless Testing](/docs/guides/headless-testing)

[Next pageSkill Catalog](/docs/AI-tooling/claude%20code/skill-catalog)