# CRC hunting

The protocol has a 2-byte checksum at the end of each frame and you
don't know what it is. This guide is the procedure for finding it in
under an hour, even when the naive brute force would take a day.

## The problem

There are dozens of CRC-16 variants in common use, and they differ
along five axes:

- **Polynomial**: `0x1021` (CCITT), `0x8005` (ARC/IBM), `0x3d65` (DNP),
  etc.
- **Initial value**: `0x0000`, `0xFFFF`, `0x1D0F`, etc.
- **Input reflection**: each input byte is bit-reversed before
  folding in.
- **Output reflection**: the final CRC is bit-reversed before xor.
- **Output xor**: the final CRC is xor'd with a constant.

Plus there's:
- **Scope**: over which bytes of the frame was the CRC computed? The
  whole thing? Just the payload? Post-header to pre-CRC?
- **Endianness**: is the 2-byte result stored big- or little-endian?

That's a search space of ~25 variants × 6 plausible scopes × 2
endiannesses = ~300 possibilities. Small enough to brute-force in
milliseconds — **if** you have a few clean samples.

## The tool

[`tools/crc-hunt.ts`](../tools/crc-hunt.ts) automates this. It:

1. Loads a tab-separated hex log (from `parse-snoop.ts` or tshark).
2. Filters to non-fragmented packets matching a filter predicate.
3. For each (variant × scope × endianness) combination, tries every
   sample and reports combinations that match **all** samples.

Usage:

```bash
bun tools/crc-hunt.ts writes.txt --sid 0x06
```

## The procedure

### Step 1: get clean samples

Grab 4+ frames where:

- They are **single-fragment** (`totalFrags == 1`). Fragmented CRCs
  follow different rules (see below).
- They come from the **same subsystem** (same sid / same channel).
  Different subsystems sometimes use different CRCs.
- They have **different payloads**. If all your samples have the
  same bytes, you can't distinguish a real CRC from a constant.
- You're **sure** the last 2 bytes are the CRC and not something
  else (length, flags, etc.). Cross-reference with multiple frames:
  the last 2 bytes should change with the payload content, not just
  with the length.

4 samples is the minimum. 10+ is better. A false match can survive 3
samples out of sheer luck; by 10 it can't.

### Step 2: run the hunt

```bash
bun tools/crc-hunt.ts writes.txt --sid 0x06
# MATCH  CCITT-FALSE   [6..end-2]  LE
```

If you get exactly one match, you're done. Move to step 3.

If you get **no** matches, see "Troubleshooting" below.

If you get **multiple** matches, they're usually equivalent (the tool
reports e.g. both `[6..end-2] LE` and `[0..end-2] LE` because the
header bytes happen to CRC to zero). Pick the simplest scope.

### Step 3: verify across the whole capture

Don't trust a 4-sample match. Run the match against **every** frame
in the log. A real CRC will match 100% of frames. A false match will
fail on the ~5th non-sample frame.

```typescript
// pseudocode
for (const frame of allFrames) {
  const expected = crc16ccittFalse(frame.slice(6, -2));
  const actual = readLE16(frame.slice(-2));
  if (expected !== actual) console.error("mismatch", frame);
}
```

If you get 100% match → pinned. If not, your filter was wrong (some
frames follow different rules) or the CRC scope isn't fixed (some
frames include a header byte, some don't). Inspect the failing ones.

## The fragmentation trap

This is the trap that ate a day of the G2 RE session. **A protocol's
CRC is not always computed per-frame.**

Common patterns:

1. **Per-frame CRC on every fragment** — simplest, what you expect.
2. **CRC on the last fragment only, over the concatenated payload of
   all fragments** — this is what G2 does. Fragments 1..(n-1) have
   no CRC bytes at all; the CRC appears only on fragment n, computed
   over the reassembled payload bytes.
3. **CRC per fragment, but over a rolling state** — rare, but real.
4. **No CRC at all on fragmented messages, CRC only on
   single-fragment messages** — also seen.

If `crc-hunt.ts` finds a CCITT-FALSE match on single-fragment packets
but fails on the last fragment of a multi-frag message, you're in
case 2. The fix:

1. Reassemble the payload by concatenating the payload bytes of all
   fragments (excluding envelope bytes).
2. CRC the reassembled buffer.
3. Check that against the 2 bytes at the end of the **last
   fragment**.

### Step 4: test on a multi-frag message

Once your hypothesis fits all single-fragment frames, grab a
multi-fragment message and test both hypotheses:

- **Per-frag**: CRC each fragment's own payload independently.
- **Reassembled**: concatenate all fragments' payloads and CRC the
  whole thing, compare to last-fragment trailer.

Whichever works at 100% is the answer.

## Troubleshooting

**No variants match.**

Possibilities, in order of probability:

- Your scope guesses are wrong. Try adding `[1..end-2]`, `[8..end-2]`,
  `[4..end-4]` (some protocols reserve 4 trailing bytes, not 2).
- The "CRC" is 2 bytes of something else — a length echo, a sequence
  echo, a status word. Check if the trailing bytes vary when only
  the **count** of payload bytes changes without the content changing.
- The checksum isn't CRC-16. Try `crc-hunt.ts --extras` which also
  tests Fletcher-16, Adler-32, XOR, sum-8, sum-16.
- The payload is encrypted before CRC, meaning the CRC is over
  ciphertext that you can't reproduce from the plaintext you're
  looking at.
- The CRC is over the **decoded** payload (post-decompression, post-
  base64, post-whatever), not the wire bytes.

**One variant matches but only on ~80% of frames.**

- Two different scopes are in use — maybe the first 6 bytes are in
  the CRC range for sid A but not sid B. Split your sample set by
  sid and rerun.
- The CRC includes the envelope header on some frames and not
  others. Check whether there's a flag byte that toggles this.

**Multiple variants match on samples but diverge in the wild.**

- You had insufficient samples. Grab 20 more frames and rerun. The
  false matches will drop.

## The "well-known protocol" shortcut

Before brute-forcing, check if the advertising name, app package name,
or service UUID matches a known protocol family:

- **Nordic UART** / **BlueNRG** SDKs: no CRC, link layer handles it.
- **BLE SIG standard services**: no envelope at all, GATT handles
  everything.
- **Espressif ESP-BLE**: usually has CCITT-FALSE or XMODEM.
- **Realtek RTL chipsets**: often ARC / IBM (0x8005).
- **Even Realities**: CCITT-FALSE over reassembled payload (case 2).
- **Custom Chinese IoT firmware**: MODBUS is common, because the
  vendor copied it from a Modbus library.

If you recognize a fingerprint, try that variant first.

## What a successful hunt looks like

Real G2 session:

```
$ bun crc-hunt.ts writes_0842.txt --sid 0x06
Found 4 non-fragmented SID 0x06 samples
  MATCH: CCITT-FALSE   [6..end-2]  LE
  MATCH: CCITT-FALSE   [0..end-2]  LE

Trailing bytes of samples:
  len=38  tail=9ea7  content_len=30
  len=42  tail=7b13  content_len=34
  len=37  tail=4f82  content_len=29
  len=58  tail=c108  content_len=50
```

Two matches, but they're equivalent (the first 6 bytes of the G2
envelope happen to be constant within a sid, so CRC'ing them with or
without doesn't differ). Pick the tighter scope (`[6..end-2]`, i.e.
"payload only").

Then: `crc-verify.ts` against all 442 frames in the capture → 127
single-fragment frames match at 100%, 315 multi-fragment frames **fail**.
Hypothesis: multi-fragment uses reassembled CRC. Test it. Confirmed.

Total elapsed: ~25 minutes from first run to fully pinned.
