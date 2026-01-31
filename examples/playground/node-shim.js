// Shim for Node.js built-in modules that don't exist in browsers
// These will throw at runtime if actually used

const notAvailable = (name) => () => {
  throw new Error(`${name} is not available in browser`);
};

// node:zlib exports
export const constants = {};
export const createGzip = notAvailable('gzip');
export const createGunzip = notAvailable('gunzip');
export const gzipSync = notAvailable('gzip');
export const gunzipSync = notAvailable('gunzip');
export const createDeflate = notAvailable('deflate');
export const createInflate = notAvailable('inflate');
export const deflateSync = notAvailable('deflate');
export const inflateSync = notAvailable('inflate');

// node:fs exports
export const readFileSync = notAvailable('fs.readFileSync');
export const writeFileSync = notAvailable('fs.writeFileSync');
export const existsSync = notAvailable('fs.existsSync');
export const mkdirSync = notAvailable('fs.mkdirSync');
export const readdirSync = notAvailable('fs.readdirSync');
export const statSync = notAvailable('fs.statSync');
export const unlinkSync = notAvailable('fs.unlinkSync');
export const rmdirSync = notAvailable('fs.rmdirSync');
export const copyFileSync = notAvailable('fs.copyFileSync');
export const renameSync = notAvailable('fs.renameSync');
export const promises = {};

// node:path exports
export const join = (...args) => args.join('/');
export const resolve = (...args) => args.join('/');
export const dirname = (p) => p.split('/').slice(0, -1).join('/');
export const basename = (p) => p.split('/').pop();
export const extname = (p) => { const m = p.match(/\.[^.]+$/); return m ? m[0] : ''; };
export const sep = '/';
export const posix = { sep: '/', join, resolve, dirname, basename, extname };

// node:crypto exports
export const createHash = notAvailable('crypto.createHash');
export const randomBytes = notAvailable('crypto.randomBytes');
export const randomUUID = () => crypto.randomUUID();

// node:buffer
export const Buffer = {
  from: (data, encoding) => {
    if (typeof data === 'string') {
      return new TextEncoder().encode(data);
    }
    return new Uint8Array(data);
  },
  alloc: (size) => new Uint8Array(size),
  isBuffer: () => false,
};

// node:stream
export const Readable = notAvailable('stream.Readable');
export const Writable = notAvailable('stream.Writable');
export const Transform = notAvailable('stream.Transform');
export const pipeline = notAvailable('stream.pipeline');

// node:util
export const promisify = (fn) => fn;
export const TextDecoder = globalThis.TextDecoder;
export const TextEncoder = globalThis.TextEncoder;

// node:os
export const platform = () => 'browser';
export const homedir = () => '/home/user';
export const tmpdir = () => '/tmp';

// node:child_process
export const spawn = notAvailable('child_process.spawn');
export const exec = notAvailable('child_process.exec');
export const execSync = notAvailable('child_process.execSync');

// node:worker_threads
export const Worker = notAvailable('worker_threads.Worker');
export const isMainThread = true;
export const parentPort = null;

// Default export
export default {};
