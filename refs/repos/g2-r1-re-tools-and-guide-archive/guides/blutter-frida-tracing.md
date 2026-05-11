# Blutter & Frida: tracing decompiled Flutter/Dart binaries

The companion apps for most modern consumer wearables (smart glasses,
rings, earbuds, fitness trackers) are Flutter apps. Flutter compiles
Dart to ahead-of-time ARM64 machine code, wraps it in a stripped `.so`,
and ships it inside the APK. That means:

- **JADX won't help you.** The app's main logic is not Java/Kotlin.
- **The `.so` has no symbols.** Stripping is aggressive.
- **But Dart runtime data is preserved in the binary.** Every class,
  field, method, and string literal is there in an object pool that
  the Dart runtime indexes.

[Blutter](https://github.com/worawit/blutter) walks that object pool
and reconstructs a pseudo-assembly dump where every instruction is
annotated with the Dart type info it's manipulating. It is the single
biggest tool for RE'ing a Flutter-based companion app.

## Setup

```bash
git clone https://github.com/worawit/blutter
cd blutter
# Follow their setup — needs a specific Dart SDK version matching the
# target APK's Flutter version.

# Pull the target's libapp.so:
apktool d target.apk -o target_extracted
# libapp.so usually lives at lib/arm64-v8a/libapp.so

./blutter.py target_extracted/lib/arm64-v8a/libapp.so blutter_out
```

Output in `blutter_out/`:

- `asm/` — per-class `.dart` files with pseudo-Dart reconstructed
  from ARM64. Each method is a block of assembly annotated with Dart
  types.
- `blutter_frida.js` — a generated Frida script that can be injected
  into the running app to introspect live Dart objects.
- `ida_script/addNames.py` — an IDA Python script that renames
  functions in IDA Pro with their reconstructed Dart names.
- `objs.txt` — a dump of every Dart object in the pool, with
  addresses.

## Reading Blutter output

A typical function in `asm/package_name/some_file.dart` looks like
this:

```
// ProtoAudioExt.micPcmDataStream()
0x1234abcd  ldr x1, [x0, #0x478]    ; LoadField: r1 = r0->field_8f
0x1234abd0  ldr x2, [x1, #0x10]     ; r2 = r1->field_2
0x1234abd4  bl  0x1234cdef          ; [package:rxdart/rx.dart] ValueStream.stream()
0x1234abd8  ret
```

The comments are Blutter's annotations. `field_8f` is the Dart field
index (not byte offset — Blutter converts between them for you). The
`bl` targets are resolved to their `package:path/file.dart ClassName::methodName`
form when possible.

### The three essential greps

Given an entry point (e.g. "I want to know where audio arrives"),
these are the greps that unlock everything:

```bash
# 1. Find every READ of a field
grep -rn 'LoadField.*field_8f' blutter_out/asm/

# 2. Find every WRITE to a field
grep -rn 'StoreField.*field_8f' blutter_out/asm/

# 3. Find every CALLER of a function
grep -rn 'ClassName::methodName' blutter_out/asm/
```

That's the entire tracing toolkit. Nothing fancier needed.

### Anchoring in the dump

Strings survive Blutter intact. Grep for literal strings from the
companion app's UI or logs:

```bash
grep -rn '"decodeLc3"' blutter_out/asm/
grep -rn '"audioManager-cmd"' blutter_out/asm/
grep -rn '"BleG2PsType"' blutter_out/asm/
```

Any one of these hits gives you a file path + method name, which
gives you the class, which gives you the field layout, which gives
you more anchors. Three hops and you have a subsystem map.

### Strings-to-tree for a pre-Blutter view

Blutter takes 5–30 minutes to run on a large `libapp.so`. While it
runs, you can get an instant **navigable skeleton** of the app using
[`tools/strings_to_tree.py`](../tools/strings_to_tree.py):

```bash
strings -n 4 libapp.so > strings.txt
python3 tools/strings_to_tree.py strings.txt tree_out/
```

This walks the strings dump, spots every `package:foo/bar.dart`
reference, and groups the surrounding symbols into a directory tree
mirroring the Dart package layout. Each `.dart.txt` file contains
every symbol and string literal that was near that file's reference
in the rodata section — it's not a true decompile, but it's
navigable in two minutes instead of 20 and gives you a shape of the
app you can start grepping.

## Frida for live introspection

When Blutter gives you a static snapshot but you need runtime state
(what's actually in this field right now? what argument was passed to
that method?), Frida is the next layer.

`blutter_out/blutter_frida.js` is a pre-built Frida script that
implements Dart-aware introspection: pointer decompression, object
field extraction, list/map traversal, type metadata parsing. It's
~10k lines and you do not need to understand most of it. Use it as
a library.

Typical flow:

```bash
# 1. Start the companion app on an Android device connected to adb
# 2. Attach Frida
frida -U -f com.vendor.app -l blutter_out/blutter_frida.js --no-pause

# 3. In the Frida REPL, dump an object:
readObject(0x12345000)   // address from objs.txt or from a breakpoint
```

Where to breakpoint: the handlers you found statically in Blutter.
When you hit the breakpoint, dump the argument objects and see what
real-world values actually flow through.

This is how you resolve ambiguities that static analysis alone can't.
Blutter might tell you "this function takes a `BleG2PsType`" but not
tell you which instance is passed at runtime. Frida tells you
"it's `BleG2PsType(field_b=2, field_13=6450)`" — now you have the
concrete values that drive dispatch.

### Limitations

- Frida needs root on most Android devices, or a re-signed APK with
  Frida's gadget injected.
- Some apps have anti-Frida checks. Blutter's script handles the
  common ones, but not all.
- Dart object layouts change between Flutter versions. If Blutter's
  generated `blutter_frida.js` doesn't match the Flutter version in
  the APK, offsets will be wrong and you'll get garbage.

## When Blutter isn't enough

Blutter is excellent at static structure, mediocre at control flow.
Complex things it struggles with:

- **Async/await chains.** Dart's async state machines become gnarly
  post-Blutter. You'll see raw `Future` continuations but not a
  readable linear call order.
- **Reflection-based code.** Dart has limited reflection, but what
  exists bypasses Blutter's type tracking.
- **Platform channels.** When Flutter calls into native Android/iOS
  code, the boundary looks like an opaque `MethodChannel.invoke` and
  you have to jump to JADX (for Android) or Hopper/Ghidra (for iOS)
  on the native side.

For async chains specifically: find the **synchronous setup** that
wires the async chain together. That's where the interesting plumbing
is — e.g., the line where a `StreamController` gets assigned to a
field, not the line where the stream is consumed.

## Workflow summary

```
APK → apktool → libapp.so →
  (a) strings → strings_to_tree.py → instant navigable tree
  (b) blutter → pseudo-asm dump → deep grep
  (c) frida + blutter_frida.js → runtime introspection
```

Run (a) first (2 minutes). Start (b) in the background (20 minutes).
Use (c) when (b) leaves a question unanswered.
