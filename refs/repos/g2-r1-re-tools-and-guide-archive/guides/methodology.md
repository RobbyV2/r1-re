# Methodology: deep code tracing

How to trace something you don't understand — whether it's a decompiled
binary, a captured packet stream, or an opaque API.

The single dominant failure mode of LLM agents doing RE is: **grep once,
don't find it, give up.** The answer is almost always 2–3 hops away from
the obvious search term. This document is about making those hops.

## Core loop

1. **Anchor on something concrete.** A string literal, an exported symbol,
   a BLE characteristic UUID, an HTTP path, an error message. Something
   you can `grep -r` for and get a small number of hits.
2. **Follow references both directions.** Where is it READ? Where is it
   WRITTEN / SET? Where is it CALLED? Where is it DEFINED? The call graph
   is bidirectional, and callers usually carry more context than callees.
3. **Build a mental object graph.** In decompiled code especially, track
   which field offsets load which values, which classes own which
   subsystems, which enums map to which numeric dispatch targets.
4. **Verify against live behavior.** Your trace is a hypothesis. Confirm
   it with a capture, a probe, a print statement. Do not build on an
   unverified trace.
5. **Document what you found as you go.** If you don't, you will forget
   the field offset within an hour.

## Anchoring

The best anchors, in rough order of quality:

- **String literals.** Almost never obfuscated. `"audioManager-cmd"` and
  `"decodeLc3"` are gold. They tell you the intent of the surrounding
  code before you've read a byte of it.
- **Error messages** — same property as literals, but usually near a
  branch or a validation, which is where the interesting logic lives.
- **BLE/USB UUIDs**, characteristic handles, service IDs — if the target
  is a BLE device, the app's binary contains these as literals.
- **Well-known constants** — AES block sizes, CRC polynomials (`0x1021`,
  `0x8005`), magic numbers (`0xAA`, `0xDEAD`), TCP port numbers.
- **Exported symbols** — class names, method names, field names from the
  decompiler's type information (if any survived).
- **Capture timing patterns** — if you see a packet every 10s, it's
  almost certainly a heartbeat. If you see a burst followed by silence,
  it's almost certainly a fragmented message.

What makes a bad anchor: generic words like "data", "message", "send".
Thousands of hits, zero signal.

## Following references in Blutter-decompiled Dart

[Blutter](https://github.com/worawit/blutter) dumps Flutter AOT binaries
into ARM64 pseudo-asm with Dart object field annotations. Two patterns
to watch for:

```
LoadField: r0 = r1->field_8f    ; field 0x8f of the object in r1 is loaded into r0
StoreField: r1->field_8f = r0   ; field 0x8f of the object in r1 is set to r0
```

These are the only way to follow **data flow** through the call graph.
A function that takes a `BleG2CmdService` and ends up calling
`field_8f.value =` has just told you where a notifier is wired. Grep
for `StoreField.*field_8f` across the dump to find all writers, then
`LoadField.*field_8f` for all readers.

A typical trace runs like this (real G2 example, hunting for where
audio data arrives):

```
Entry: ProtoAudioExt.micPcmDataStream()
  → loads field_8f
  → calls .stream()

Question: What sets field_8f?
Search: StoreField.*field_8f
Found: BleG2CmdService line 12286 stores RxNotifier into field_8f

Question: Where does that notifier get its value set?
Search: value=() calls downstream of decodeLc3
Found: _handleStreamResponse decodes LC3 and sets value on the notifier

Question: When is _handleStreamResponse called?
Found: When BleG2PsType field_b == 2 (stream service type)

Question: Which BLE service has type == 2?
Search: StoreField.*field_13 = 2  (or look for constructor with literal 2)
Found: Service 6450 is constructed with field_13=2 in init code

Conclusion: audio arrives on service 6450 (not 7450, as initially guessed)
```

Every step was 1–3 `grep`s. Every step was bidirectional (caller or writer,
not just reader). Every step was anchored on either a string ("decodeLc3"),
a type name, or a field offset from the previous hop.

## Mapping enums to dispatch

Decompiled switch statements usually look like this:

```
cmp x1, #2
b.eq loc_handle_stream
cmp x1, #3
b.eq loc_handle_image
cmp x1, #7
b.eq loc_handle_text
```

This is a protocol dispatch. `x1` holds the command code. The constants
(`2`, `3`, `7`) are your enum values. Three things you should immediately
do when you see this:

1. Dump **every** `cmp x1, #N` hit and build a table. These are your
   command codes.
2. Look for where `x1` was set — the constant comes from a protobuf
   field, a struct offset, or a parse function. That's where the wire
   format of the command code lives.
3. Find the **inverse** dispatch (sender-side). If there's a handler for
   cmd=3, there's a builder for cmd=3 somewhere that stuffs `3` into
   the same field. That builder is usually a cleaner read than the
   handler.

## Three-hop rule

If you searched for something obvious and didn't find it, the answer is
usually exactly two or three field-dereferences away. You should almost
never give up after one search. Concretely:

- Search for the string → find the function that prints/logs it
- Search for that function → find its callers
- Search for the fields those callers load → find the state that
  triggered the log line

If after three hops you're still lost, step back and **pick a different
anchor**. Don't keep grinding the same search term.

## Verifying against live behavior

Traces lie. They lie because:

- Dead code: the function you found might never be called in practice.
- Feature-flagged code: the function is called only under a specific
  firmware mode you're not in.
- Stale decompilation: the APK version you decompiled is different from
  the firmware your device is running.
- Optimizer inlining: what you think is a separate handler might have
  been merged into its caller.

Before building on a hypothesis, confirm it:

- Run a **passive listener** (see `guides/passive-listener-first.md`)
  and see if the packets you expect actually show up.
- Write a **probe** that sends the minimum thing you think should
  work, and see what happens.
- Diff **before/after captures** around a state change you can trigger
  on the device (button press, screen wake, notification).

A trace plus a confirming capture is a fact. A trace alone is a guess.

## Notes that survive

During a trace, write notes in a single markdown file. Don't trust your
memory. A typical note block looks like:

```
2026-04-14 — hunting where audio PCM arrives
- anchor: "decodeLc3" string in blutter dump
- hit: lib/ble/even_connect/bleg2cmdservice.dart:12286
- field_8f on BleG2CmdService = RxNotifier<Uint8List> for audio frames
- assignment: _handleStreamResponse inside the same class
- trigger: BleG2PsType.field_b == 2 → stream service
- service 6450 has field_13==2, service 7450 has field_13==0
- CONCLUSION: audio = service 6450 (UNVERIFIED — need capture to confirm)
- next: write g2-listen.ts that subscribes to 6450 and dumps inbound
```

Later, after verifying, add:

```
2026-04-14 23:40 — verified. g2-listen.ts shows 20 ms audio bursts on
  service 6450 during wakeword. Service 7450 silent. Trace correct.
```

That note is worth more than the trace itself, because the next time you
touch this code (or the next time an agent does) you can start from the
conclusion instead of the hunt.

## What NOT to do

- **Don't read the whole binary.** You will drown. Anchor, trace, verify.
- **Don't trust comments/strings about "TODO" or "deprecated".** They're
  often current code that was once-upon-a-time deprecated.
- **Don't write the probe in the target's language.** The target has
  opinions. Write the probe in whatever you're fastest in (Python, Bun,
  whatever). Interop is just bytes.
- **Don't optimize before you understand.** Get a working end-to-end
  path first. Performance lives in a different PR.
- **Don't assume symmetry.** Many protocols have very different
  structures for request vs response, phone→device vs device→phone,
  L-arm vs R-arm (when there are two peers), etc.
