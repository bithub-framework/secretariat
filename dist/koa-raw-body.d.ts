/// <reference types="node" />
import { Context, Next } from 'koa';
declare module 'koa' {
    interface Request {
        rawBody: Buffer;
    }
}
declare function koaRawBody(ctx: Context, next: Next): Promise<void>;
export { koaRawBody as default, koaRawBody, };
