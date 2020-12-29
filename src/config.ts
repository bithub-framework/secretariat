import { homedir } from 'os';
import { resolve } from 'path';

export const DATABASE_PATH = resolve(homedir(), './.bithub/secretariat.db');
export const REDIRECTOR_URL = 'http://localhost:12000';
export const LOCAL_HOSTNAME = 'localhost';
