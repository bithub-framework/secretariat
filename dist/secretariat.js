import Koa from 'koa';
import Router from '@koa/router';
import Startable from 'startable';
import { Server } from 'http';
import { once } from 'events';
import { Database } from 'promisified-sqlite';
import bodyParser from 'koa-bodyparser';
import { EventEmitter } from 'events';
import { promisifyWebsocket } from 'promisify-websocket';
import { KoaWsFilter } from 'koa-ws-filter';
import { enableDestroy } from 'server-destroy';
import assert from 'assert';
import compress from 'koa-compress';
import { kebabCaseRegex, } from './validations';
import { DATABASE_PATH, SOCKFILE_PATH, } from './config';
class Secretariat extends Startable {
    constructor() {
        super();
        this.koa = new Koa();
        this.httpRouter = new Router();
        this.wsRouter = new Router();
        this.wsFilter = new KoaWsFilter();
        this.server = new Server();
        this.db = new Database(DATABASE_PATH);
        this.broadcast = new EventEmitter();
        this.koa.use(async (ctx, next) => {
            await next().catch(() => {
                ctx.status = 400;
            });
        });
        this.koa.use(bodyParser());
        this.httpRouter.post('/:pid/:key', async (ctx, next) => {
            const pid = ctx.params.pid.toLowerCase();
            assert(kebabCaseRegex.test(pid));
            const key = ctx.params.key.toLocaleLowerCase();
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
            const pid = ctx.params.pid.toLowerCase();
            assert(kebabCaseRegex.test(pid));
            const key = ctx.params.key.toLocaleLowerCase();
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
            const pid = ctx.params.pid.toLowerCase();
            assert(kebabCaseRegex.test(pid));
            const key = ctx.params.key.toLocaleLowerCase();
            assert(kebabCaseRegex.test(key));
            let before = null;
            if (ctx.query.before) {
                before = Number.parseInt(ctx.query.before);
                assert(Number.isInteger(before));
            }
            let latest = null;
            if (ctx.query.latest) {
                latest = Number.parseInt(ctx.query.latest);
                assert(Number.isInteger(latest));
            }
            const jsons = (await this.db.sql(`
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
            const pid = ctx.params.pid.toLowerCase();
            assert(kebabCaseRegex.test(pid));
            const key = ctx.params.key.toLocaleLowerCase();
            assert(kebabCaseRegex.test(key));
            const client = promisifyWebsocket(await ctx.state.upgrade());
            const onJson = async (json) => {
                try {
                    await client.sendAsync(json);
                }
                catch (err) {
                    this.stop(err).catch(() => { });
                }
            };
            this.broadcast.on(`${pid}/${key}`, onJson);
            client.on('close', () => void this.broadcast.off(`${pid}/${key}`, onJson));
            await next();
        });
        this.wsFilter.http(this.httpRouter.routes());
        this.wsFilter.ws(this.wsRouter.routes());
        this.koa.use(this.wsFilter.protocols());
        this.server.on('request', this.koa.callback());
        enableDestroy(this.server);
    }
    async _start() {
        await this.db.start(this.starp);
        await this.startServer();
    }
    async _stop() {
        await this.stopServer();
        await this.db.stop();
    }
    async startServer() {
        this.server.listen(SOCKFILE_PATH);
        await once(this.server, 'listening');
    }
    async stopServer() {
        this.server.destroy();
        await Promise.all([
            once(this.server, 'close'),
            this.wsFilter.close(),
        ]);
    }
}
export { Secretariat as default, Secretariat, };
//# sourceMappingURL=secretariat.js.map