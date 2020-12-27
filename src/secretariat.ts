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
import {
    REDIRECTOR_PORT,
    DATABASE_PATH,
} from './config';
import {
    StringifiedAssets,
    LONG, SHORT,
} from './interfaces';

class Secretariat extends Startable {
    private koa = new Koa();
    private httpRouter = new Router();
    private wsRouter = new Router<UpgradeState, {}>();
    private wsFilter = new KoaWsFilter();
    private server?: Server;
    private db = new Database(DATABASE_PATH);
    private broadcast = new EventEmitter();

    constructor() {
        super();
        this.koa.use(bodyParser());

        this.httpRouter.post('/assets', async (ctx, next) => {
            const id = <string>ctx.query.id;
            const assets = <StringifiedAssets>ctx.body;
            const {
                balance, time, position, cost,
                margin, frozenMargin, reserve,
                frozenPosition, closable,
            } = assets;
            this.broadcast.emit(`assets/${id}`, assets);
            this.db.sql(`INSERT INTO assets (
                id, balance, time,
                position_long, position_short,
                cost_long, cost_short,
                margin, frozen_margin, reserve,
                frozen_position_long, frozen_position_short,
                closable_long, closable_short
            ) VALUES (
                ${id}, ${balance}, ${time},
                ${position[LONG]}, ${position[SHORT]},
                ${cost[LONG]}, ${cost[SHORT]},
                ${margin}, ${frozenMargin}, ${reserve},
                ${frozenPosition[LONG]}, ${frozenPosition[SHORT]},
                ${closable[LONG]}, ${closable[SHORT]},
            );`);
            await next();
        });

        this.httpRouter.delete('/assets', async (ctx, next) => {
            const id = <string>ctx.query.id;
            this.db.sql(`
                DELETE FROM assets
                WHERE id = ${id}
            ;`);
            await next();
        });

        this.httpRouter.get('/assets', async (ctx, next) => {
            const id = <string>ctx.query.id;
            const before: string | undefined = ctx.query.before;
            type Equity = {
                balance: number;
                time: number;
            };
            const equities = (before
                ? await this.db.sql<Equity>(`
                    SELECT balance, time FROM assets
                    WHERE id = ${id} AND time < ${before}
                ;`)
                : await this.db.sql<Equity>(`
                    SELECT balance, time FROM assets
                    WHERE id = ${id}
                ;`))
                .map(equity => [
                    equity.balance, equity.time,
                ]);
            ctx.body = equities;
            await next();
        });

        this.wsRouter.get('/assets', async (ctx, next) => {
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
    }

    public async _start() {
        await this.startDatabase();
        await this.startServer();
    }

    public async _stop() {
        await this.stopServer();
        await this.stopDatabase();
    }

    private async startDatabase() {
        await this.db.start().catch(err => void this.stop(err));
        const CURRENCY_TYPE = 'DECIMAL(12, 2)';
        const QUANTITY_TYPE = 'DECIMAL(16, 6)';
        await this.db.sql(`CREATE TABLE IF NOT EXISTS assets (
            id                      VARCHAR(32)         NOT NULL,
            balance                 ${CURRENCY_TYPE}    NOT NULL,
            time                    BIGINT              NOT NULL
            position_long           ${QUANTITY_TYPE}    NOT NULL,
            position_short          ${QUANTITY_TYPE}    NOT NULL,
            cost_long               ${CURRENCY_TYPE}    NOT NULL,
            cost_short              ${CURRENCY_TYPE}    NOT NULL,
            margin                  ${CURRENCY_TYPE}    NOT NULL,
            frozen_margin           ${CURRENCY_TYPE}    NOT NULL,
            reserve                 ${CURRENCY_TYPE}    NOT NULL,
            frozen_position_long    ${QUANTITY_TYPE}    NOT NULL,
            frozen_position_short   ${QUANTITY_TYPE}    NOT NULL,
            closable_long           ${QUANTITY_TYPE}    NOT NULL,
            closable_short          ${QUANTITY_TYPE}    NOT NULL,
        );`);
    }

    private async stopDatabase() {
        await this.db.stop();
    }

    private async startServer() {
        this.server = this.koa.listen();
        await once(this.server, 'listening');
        const port = (<AddressInfo>this.server.address()).port;
        await fetch(
            `http://localhost:${REDIRECTOR_PORT}/secretariat`, {
            method: 'PUT',
            body: `http://localhost:${port}`,
        });
    }

    private async stopServer() {
        this.server!.close();
        await once(this.server!, 'close');
    }
}

export {
    Secretariat as default,
    Secretariat,
}
