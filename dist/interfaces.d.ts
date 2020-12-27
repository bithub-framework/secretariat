export * from 'interfaces';
export interface StringifiedAssets {
    position: {
        [length: number]: number;
    };
    balance: number;
    cost: {
        [length: number]: number;
    };
    frozenMargin: number;
    frozenPosition: {
        [length: number]: number;
    };
    margin: number;
    reserve: number;
    closable: {
        [length: number]: number;
    };
    time: number;
}
