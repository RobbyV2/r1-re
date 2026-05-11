# Device APIs | Documentation

Source: https://hub.evenrealities.com/docs/guides/device-apis

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

* [Audio](#audio "Audio")
* [IMU](#imu "IMU")
* [Device Info](#device-info "Device Info")
* [User Info](#user-info "User Info")
* [Local Storage](#local-storage "Local Storage")
* [OS Event Models](#os-event-models "OS Event Models")
* [SDK Reference Documentation](#sdk-reference-documentation "SDK Reference Documentation")
* [What the SDK Does NOT Expose](#what-the-sdk-does-not-expose "What the SDK Does NOT Expose")

Beyond drawing and touch handling, the bridge exposes microphone capture, IMU motion streams, device metadata, user profile helpers, and scoped storage. This reference shows how to enable each capability and interpret the asynchronous payloads your handlers receive.

## Audio [​](#audio)

typescript

```
// Start/stop microphone capture
await bridge.audioControl(true) // start
await bridge.audioControl(false) // stop
```

Audio data arrives via `audioEvent` in the event callback. Format: PCM 16kHz, signed 16-bit little-endian, mono.

## IMU [​](#imu)

The Even G2 glasses contain an IMU (inertial measurement unit). Use `imuControl` to start and stop motion data streaming.

typescript

```
import { waitForEvenAppBridge, ImuReportPace, OsEventTypeList } from '@evenrealities/even_hub_sdk'

const bridge = await waitForEvenAppBridge()

// Start IMU reporting
await bridge.imuControl(true, ImuReportPace.P500)

// Listen for IMU data
const unsubscribe = bridge.onEvenHubEvent(event => {
  const sys = event.sysEvent
  if (!sys?.imuData) return
  if (sys.eventType !== OsEventTypeList.IMU_DATA_REPORT) return

  const { x, y, z } = sys.imuData
  console.log('IMU:', x, y, z)
})

// Stop IMU reporting
await bridge.imuControl(false)
unsubscribe()
```

### `imuControl(isOpen, reportFrq)` [​](#imucontrol-isopen-reportfrq)

| Parameter | Type | Description |
| --- | --- | --- |
| `isOpen` | boolean | `true` to start, `false` to stop |
| `reportFrq` | `ImuReportPace` | Pacing code for report frequency (optional when stopping — defaults to `P100`) |

### `ImuReportPace` [​](#imureportpace)

The `reportFrq` parameter accepts one of the following pacing codes:

| Value | Constant |
| --- | --- |
| 100 | `ImuReportPace.P100` |
| 200 | `ImuReportPace.P200` |
| 300 | `ImuReportPace.P300` |
| 400 | `ImuReportPace.P400` |
| 500 | `ImuReportPace.P500` |
| 600 | `ImuReportPace.P600` |
| 700 | `ImuReportPace.P700` |
| 800 | `ImuReportPace.P800` |
| 900 | `ImuReportPace.P900` |
| 1000 | `ImuReportPace.P1000` |

These are protocol pacing codes, not literal Hz values.

### IMU Data Shape [​](#imu-data-shape)

IMU samples arrive as `Sys_ItemEvent` through the `sysEvent` field of `onEvenHubEvent`. Each sample contains:

| Field | Type | Description |
| --- | --- | --- |
| `eventType` | `OsEventTypeList` | `IMU_DATA_REPORT` for IMU samples |
| `imuData.x` | float | X-axis value |
| `imuData.y` | float | Y-axis value |
| `imuData.z` | float | Z-axis value |

The `imuData` field is an `IMU_Report_Data` protobuf message. Data pushes continuously after `imuControl(true, ...)` until stopped with `imuControl(false)`.

## Device Info [​](#device-info)

typescript

```
const info = await bridge.getDeviceInfo()
// Returns: model (G1/G2/Ring1), serial number, battery, wearing status, charging, in-case
```

Real-time monitoring:

typescript

```
bridge.onDeviceStatusChanged(status => {
  // Battery, wearing, charging updates
})
```

## User Info [​](#user-info)

typescript

```
const user = await bridge.getUserInfo()
// Returns: uid, name, avatar, country
```

## Local Storage [​](#local-storage)

typescript

```
await bridge.setLocalStorage('key', 'value')
const value = await bridge.getLocalStorage('key')
```

## OS Event Models [​](#os-event-models)

The SDK exposes the following models for OS→App events:

| Model | Description |
| --- | --- |
| `Text_ItemEvent` | Text container event |
| `List_ItemEvent` | List container event |
| `Sys_ItemEvent` | System event — carries `eventType`, `eventSource`, `imuData`, `systemExitReasonCode` |
| `IMU_Report_Data` | IMU sample payload (`x`, `y`, `z` floats) inside `Sys_ItemEvent.imuData` |
| `OsEventTypeList` | Event type enum — includes `CLICK_EVENT`, `DOUBLE_CLICK_EVENT`, `SCROLL_TOP_EVENT`, `SCROLL_BOTTOM_EVENT`, `FOREGROUND_ENTER_EVENT`, `FOREGROUND_EXIT_EVENT`, `ABNORMAL_EXIT_EVENT`, `SYSTEM_EXIT_EVENT`, `IMU_DATA_REPORT` |
| `ImuCtrlCmd` / `ImuCtrlCmdResponse` | Protobuf command/response maps used internally by `imuControl` |

## SDK Reference Documentation [​](#sdk-reference-documentation)

For the full API surface — including all method signatures, parameter types, return values, and event payloads — refer to the official SDK package documentation:

> **npm:** [@evenrealities/even\_hub\_sdk](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)

The SDK TypeScript definitions (`*.d.ts` files) in the package serve as the authoritative reference for all available methods and types.

## What the SDK Does NOT Expose [​](#what-the-sdk-does-not-expose)

No direct Bluetooth access, no arbitrary pixel drawing, no audio output, no text alignment, no font control, no background colors, no per-item list styling, no programmatic scroll position, no animations, no camera (there is none), and images are greyscale only.

Pager

[Previous pageDisplay & UI System](/docs/guides/display)

[Next pageUI/UX Design Guidelines](/docs/guides/design-guidelines)