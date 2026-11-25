/** 自由堆叠只检查容量。食谱匹配在出餐时进行。 */

import { FoodType } from './FoodType';
import { MAX_LAYERS } from './GameConfig';

export type PlaceRejection = 'plate-full';

export interface PlaceCheckResult {
    ok: boolean;
    reason?: PlaceRejection;
}

export function canPlaceFood(plateFoods: FoodType[]): PlaceCheckResult {
    if (plateFoods.length >= MAX_LAYERS) {
        return { ok: false, reason: 'plate-full' };
    }
    return { ok: true };
}
