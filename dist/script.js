import { adaptor } from 'startable';
import Secretariat from './secretariat';
import { lockSync } from 'lockfile';
import { ensureDirSync } from 'fs-extra';
import { LOCKFILE_ABSPATH } from './config';
import { dirname } from 'path';
ensureDirSync(dirname(LOCKFILE_ABSPATH));
lockSync(LOCKFILE_ABSPATH);
const secretariat = new Secretariat();
adaptor(secretariat);
secretariat.start(() => {
}).then(() => {
    console.log('Started');
}).catch(() => { });
//# sourceMappingURL=script.js.map