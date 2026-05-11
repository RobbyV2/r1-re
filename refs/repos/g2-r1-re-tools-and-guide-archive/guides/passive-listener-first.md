# Build a passive listener before you build a sender

Of every lesson in this care package, this is the one that saved the
most time per hour invested. It is so easy to skip and so expensive to
skip that it gets its own document.

## The rule

When you approach a new BLE (or serial, or USB, or any request/response)
device, **do not write a sender first**. Write a listener. Connect,
subscribe to every notify endpoint, and log everything that comes in.
Do nothing else.

Run the listener while:

- the device is idle (20+ seconds)
- you interact with the device physically (button, tap, motion)
- the companion app is open and active
- the companion app is closed
- the device transitions state (sleep, charge, disconnect/reconnect)

Then read the log.

## Why

A listener is cheap (50 lines of code), safe (you cannot break anything
by reading), and returns a gigantic amount of information:

### 1. The envelope reveals itself

Every frame starts with the same 1–2 bytes (the magic). The next byte is
almost always a sequence counter. The next is almost always a length.
You can sketch the envelope from 10 seconds of heartbeats alone, before
you've even opened the decompiled binary.

### 2. Heartbeat patterns tell you the link model

If you see a frame every 1 second, that's a heartbeat. Every 10 seconds,
that's a keepalive. If you see bursts of 4–8 frames followed by silence,
you've found fragmentation. If you see paired request/ack frames with
matching sequence numbers, you've found the ack protocol.

You can distinguish these without ever sending a byte.

### 3. Async events show up unprompted

The G2 glasses send a small frame on `sid=0d cmd=1` every time a
UI container changes state. You would never discover this from the
decompiled app code alone — it's hidden inside an event bus, three
callbacks deep. A passive listener surfaces it in the first session.

This is where the listener earns its keep: **async events** from the
device are almost always the hardest thing to trace statically, and the
easiest thing to discover dynamically. User input (taps, button presses,
sensor events) is almost always an async notification. Those are the
features you actually want to build on.

### 4. Traffic asymmetry is visible

In any multi-peer device (two AR glasses arms, left+right earbuds, a
ring+watch pair), traffic is rarely symmetric. One peer is usually the
master and emits most of the async frames. The other peer is reactive.
A listener on both peers side-by-side shows this immediately.

On the G2 glasses specifically: the L arm is **silent** for async
notifications. Only the R arm emits spontaneous traffic. You could
spend a week reading decompiled code and never realize this. 30 seconds
of passive listening on both peers reveals it.

### 5. You can't corrupt the state machine

A sender-first approach is dangerous because you can lock the device
into a weird state. Common failure modes when sending before listening:

- You hold a session token from a previous connection and the device
  refuses new writes until you cycle power.
- You send a fragment-start without a fragment-end and the device's
  reassembly buffer is wedged.
- You increment a sequence counter out of band and the device drops
  every subsequent frame until reconnection.
- You trip a firmware safety check and the device enters an OTA-only
  mode.

A listener does none of these things. It's strictly read-only.

## What a listener looks like

The reference implementation is
[`examples/g2/g2-listen.ts`](../examples/g2/g2-listen.ts). Shape:

```typescript
// 1. Scan for the target device by name pattern
// 2. Connect to every peer you find (in the G2 case, both arms)
// 3. Discover services and characteristics
// 4. Subscribe to every notify characteristic
// 5. For each inbound frame:
//    - timestamp it
//    - dump raw hex
//    - pull a couple of fields (sid, flag, length) from known offsets
//    - print one line
// 6. Sleep for N seconds
// 7. Disconnect cleanly
```

That's it. Don't parse. Don't decode. Don't apply schemas. Just log.

The first version should fit on one screen. Upgrade incrementally:

- Add color-coding by sid once you have a few sid values memorized.
- Add a `--filter sid=0x80` flag when the log gets too noisy.
- Add decoding once you've pinned the envelope.

Do **not** build the listener into your sender code. Keep them as
separate files. You will run the listener concurrently with the sender
later, in a second terminal, to see your synthesized frames arrive.

## When you do need to send something

Sometimes the device is silent until it receives a "hello" frame
(app launch, session init, auth). In that case:

1. Capture what the companion app sends on startup.
2. Identify the **smallest** initial frame the app sends.
3. Include **that one frame only** as a "prelude" option in your
   listener. Gate it behind a flag (`--no-prelude` to skip).
4. Listen for what happens after.

The G2 listener has exactly this: a single replay of frame `f5872`
(the `sid=01 cmd=2` app-launch frame), and then passive listening. One
sent frame, unlocked a whole class of async events.

Keep the prelude exactly that minimal. Do not expand it into a full
handshake. The more you send, the more state you touch, and the less
certain you can be about which events are responses to your sends vs
spontaneous emissions from the device.

## When to graduate from passive

Once you can predict what async events will show up, it's time to write
a sender. Not before. "Predict" means:

- You know which sid each event type uses.
- You know the payload structure well enough to decode it as you log it.
- You know how often each event fires and under what conditions.

At this point, the listener's job becomes **regression detection**: you
run it in a side terminal while you develop the sender, and any time
your sender produces an unexpected inbound frame (an error, an ack you
didn't expect, silence where you expected an ack) the listener catches
it immediately.

This is the same discipline as writing tests before production code.
Listen before you speak.
