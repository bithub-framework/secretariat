import Startable from 'startable';
declare class Secretariat extends Startable {
    private koa;
    private router;
    private server?;
    private db;
    constructor();
    _start(): Promise<void>;
    _stop(): Promise<void>;
    private startDatabase;
    private stopDatabase;
    private startServer;
    private stopServer;
}
export { Secretariat as default, Secretariat, };
