export * from 'interfaces';
import { LONG, SHORT, } from 'interfaces';
export function DbAssets2NAssets(dbAssets) {
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
    };
}
//# sourceMappingURL=interfaces.js.map