/**
 * 全局规则常量。
 */

/** 每个盘子最多容纳的食材层数 */
export const MAX_LAYERS = 6;

/** 盘子数量 */
export const PLATE_COUNT = 3;

/** 顶部订单数量 */
export const ORDER_COUNT = 3;

/** 每局订单总数，实际数量最多为食谱种类数的两倍。 */
export const ORDERS_PER_GAME = 15;

export const AMBER_PRICE = 40;
export const RED_PRICE = 60;

export function orderPriceTier(price: number): 'sage' | 'amber' | 'red' {
    return price >= RED_PRICE ? 'red' : price >= AMBER_PRICE ? 'amber' : 'sage';
}

/** 完成整局所有订单时发放一次。 */
export const ALL_ORDERS_BONUS = 100;
/** 下标即同回合出餐次数，达到该次数时发放一次。 */
export const SERVE_COMBO_BONUSES: readonly number[] = [0, 0, 20, 30, 50];

export const ORDER_REFRESH_START_PRICE = 10;
export const ORDER_REFRESH_PRICE_STEP = 10;

/** 游戏初始删除机会 */
export const DELETE_CHANCE_START = 1;

/** 删除机会累计上限 */
export const DELETE_CHANCE_MAX = 2;

/** 每完成多少个完整回合奖励 1 次删除机会 */
export const DELETE_CHANCE_TURN_INTERVAL = 6;
