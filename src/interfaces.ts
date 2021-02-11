export * from 'interfaces';

export type ValueAndTime = {
    value: unknown; // Serializable into JSON
    time: number;
};

export type JsonAndTime = {
    value: string;
    time: number;
}
