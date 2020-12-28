export * from 'interfaces';

export interface StringifiedAssets {
    position: {
        [length: number]: string;
    };
    balance: string;
    cost: {
        [length: number]: string;
    };
    frozenMargin: string;
    frozenPosition: {
        [length: number]: string;
    };
    margin: string;
    reserve: string;
    closable: {
        [length: number]: string;
    };
    time: number;
}
