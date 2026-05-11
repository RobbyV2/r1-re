# Display & UI System | Documentation

Source: https://hub.evenrealities.com/docs/guides/display

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

* [Canvas](#canvas "Canvas")
* [Containers](#containers "Containers")
* [Text Containers](#text-containers "Text Containers")
* [List Containers](#list-containers "List Containers")
* [Image Containers](#image-containers "Image Containers")
* [Font & Unicode Support](#font-unicode-support "Font & Unicode Support")

The glasses do not render arbitrary HTML — they composite a fixed-resolution canvas from SDK container objects with explicit pixel layout. Read on for coordinate rules, greyscale limits, container caps, and the text, list, and image primitives you can combine on a single page.

## Canvas [​](#canvas)

Each eye displays a **576 x 288 pixel** canvas. Coordinate origin is at the top-left corner. X increases rightward, Y increases downward.

All colors are rendered as **4-bit greyscale** — 16 levels of green. White pixels appear as bright green; black pixels are off (transparent).

## Containers [​](#containers)

The UI is built from **containers** — rectangular regions positioned with absolute pixel coordinates. There is no CSS, no flexbox, no DOM.

**Rules:**

* Maximum **4 image containers** and **8 other containers** per page (mixed types allowed)
* Exactly **one** container must have `isEventCapture: 1` — this container receives all input events
* Containers can overlap; later containers draw on top
* No z-index control beyond declaration order

### Shared Properties [​](#shared-properties)

| Property | Type | Range | Notes |
| --- | --- | --- | --- |
| `xPosition` | number | 0–576 | Left edge (px) |
| `yPosition` | number | 0–288 | Top edge (px) |
| `width` | number | 0–576 | Container width (px) |
| `height` | number | 0–288 | Container height (px) |
| `containerID` | number | — | Unique per page |
| `containerName` | string | max 16 chars | Unique per page |
| `isEventCapture` | number | 0 or 1 | Exactly one must be `1` |

### Border Properties [​](#border-properties)

Available on text and list containers only:

| Property | Type | Range | Notes |
| --- | --- | --- | --- |
| `borderWidth` | number | 0–5 | 0 = no border |
| `borderColor` | number | 0–15 / 0–16 | Greyscale level |
| `borderRadius` | number | 0–10 | Rounded corners (note: typo preserved from SDK protobuf) |
| `paddingLength` | number | 0–32 | Uniform padding on all sides |

> There is no background color or fill color property. The only visual decoration is the border.

## Text Containers [​](#text-containers)

The primary container type. Renders plain text, left-aligned, top-aligned. No text alignment options, no font size control, no bold/italic.

typescript

```
new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 1,
  containerName: 'main',
  content: 'Your text here',
  isEventCapture: 1,
})
```

### Content Limits [​](#content-limits)

| Method | Max Characters |
| --- | --- |
| `createStartUpPageContainer` | 1,000 |
| `textContainerUpgrade` | 2,000 |
| `rebuildPageContainer` | 1,000 |

### Behavior [​](#behavior)

* Text wraps at container width
* If content overflows and the container has `isEventCapture: 1`, the firmware handles internal scrolling
* `\n` works for line breaks
* Unicode characters are supported (within the firmware's font set)
* ~400–500 characters fill a full-screen text container
* To "center" text, manually pad with spaces

### In-Place Updates [​](#in-place-updates)

Use `textContainerUpgrade` — faster than a full page rebuild and flicker-free on hardware:

typescript

```
await bridge.textContainerUpgrade(containerID, containerName, newContent, contentOffset, contentLength)
```

## List Containers [​](#list-containers)

Native scrollable lists. The firmware handles scroll highlighting natively.

* Maximum **20 items** per list
* Maximum **64 characters** per item
* No custom styling per item, no item height control, no separator lines
* Cannot be updated in-place — must rebuild the entire page

## Image Containers [​](#image-containers)

Display greyscale images on the glasses.

* Width: 20–200 px, Height: 20–100 px
* 4-bit greyscale
* Accepts `number[]`, `Uint8Array`, `ArrayBuffer`, or base64
* **Cannot send during `createStartUpPageContainer`** — create a placeholder container, then update via `updateImageRawData`
* No concurrent image sends

**Image-based app pattern:** Use a full-screen text container (content: `' '`) with `isEventCapture: 1` behind the image container. The text container receives events; the image container draws on top.

## Font & Unicode Support [​](#font-unicode-support)

The glasses use a single LVGL font baked into firmware. No font selection, no font size control, not monospaced. Characters outside the font are silently skipped.

### Useful Characters for Building UIs [​](#useful-characters-for-building-uis)

| Use Case | Characters |
| --- | --- |
| Progress bars | `━` `─` `█▇▆▅▄▃▂▁` |
| Navigation | `▲△▶▷▼▽◀◁` |
| Selection | `●○` `■□` `★☆` |
| Borders | `╭╮╯╰` `│─` box drawing set |
| Card suits | `♠♣♥♦` |

Full supported glyph tables are available in the [community G2 notes](https://github.com/nickustinov/even-g2-notes/blob/main/G2.md).

Pager

[Previous pageInput & Events](/docs/guides/input-events)

[Next pageDevice APIs](/docs/guides/device-apis)