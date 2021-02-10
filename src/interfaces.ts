export * from 'interfaces';

export type ValueAndTime = {
    value: JsonValue;
    time: number;
};

export type JsonAndTime = {
    value: string;
    time: number;
}

export type JsonValue =
    null |
    number |
    string |
    JsonValue[] |
    {
        [key: string]: JsonValue;
    };
