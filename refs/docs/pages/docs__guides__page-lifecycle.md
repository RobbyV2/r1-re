# Page Lifecycle | Documentation

Source: https://hub.evenrealities.com/docs/guides/page-lifecycle

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

* [Methods](#methods "Methods")
* [Result Codes](#result-codes "Result Codes")
* [Best Practices](#best-practices "Best Practices")

Every glasses screen flows through a small set of SDK calls for creation, incremental updates, full rebuilds, and shutdown. The sections below summarize each method, its return contract, and practical guidance for keeping animations smooth on real hardware.

## Methods [​](#methods)

| Method | Purpose | Notes |
| --- | --- | --- |
| `createStartUpPageContainer` | Create the initial page | Called exactly once at startup. Returns result code. |
| `rebuildPageContainer` | Replace the entire page | Full redraw — all state is lost, brief flicker on hardware. |
| `textContainerUpgrade` | Update text in-place | Faster, flicker-free on hardware. Requires matching `containerID` + `containerName`. |
| `updateImageRawData` | Update an image container | No concurrent sends allowed. |
| `shutDownPageContainer` | Exit the app | Pass `0` for immediate exit, `1` for exit confirmation dialog. |
| `callEvenApp` | Generic method call | Escape hatch — all typed methods are wrappers around this. |

## Result Codes [​](#result-codes)

For `createStartUpPageContainer`:

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Invalid parameters |
| 2 | Oversize |
| 3 | Out of memory |

`rebuildPageContainer`, `textContainerUpgrade`, and `shutDownPageContainer` return `boolean`.

`updateImageRawData` returns a status string: `success`, `imageException`, `imageSizeInvalid`, `imageToGray4Failed`, or `sendFailed`.

## Best Practices [​](#best-practices)

* Use `textContainerUpgrade` for frequent text updates (counters, status, live data) — it avoids the flicker of a full rebuild.
* Use `rebuildPageContainer` when changing the container layout (adding/removing containers, switching between text and list).
* Always match `containerID` and `containerName` exactly when using `textContainerUpgrade`.
* Do not call `updateImageRawData` concurrently — wait for one to complete before sending the next.

Pager

[Previous pageArchitecture](/docs/getting-started/architecture)

[Next pageInput & Events](/docs/guides/input-events)