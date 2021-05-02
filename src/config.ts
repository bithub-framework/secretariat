import { homedir } from 'os';
import { resolve } from 'path';

export const DATABASE_ABSPATH = resolve(homedir(), '/var/lib/bithub/secretariat.db');
export const LOCKFILE_ABSPATH = '/run/bithub/secretariat.lock';
export const SOCKFILE_ABSPATH = '/run/bithub/secretariat.sock';
