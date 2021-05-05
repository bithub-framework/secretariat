import assert from 'assert';
import { resolve } from 'path';
const XDG_RUNTIME_DIR = process.env['XDG_RUNTIME_DIR'];
assert(XDG_RUNTIME_DIR);
const HOME = process.env['HOME'];
assert(HOME);
let XDG_DATA_HOME = process.env['$XDG_DATA_HOME'] || resolve(HOME, './.local/share');
export const DATABASE_ABSPATH = resolve(XDG_DATA_HOME, './bithub/secretariat.db');
export const LOCKFILE_ABSPATH = resolve(XDG_RUNTIME_DIR, './secretariat.lock');
export const SOCKFILE_ABSPATH = resolve(XDG_RUNTIME_DIR, './secretariat.sock');
//# sourceMappingURL=config.js.map