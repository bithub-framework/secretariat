import Koa from 'koa';
import Router from '@koa/router';
import Startable from 'startable';
import { Server } from 'http';
import { once } from 'events';
import { Database } from 'promisified-sqlite';
import { koaRawBody } from './koa-raw-body';
import { EventEmitter } from 'events';
import { promisifyWebsocket } from 'promisify-websocket';
import { KoaWsFilter } from 'koa-ws-filter';
import { enableDestroy } from 'server-destroy';
import assert from 'assert';
import compress from 'koa-compress';
import fse from 'fs-extra';
import { kebabCase as kebabCaseRegex } from 'id-case';
import { DATABASE_ABSPATH, SOCKFILE_ABSPATH, } from './config';
const { removeSync, chmodSync } = fse;
class Secretariat extends Startable {
    constructor() {
        super();
        this.koa = new Koa();
        this.httpRouter = new Router();
        this.wsRouter = new Router();
        this.wsFilter = new KoaWsFilter();
        this.server = new Server();
        this.db = new Database(DATABASE_ABSPATH);
        this.broadcast = new EventEmitter();
        this.koa.use(async (ctx, next) => {
            await next().catch(err => {
                console.error(err);
                ctx.status = 400;
            });
        });
        this.koa.use(koaRawBody);
        this.httpRouter.post('/:pid/:key', async (ctx, next) => {
            const pid = ctx.params.pid.toLowerCase();
            assert(kebabCaseRegex.test(pid));
            const key = ctx.params.key.toLocaleLowerCase();
            assert(kebabCaseRegex.test(key));
            assert(ctx.is('application/json'));
            const json = ctx.request.rawBody.toString();
            const time = Number.parseInt(ctx.get('Server-Time'));
            assert(Number.isInteger(time));
            this.broadcast.emit(`${pid}/${key}`, json);
            await this.db.sql(`INSERT INTO history (
                pid, key, value, time
            ) VALUES (
                $pid,
                $key,
                $json,
                $time
            );`, {
                $pid: pid,
                $key: key,
                $json: json,
                $time: time,
            });
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
                assert(typeof ctx.query.before === 'string');
                before = Number.parseInt(ctx.query.before);
                assert(Number.isInteger(before));
            }
            let latest = null;
            if (ctx.query.latest) {
                assert(typeof ctx.query.latest === 'string');
                latest = Number.parseInt(ctx.query.latest);
                assert(Number.isInteger(latest));
            }
            const jsons = (await this.db.sql(`
                    SELECT value FROM history
                    WHERE pid = $pid AND key = $key
                        ${before !== null ? `AND time < $before` : ''}
                    ORDER BY time DESC
                    ${latest !== null ? `LIMIT $latest` : ''}
                ;`, {
                $pid: pid,
                $key: key,
                // 目前版本的 node-sqlite3 不允许有多余的参数，否则报错
                $before: before !== null ? before : undefined,
                $latest: latest !== null ? latest : undefined,
            }))
                .reverse()
                .map(row => row.value);
            ctx.status = 200;
            ctx.body = jsons;
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
                    client.close();
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
        removeSync(SOCKFILE_ABSPATH);
        this.server.listen(SOCKFILE_ABSPATH);
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