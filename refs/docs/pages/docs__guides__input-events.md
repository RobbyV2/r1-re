# Input & Events | Documentation

Source: https://hub.evenrealities.com/docs/guides/input-events

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

* [Input Sources](#input-sources "Input Sources")
* [Event Types](#event-types "Event Types")
* [Handling Events](#handling-events "Handling Events")
* [Event Routing](#event-routing "Event Routing")
* [Lifecycle Events](#lifecycle-events "Lifecycle Events")

Input on Even G2 reaches your web app as structured events from the temple touchpads, optional Even R1 ring, IMU, and app lifecycle hooks. This guide explains the sources, numeric event codes, and how to reason about gestures when designing interactions.

## Input Sources [​](#input-sources)

The Even G2 glasses, optional Even R1 ring, and IMU sensors each provide distinct input:

| Source | Gestures / Data | Notes |
| --- | --- | --- |
| **Even G2 touchpads** (temple) | Press, double press, swipe up, swipe down | Primary input on the glasses frame |
| **Even R1 touchpads** (ring) | Press, double press, swipe up, swipe down | Same gesture set as Even G2, but events are distinguishable by source |
| **IMU** (accelerometer / gyroscope) | Head orientation, motion data | Available for motion-aware apps — see [IMU API](/docs/guides/device-apis#imu) |

Even G2 and Even R1 touchpad events share the same event types but can now be distinguished by their input source, allowing apps to assign different behaviors to glasses vs. ring input.

## Event Types [​](#event-types)

| Event | Value | Description |
| --- | --- | --- |
| `CLICK_EVENT` | 0 | Single press (Even G2 or Even R1) |
| `SCROLL_TOP_EVENT` | 1 | Swipe up / scroll reaches top boundary |
| `SCROLL_BOTTOM_EVENT` | 2 | Swipe down / scroll reaches bottom boundary |
| `DOUBLE_CLICK_EVENT` | 3 | Double press (Even G2 or Even R1) |
| `FOREGROUND_ENTER_EVENT` | 4 | App comes to foreground |
| `FOREGROUND_EXIT_EVENT` | 5 | App goes to background |
| `ABNORMAL_EXIT_EVENT` | 6 | Unexpected disconnect |

## Handling Events [​](#handling-events)

typescript

```
bridge.onEvenHubEvent(event => {
  const textEvent = event.textEvent
  if (textEvent) {
    const eventType = textEvent.eventType

    switch (eventType) {
      case OsEventTypeList.CLICK_EVENT:
      case undefined: // SDK normalizes 0 to undefined in some cases
        // Handle press
        break
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        // Handle double press
        break
      case OsEventTypeList.SCROLL_TOP_EVENT:
        // Handle swipe up / scroll up
        break
      case OsEventTypeList.SCROLL_BOTTOM_EVENT:
        // Handle swipe down / scroll down
        break
    }
  }
})
```

## Event Routing [​](#event-routing)

Event delivery depends on which container has `isEventCapture: 1`:

| Capture container type | Events arrive as |
| --- | --- |
| **Text container** | `event.textEvent` |
| **List container** | `event.listEvent` |

Only **one** container per page can capture events. Design your interaction model around a single active input target.

## Lifecycle Events [​](#lifecycle-events)

Your app receives lifecycle events when its visibility changes:

* **`FOREGROUND_ENTER_EVENT`** — the user has opened or returned to your app. Use this to resume updates or refresh data.
* **`FOREGROUND_EXIT_EVENT`** — your app has moved to the background. Pause any timers or ongoing work.
* **`ABNORMAL_EXIT_EVENT`** — the Bluetooth connection was lost unexpectedly.

Pager

[Previous pagePage Lifecycle](/docs/guides/page-lifecycle)

[Next pageDisplay & UI System](/docs/guides/display)