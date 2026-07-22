"use strict";

// MLLP (Minimal Lower Layer Protocol) — the framing lab analyzers use to send
// HL7 v2 over a raw TCP socket. Each message is wrapped as:
//
//   <VT> ...HL7... <FS> <CR>
//    0x0B          0x1C 0x0D
//
// A single TCP connection may deliver a message split across several `data`
// chunks, or several messages in one chunk, so we accumulate bytes in a buffer
// and emit complete messages as we find the end block.

const VT = 0x0b; // start of block
const FS = 0x1c; // end of block
const CR = 0x0d; // carriage return (terminates the frame, and HL7 segments)

/**
 * Stateful accumulator for one socket. Feed it raw Buffers; it calls back once
 * per fully-framed HL7 message with the inner message as a UTF-8 string.
 */
class MllpParser {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }

  /**
   * @param {Buffer} chunk raw bytes from the socket
   * @param {(message: string) => void} onMessage called for each complete message
   */
  push(chunk, onMessage) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    // Extract every complete <VT>...<FS><CR> frame currently in the buffer.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const start = this.buffer.indexOf(VT);
      if (start === -1) {
        // No start block yet — drop any leading noise, keep waiting.
        if (this.buffer.length > 0) this.buffer = Buffer.alloc(0);
        return;
      }

      const end = this.buffer.indexOf(FS, start + 1);
      if (end === -1) return; // frame not finished yet

      // Message bytes live between <VT> and <FS>.
      const message = this.buffer.slice(start + 1, end).toString("utf8");

      // Advance past <FS> and the trailing <CR> (if present).
      let next = end + 1;
      if (this.buffer[next] === CR) next += 1;
      this.buffer = this.buffer.slice(next);

      onMessage(message);
    }
  }
}

/** Wrap an HL7 message string in the MLLP frame, ready to write to the socket. */
function frame(message) {
  return Buffer.concat([
    Buffer.from([VT]),
    Buffer.from(message, "utf8"),
    Buffer.from([FS, CR]),
  ]);
}

module.exports = { MllpParser, frame, VT, FS, CR };
