// Buffer polyfill for browser
import { Buffer as BufferPolyfill } from "buffer";

// Make Buffer globally available
globalThis.Buffer = BufferPolyfill;

export { BufferPolyfill as Buffer };
