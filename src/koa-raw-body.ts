import { Context, Next } from 'koa';
import { Readable } from 'stream';

declare module 'koa' {
    interface Request {
        rawBody: Buffer;
    }
}

async function readBufferStream(readable: Readable): Promise<Buffer> {
    const chunks = [];
    for await (const chunk of readable)
        chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function koaRawBody(ctx: Context, next: Next) {
    ctx.request.rawBody = await readBufferStream(ctx.req);
    await next();
}

export {
    koaRawBody as default,
    koaRawBody,
}
