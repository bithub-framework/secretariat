export * from 'interfaces';
import { NumberizedAssets } from 'interfaces';
export interface DatabaseAssets {
    id: string;
    balance: number;
    time: number;
    position_long: number;
    position_short: number;
    cost_long: number;
    cost_short: number;
    margin: number;
    frozen_margin: number;
    reserve: number;
    frozen_position_long: number;
    frozen_position_short: number;
    closable_long: number;
    closable_short: number;
}
export declare function DbAssets2NAssets(dbAssets: DatabaseAssets): NumberizedAssets;
