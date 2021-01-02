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
import {
    REDIRECTOR_URL,
    LOCAL_HOSTNAME,
    DATABASE_PATH,
} from './config';
import {
    StringifiedAssets,
} from './interfaces';

class Secretariat extends Startable {
    private koa = new Koa();
    private httpRouter = new Router();
    private wsRouter = new Router<UpgradeState, {}>();
    private wsFilter = new KoaWsFilter();
    private server = new Server();
    private db = new Database(DATABASE_PATH);
    private broadcast = new EventEmitter();

    constructor() {
        super();
        this.koa.use(bodyParser());

        this.httpRouter.post('/assets', async (ctx, next) => {
            const id = <string>ctx.query.id;
            const assets = <StringifiedAssets>ctx.request.body;
            this.broadcast.emit(`assets/${id}`, assets);
            await this.db.sql(`INSERT INTO assets (
                id, json
            ) VALUES (
                '${id}', '${JSON.stringify(assets)}'
            );`);
            ctx.status = 200;
            await next();
        });

        this.httpRouter.delete('/assets', async (ctx, next) => {
            const id = <string>ctx.query.id;
            await this.db.sql(`
                DELETE FROM assets
                WHERE id = '${id}'
            ;`);
            ctx.status = 200;
            await next();
        });

        this.httpRouter.get('/balances', async (ctx, next) => {
            const id = <string>ctx.query.id;
            const before: string | undefined = ctx.query.before;
            type Equity = {
                balance: string;
                time: number;
            };
            const equities = (before
                ? await this.db.sql<Equity>(`
                    SELECT 
                        json_extract(json, '$.balance') AS balance, 
                        json_extract(json, '$.time') AS time
                    FROM assets
                    WHERE id = '${id}' AND time < ${before}
                    ORDER BY time
                ;`)
                : await this.db.sql<Equity>(`
                    SELECT 
                        json_extract(json, '$.balance') AS balance, 
                        json_extract(json, '$.time') AS time
                    FROM assets
                    WHERE id = '${id}'
                    ORDER BY time
                ;`))
                .map(equity => [
                    equity.balance, equity.time,
                ] as const);
            ctx.body = equities;
            await next();
        });

        this.httpRouter.get('/assets/latest', async (ctx, next) => {
            const id = <string>ctx.query.id;
            const maxTime = (await this.db.sql<{ max_time: number | null }>(`
                SELECT 
                    MAX(json_extract(json, '$.time')) AS max_time
                FROM assets
                WHERE id = '${id}'
            ;`))[0]['max_time'];
            if (maxTime !== null) {
                const assetsJson = (await this.db.sql<{ json: string }>(`
                    SELECT json FROM assets
                    WHERE id = '${id}' AND json_extract(json, '$.time') = ${maxTime}
                ;`))[0].json;
                ctx.body = <StringifiedAssets>JSON.parse(assetsJson);
            } else {
                ctx.status = 404;
            }
            await next();
        });

        this.wsRouter.all('/assets', async (ctx, next) => {
            const id = <string>ctx.query.id;
            // 即使 websocket 出错，出错事件也还在宏队列中，此时状态必为 STARTED
            const client = new Websocket(await ctx.state.upgrade());
            const onAssets = async (assets: StringifiedAssets) => {
                try {
                    await client.send(JSON.stringify(assets));
                } catch (err) {
                    this.stop(err).catch(() => { });
                }
            }
            this.broadcast.on(`assets/${id}`, onAssets);
            await client.start(() => void this.broadcast.off(`assets/${id}`, onAssets));
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
        await this.db.sql(`CREATE TABLE IF NOT EXISTS assets (
            id      VARCHAR(32)     NOT NULL,
            json    JSON            NOT NULL
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
