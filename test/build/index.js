import { Secretariat } from '../../dist/secretariat';
import test from 'ava';
import fetch from 'node-fetch';
import { REDIRECTOR_PORT } from '../../dist/config';
import { LONG, SHORT, } from '../../dist/interfaces';
const url = `http://localhost:${REDIRECTOR_PORT}/secretariat`;
const EPSILON = 1e-12;
test.serial('1', async (t) => {
    const secretariat = new Secretariat();
    await secretariat.start();
    let res;
    let balances;
    res = await fetch(`${url}/assets?id=secretariat`, {
        method: 'DELETE',
    });
    t.assert(res.ok);
    res = await fetch(`${url}/assets?id=secretariat`);
    t.assert(res.ok);
    balances = await res.json();
    t.log(balances);
    const time = Date.now();
    const assets = {
        time,
        balance: '1.7',
        position: {
            [LONG]: '0', [SHORT]: '0'
        },
        cost: {
            [LONG]: '0', [SHORT]: '0'
        },
        margin: '0',
        frozenMargin: '0',
        reserve: '1.7',
        frozenPosition: {
            [LONG]: '0', [SHORT]: '0'
        },
        closable: {
            [LONG]: '0', [SHORT]: '0'
        },
    };
    res = await fetch(`${url}/assets?id=secretariat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assets),
    });
    t.assert(res.ok);
    res = await fetch(`${url}/assets?id=secretariat`);
    t.assert(res.ok);
    balances = await res.json();
    t.log(balances);
    t.assert(Math.abs(balances[0][0] - 1.7) < EPSILON);
    t.is(balances[0][1], time);
    await fetch(`${url}/assets?id=secretariat`, {
        method: 'DELETE',
    });
    t.assert(res.ok);
    await secretariat.stop();
});
//# sourceMappingURL=index.js.map