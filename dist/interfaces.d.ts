export * from 'interfaces';
export declare type ValueAndTime = {
    value: JsonValue;
    time: number;
};
export declare type JsonAndTime = {
    value: string;
    time: number;
};
export declare type JsonValue = null | number | string | JsonValue[] | {
    [key: string]: JsonValue;
};
