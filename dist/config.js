import { homedir } from 'os';
import { resolve } from 'path';
export const DATABASE_PATH = resolve(homedir(), './.bithub/secretariat.db');
export const REDIRECTOR_PORT = 12000;
//# sourceMappingURL=config.js.map