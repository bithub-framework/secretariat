import { Secretariat } from '../../dist/secretariat';
import test from 'ava';
import axios, { AxiosResponse } from 'axios';
import { SOCKFILE_ABSPATH } from '../../dist/config';

test.serial('1', async t => {
    const secretariat = new Secretariat();
    await secretariat.start();
    let res: AxiosResponse<any>;
    let balances: number[];

    await axios.request({
        method: 'DELETE',
        socketPath: SOCKFILE_ABSPATH,
        url: '/secretariat/balances',
    });

    res = await axios.request({
        method: 'GET',
        socketPath: SOCKFILE_ABSPATH,
        url: '/secretariat/balances',
    });
    balances = res.data;
    t.assert(balances.length === 0);

    await axios.request({
        method: 'POST',
        socketPath: SOCKFILE_ABSPATH,
        url: '/secretariat/balances',
        headers: {
            'Content-Type': 'application/json',
            'Server-Time': '1',
        },
        data: '100',
    });

    await axios.request({
        method: 'POST',
        socketPath: SOCKFILE_ABSPATH,
        url: '/secretariat/balances',
        headers: {
            'Content-Type': 'application/json',
            'Server-Time': '2',
        },
        data: '200',
    });

    res = await axios.request({
        method: 'GET',
        socketPath: SOCKFILE_ABSPATH,
        url: '/secretariat/balances?before=2',
    });
    balances = res.data;
    t.assert(balances.length === 1);
    t.assert(balances[0] === 100);

    await axios.request({
        method: 'DELETE',
        socketPath: SOCKFILE_ABSPATH,
        url: '/secretariat/balances',
    });

    await secretariat.stop();
});
