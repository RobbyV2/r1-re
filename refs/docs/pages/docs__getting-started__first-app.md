# Your First App | Documentation

Source: https://hub.evenrealities.com/docs/getting-started/first-app

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

* [Initialize the SDK](#initialize-the-sdk "Initialize the SDK")
* [Create a Page](#create-a-page "Create a Page")
* [Run It](#run-it "Run It")
* [Next Steps](#next-steps "Next Steps")

This walkthrough builds the smallest useful Even Hub plugin: connect to the app bridge, render a text page on the glasses, then run it in the simulator or on hardware using QR sideloading.

## Initialize the SDK [​](#initialize-the-sdk)

typescript

```
import { waitForEvenAppBridge, EvenAppBridge } from '@evenrealities/even_hub_sdk'

// Recommended: async wait — resolves when the bridge is ready
const bridge = await waitForEvenAppBridge()

// Alternative: synchronous singleton — only after bridge is initialized
const bridge = EvenAppBridge.getInstance()
```

## Create a Page [​](#create-a-page)

Display a simple text screen on the glasses:

typescript

```
import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
} from '@evenrealities/even_hub_sdk'

const bridge = await waitForEvenAppBridge()

const mainText = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 1,
  containerName: 'main',
  content: 'Hello from G2!',
  isEventCapture: 1,
})

const result = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 1,
    textObject: [mainText],
  }),
)
// result: 0 = success, 1 = invalid, 2 = oversize, 3 = out of memory
```

## Run It [​](#run-it)

### With the Simulator [​](#with-the-simulator)

bash

```
evenhub-simulator http://localhost:5173
```

No hardware needed — the simulator renders the glasses display on your screen.

### On Real Hardware [​](#on-real-hardware)

Generate a QR code pointing to your local dev server:

bash

```
evenhub qr --url "http://192.168.1.100:5173"
```

Scan it with the **Even Realities App** on your phone. Your app loads on the glasses with hot reload support.

## Next Steps [​](#next-steps)

* Learn about the [Display & UI System](/docs/guides/display) — containers, text, images, and fonts
* Understand [Input & Events](/docs/guides/input-events) — handling presses, swipes, and gestures
* Read the [Design Guidelines](/docs/guides/design-guidelines) for the 576x288 canvas

Pager

[Previous pageInstallation](/docs/getting-started/installation)

[Next pageArchitecture](/docs/getting-started/architecture)