import { adaptor } from 'startable';
import Secretariat from './secretariat';
const secretariat = new Secretariat();
adaptor(secretariat);
secretariat.start().then(() => {
    console.log('Started');
}, () => { });
//# sourceMappingURL=script.js.map