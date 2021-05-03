import { adaptor } from 'startable';
import Secretariat from './secretariat';
import { lockSync } from 'lockfile';
import { LOCKFILE_ABSPATH } from './config';
lockSync(LOCKFILE_ABSPATH);
const secretariat = new Secretariat();
adaptor(secretariat);
secretariat.start(() => {
}).then(() => {
    console.log('Started');
}).catch(() => { });
//# sourceMappingURL=script.js.map