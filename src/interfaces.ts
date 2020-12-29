export * from 'interfaces';
import {
    LONG, SHORT,
    NumberizedAssets,
} from 'interfaces';

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

export function DbAssets2NAssets(dbAssets: DatabaseAssets): NumberizedAssets {
    return {
        balance: dbAssets.balance,
        position: {
            [LONG]: dbAssets.position_long,
            [SHORT]: dbAssets.position_short,
        },
        cost: {
            [LONG]: dbAssets.cost_long,
            [SHORT]: dbAssets.cost_short,
        },
        frozenMargin: dbAssets.frozen_margin,
        frozenPosition: {
            [LONG]: dbAssets.frozen_position_long,
            [SHORT]: dbAssets.frozen_position_short,
        },
        margin: dbAssets.margin,
        reserve: dbAssets.reserve,
        closable: {
            [LONG]: dbAssets.closable_long,
            [SHORT]: dbAssets.closable_short,
        },
        time: dbAssets.time,
    }
}
