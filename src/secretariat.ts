import Koa from 'koa';
import Router from '@koa/router';
import Startable from 'startable';
import { Server } from 'http';
import { once } from 'events';
import { Database } from 'promisified-sqlite';
import bodyParser from 'koa-bodyparser';
import { EventEmitter } from 'events';
import { promisifyWebsocket } from 'promisify-websocket';
import { KoaWsFilter, UpgradeState } from 'koa-ws-filter';
import { enableDestroy } from 'server-destroy';
import assert from 'assert';
import compress from 'koa-compress';
import fse from 'fs-extra';
import { kebabCase as kebabCaseRegex } from 'id-case';
import {
    DATABASE_ABSPATH,
    SOCKFILE_ABSPATH,
} from './config';
const { removeSync } = fse;

class Secretariat extends Startable {
    private koa = new Koa();
    private httpRouter = new Router();
    private wsRouter = new Router<UpgradeState, {}>();
    private wsFilter = new KoaWsFilter();
    private server = new Server();
    private db = new Database(DATABASE_ABSPATH);
    private broadcast = new EventEmitter();

    constructor() {
        super();
        this.koa.use(async (ctx, next) => {
            await next().catch(() => {
                ctx.status = 400;
            });
        });
        this.koa.use(bodyParser());

        this.httpRouter.post('/:pid/:key', async (ctx, next) => {
            const pid = (<string>ctx.params.pid).toLowerCase();
            assert(kebabCaseRegex.test(pid));
            const key = (<string>ctx.params.key).toLocaleLowerCase();
            assert(kebabCaseRegex.test(key));
            assert(ctx.is('application/json'));
            const json = ctx.request.rawBody;
            const time = Number.parseInt(ctx.get('Server-Time'));
            assert(Number.isInteger(time));

            this.broadcast.emit(`${pid}/${key}`, json);
            await this.db.sql(`INSERT INTO history (
                pid, key, value, time
            ) VALUES (
                '${pid}',
                '${key}',
                '${json}',
                ${time}
            );`);
            ctx.status = 201;
            await next();
        });

        this.httpRouter.delete('/:pid/:key', async (ctx, next) => {
            const pid = (<string>ctx.params.pid).toLowerCase();
            assert(kebabCaseRegex.test(pid));
            const key = (<string>ctx.params.key).toLocaleLowerCase();
            assert(kebabCaseRegex.test(key));

            await this.db.sql(`
                DELETE FROM history
                WHERE pid = '${pid}' AND key = '${key}'
            ;`);
            ctx.status = 204;
            await next();
        });

        this.httpRouter
            .get('/:pid/:key', compress())
            .get('/:pid/:key', async (ctx, next) => {
                const pid = (<string>ctx.params.pid).toLowerCase();
                assert(kebabCaseRegex.test(pid));
                const key = (<string>ctx.params.key).toLocaleLowerCase();
                assert(kebabCaseRegex.test(key));
                let before: number | null = null;
                if (ctx.query.before) {
                    assert(typeof ctx.query.before === 'string');
                    before = Number.parseInt(ctx.query.before);
                    assert(Number.isInteger(before));
                }
                let latest: number | null = null;
                if (ctx.query.latest) {
                    assert(typeof ctx.query.latest === 'string');
                    latest = Number.parseInt(ctx.query.latest);
                    assert(Number.isInteger(latest));
                }

                const jsons = (await this.db.sql<{
                    value: string;
                }>(`
                SELECT value FROM json
                WHERE pid = '${pid}' AND key = '${key}'
                    ${before ? `AND time < ${before}` : ''}
                ORDER BY time DESC
                ${latest ? `LIMIT ${latest}` : ''}
            ;`))
                    .reverse()
                    .map(row => row.value);
                ctx.status = 200;
                ctx.body = JSON.stringify(jsons);
                await next();
            });

        this.wsRouter.all('/:pid/:key', async (ctx, next) => {
            const pid = (<string>ctx.params.pid).toLowerCase();
            assert(kebabCaseRegex.test(pid));
            const key = (<string>ctx.params.key).toLocaleLowerCase();
            assert(kebabCaseRegex.test(key));

            const client = promisifyWebsocket(await ctx.state.upgrade());
            const onJson = async (json: string) => {
                try {
                    await client.sendAsync(json);
                } catch (err) {
                    this.stop(err).catch(() => { });
                }
            }
            this.broadcast.on(`${pid}/${key}`, onJson);
            client.on('close', () => void this.broadcast.off(`${pid}/${key}`, onJson))
            await next();
        });

        this.wsFilter.http(this.httpRouter.routes());
        this.wsFilter.ws(this.wsRouter.routes());
        this.koa.use(this.wsFilter.protocols());
        this.server.on('request', this.koa.callback());
        enableDestroy(this.server);
    }

    protected async _start() {
        await this.db.start(this.starp);
        await this.startServer();
    }

    protected async _stop() {
        await this.stopServer();
        await this.db.stop();
    }

    private async startServer() {
        removeSync(SOCKFILE_ABSPATH);
        this.server.listen(SOCKFILE_ABSPATH);
        await once(this.server, 'listening');
    }

    private async stopServer() {
        this.server.destroy();
        await Promise.all([
            once(this.server, 'close'),
            this.wsFilter.close(),
        ]);
    }
}

export {
    Secretariat as default,
    Secretariat,
}
