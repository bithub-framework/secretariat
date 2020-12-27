import Koa from 'koa';
import Router from '@koa/router';
import Startable from 'startable';
import { once } from 'events';
import fetch from 'node-fetch';
import { Database } from 'promisified-sqlite';
import bodyParser from 'koa-bodyparser';
import { EventEmitter } from 'events';
import { PromisifiedWebSocket as Websocket } from 'promisified-websocket';
import { KoaWsFilter } from 'koa-ws-filter';
import { REDIRECTOR_PORT, DATABASE_PATH, } from './config';
import { LONG, SHORT, } from './interfaces';
class Secretariat extends Startable {
    constructor() {
        super();
        this.koa = new Koa();
        this.httpRouter = new Router();
        this.wsRouter = new Router();
        this.wsFilter = new KoaWsFilter();
        this.db = new Database(DATABASE_PATH);
        this.broadcast = new EventEmitter();
        this.koa.use(bodyParser());
        this.httpRouter.post('/assets', async (ctx, next) => {
            const id = ctx.query.id;
            const assets = ctx.body;
            const { balance, time, position, cost, margin, frozenMargin, reserve, frozenPosition, closable, } = assets;
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
            const id = ctx.query.id;
            this.db.sql(`
                DELETE FROM assets
                WHERE id = ${id}
            ;`);
            await next();
        });
        this.httpRouter.get('/assets', async (ctx, next) => {
            const id = ctx.query.id;
            const before = ctx.query.before;
            const equities = (before
                ? await this.db.sql(`
                    SELECT balance, time FROM assets
                    WHERE id = ${id} AND time < ${before}
                ;`)
                : await this.db.sql(`
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
            const id = ctx.query.id;
            // 即使 websocket 出错，出错事件也还在宏队列中，此时状态必为 STARTED
            const client = new Websocket(await ctx.state.upgrade());
            const onAssets = async (assets) => {
                try {
                    await client.send(JSON.stringify(assets));
                }
                catch (err) {
                    this.stop(err).catch(() => { });
                }
            };
            this.broadcast.on(`assets/${id}`, onAssets);
            await client.start(() => void this.broadcast.off(`assets/${id}`, onAssets));
            await next();
        });
        this.wsFilter.http(this.httpRouter.routes());
        this.wsFilter.ws(this.wsRouter.routes());
        this.koa.use(this.wsFilter.protocols());
    }
    async _start() {
        await this.startDatabase();
        await this.startServer();
    }
    async _stop() {
        await this.stopServer();
        await this.stopDatabase();
    }
    async startDatabase() {
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
    async stopDatabase() {
        await this.db.stop();
    }
    async startServer() {
        this.server = this.koa.listen();
        await once(this.server, 'listening');
        const port = this.server.address().port;
        await fetch(`http://localhost:${REDIRECTOR_PORT}/secretariat`, {
            method: 'PUT',
            body: `http://localhost:${port}`,
        });
    }
    async stopServer() {
        this.server.close();
        await once(this.server, 'close');
    }
}
export { Secretariat as default, Secretariat, };
//# sourceMappingURL=secretariat.js.map