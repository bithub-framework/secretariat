import Koa from 'koa';
import Router from '@koa/router';
import Startable from 'startable';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { once } from 'events';
import fetch from 'node-fetch';
import { Database } from 'promisified-sqlite';
import bodyParser from 'koa-bodyparser';
import { EventEmitter } from 'events';
import { PromisifiedWebSocket as Websocket } from 'promisified-websocket';
import { KoaWsFilter, UpgradeState } from 'koa-ws-filter';
import { enableDestroy } from 'server-destroy';
import assert from 'assert';
import {
    REDIRECTOR_URL,
    LOCAL_HOSTNAME,
    DATABASE_PATH,
} from './config';
import {
    JsonValue,
    JsonAndTime,
    ValueAndTime,
} from './interfaces';

function jsonAndTime2ValueAndTime(jsonAndTime: JsonAndTime) {
    return <ValueAndTime>{
        value: JSON.parse(jsonAndTime.value),
        time: jsonAndTime.time,
    }
}

class Secretariat extends Startable {
    private koa = new Koa();
    private httpRouter = new Router();
    private wsRouter = new Router<UpgradeState, {}>();
    private wsFilter = new KoaWsFilter();
    private server = new Server();
    private db = new Database(DATABASE_PATH);
    private broadcast = new EventEmitter();

    // TODO: 压缩
    constructor() {
        super();
        this.koa.use(async (ctx, next) => {
            await next().catch(err => {
                ctx.status = 400;
            });
        });
        this.koa.use(bodyParser());

        this.httpRouter.post('/:pid/:key', async (ctx, next) => {
            assert(ctx.is('application/json'));
            const pid = <string>ctx.params.pid;
            const key = <string>ctx.params.key;
            const value = <JsonValue>ctx.request.body;
            const time = Number.parseInt(ctx.get('Time'));
            this.broadcast.emit(`${pid}/${key}`, value);
            await this.db.sql(`INSERT INTO json (
                pid, key, value, time
            ) VALUES (
                '${pid}',
                '${key}',
                '${JSON.stringify(value)}',
                ${time}
            );`);
            ctx.status = 201;
            await next();
        });

        this.httpRouter.delete('/:pid/:key', async (ctx, next) => {
            const pid = <string>ctx.params.pid;
            const key = <string>ctx.params.key;
            await this.db.sql(`
                DELETE FROM json
                WHERE pid = '${pid}' AND key = '${key}'
            ;`);
            ctx.status = 204;
            await next();
        });

        this.httpRouter.get('/:pid/:key', async (ctx, next) => {
            const pid = <string>ctx.params.pid;
            const key = <string>ctx.params.key;
            const before = <string | undefined>ctx.query.before;
            const jsonAndTimes = before
                ? await this.db.sql<JsonAndTime>(`
                    SELECT value, time FROM json
                    WHERE pid = '${pid}' AND key = '${key}' AND time < ${before}
                    ORDER BY time
                ;`)
                : await this.db.sql<JsonAndTime>(`
                    SELECT value, time FROM json
                    WHERE pid = '${pid}' AND key = '${key}'
                    ORDER BY time
                ;`);
            const valueAndTimes = jsonAndTimes.map(jsonAndTime2ValueAndTime);
            ctx.status = 200;
            ctx.body = valueAndTimes;
            await next();
        });

        this.httpRouter.get('/:pid/:key/latest', async (ctx, next) => {
            const pid = <string>ctx.params.pid;
            const key = <string>ctx.params.key;
            const maxTime = (await this.db.sql<{ maxTime: number | null }>(`
                SELECT MAX(time) AS maxTime FROM equities
                WHERE pid = '${pid}' AND key = '${key}'
            ;`))[0]['maxTime'];
            if (maxTime !== null) {
                const jsonAndTime = (await this.db.sql<JsonAndTime>(`
                    SELECT value, time FROM json
                    WHERE pid = '${pid}' AND key = '${key}' AND time = ${maxTime}
                ;`))[0];
                ctx.status = 200;
                ctx.body = jsonAndTime2ValueAndTime(jsonAndTime);
            } else {
                ctx.status = 404;
            }
            await next();
        });

        this.wsRouter.all('/:pid/:key', async (ctx, next) => {
            const pid = <string>ctx.params.pid;
            const key = <string>ctx.params.key;
            // 即使 websocket 出错，出错事件也还在宏队列中，此时状态必为 STARTED
            const client = new Websocket(await ctx.state.upgrade());
            const onValue = async (value: JsonValue) => {
                try {
                    await client.send(JSON.stringify(value));
                } catch (err) {
                    this.stop(err).catch(() => { });
                }
            }
            this.broadcast.on(`${pid}/${key}`, onValue);
            await client.start(() => void this.broadcast.off(`${pid}/${key}`, onValue));
            await next();
        });

        this.wsFilter.http(this.httpRouter.routes());
        this.wsFilter.ws(this.wsRouter.routes());
        this.koa.use(this.wsFilter.protocols());
        this.server.on('request', this.koa.callback());
        enableDestroy(this.server);
    }

    protected async _start() {
        await this.startDatabase();
        await this.startServer();
    }

    protected async _stop() {
        await this.stopServer();
        await this.stopDatabase();
    }

    private async startDatabase() {
        await this.db.start().catch(err => void this.stop(err));
        await this.db.sql(`CREATE TABLE IF NOT EXISTS json (
            pid     VARCHAR(32)     NOT NULL,
            key     VARCHAR(16)     NOT NULL,
            value   JSON            NOT NULL,
            time    BIGINT          NOT NULL
        );`);
    }

    private async stopDatabase() {
        await this.db.stop();
    }

    private async startServer() {
        this.server.listen();
        await once(this.server, 'listening');
        const port = (<AddressInfo>this.server.address()).port;
        await fetch(
            `${REDIRECTOR_URL}/secretariat`, {
            method: 'PUT',
            body: `http://${LOCAL_HOSTNAME}:${port}`,
        });
    }

    private async stopServer() {
        this.server!.destroy();
        await Promise.all([
            once(this.server!, 'close'),
            this.wsFilter.close(),
        ]);
    }
}

export {
    Secretariat as default,
    Secretariat,
}
