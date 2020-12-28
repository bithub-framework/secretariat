import Startable from 'startable';
declare class Secretariat extends Startable {
    private koa;
    private httpRouter;
    private wsRouter;
    private wsFilter;
    private server;
    private db;
    private broadcast;
    constructor();
    protected _start(): Promise<void>;
    protected _stop(): Promise<void>;
    private startDatabase;
    private stopDatabase;
    private startServer;
    private stopServer;
}
export { Secretariat as default, Secretariat, };
