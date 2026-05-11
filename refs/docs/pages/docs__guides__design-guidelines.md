# UI/UX Design Guidelines | Documentation

Source: https://hub.evenrealities.com/docs/guides/design-guidelines

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

* [Display Constraints](#display-constraints "Display Constraints")
* [Designing Icons](#designing-icons "Designing Icons")
* [Common UI Patterns](#common-ui-patterns "Common UI Patterns")

Even Realities publishes official software design guidelines covering layout principles, component patterns, interaction models, and visual standards for the glasses display and companion app screens.

**[View the Design Guidelines in Figma →](https://www.figma.com/design/X82y5uJvqMH95jgOfmV34j/Even-Realities---Software-Design-Guidelines--Public-?node-id=2922-80782&t=r9P3fmZ2C2glMlQ9-1)**

## Display Constraints [​](#display-constraints)

When designing for the Even G2 display, keep in mind:

* **576 x 288 px** — this is a very small canvas. Every pixel matters.
* **4-bit greyscale** — design in shades of grey; the hardware renders them as shades of green.
* **No background fill** — you can only use borders and text/image content for visual structure.
* **Max 4 image containers, 8 other containers** — plan your layout within this constraint.
* **One event-capturing container** — design your interaction model around a single active input target.

## Designing Icons [​](#designing-icons)

When creating icons for the glasses display, follow these principles:

* **Design at native resolution** — work at the actual pixel size (e.g., 24x24). Avoid designing large and scaling down.
* **Keep it simple** — Aim for immediately recognizable silhouettes with minimal internal detail.
* **Test on hardware** — the green-tinted greyscale rendering on the glasses differs from your monitor. Always verify icon legibility on the actual display or simulator with glow enabled.

## Common UI Patterns [​](#common-ui-patterns)

| Pattern | How |
| --- | --- |
| Fake buttons | Prefix text with `>` as a cursor indicator |
| Selection highlight | Toggle `borderWidth` on individual text containers |
| Multi-row layout | Stack multiple text containers vertically (e.g., 3 containers at 96px height) |
| Progress bars | Use Unicode block characters: `━` and `─` |
| Page flipping | Pre-paginate text at ~400–500 character boundaries, rebuild on scroll events |

Pager

[Previous pageDevice APIs](/docs/guides/device-apis)

[Next pageNetworking](/docs/guides/networking)