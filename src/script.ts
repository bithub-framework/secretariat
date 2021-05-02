import { adaptor } from 'startable';
import Secretariat from './secretariat';
import { lockSync } from 'lockfile';
import { ensureDirSync } from 'fs-extra';
import { LOCKFILE_PATH } from './config';
import { dirname } from 'path';

ensureDirSync(dirname(LOCKFILE_PATH));
lockSync(LOCKFILE_PATH);

const secretariat = new Secretariat();
adaptor(secretariat);

secretariat.start().then(() => {
    console.log('Started');
}, () => { });
