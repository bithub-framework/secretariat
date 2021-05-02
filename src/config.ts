import { homedir } from 'os';
import { resolve } from 'path';

export const DATABASE_PATH = resolve(homedir(), './.bithub/secretariat.db');
export const LOCKFILE_PATH = '/var/run/bithub/secretariat.lock';
export const SOCKFILE_PATH = '/var/run/bithub/secretariat.sock';
