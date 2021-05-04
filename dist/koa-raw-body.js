async function readBufferStream(readable) {
    const chunks = [];
    for await (const chunk of readable)
        chunks.push(chunk);
    return Buffer.concat(chunks);
}
async function koaRawBody(ctx, next) {
    ctx.request.rawBody = await readBufferStream(ctx.req);
    await next();
}
export { koaRawBody as default, koaRawBody, };
//# sourceMappingURL=koa-raw-body.js.map