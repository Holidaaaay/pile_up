/**
 * 盘子数据：一个盘子最多容纳 MAX_LAYERS 层食材，自下而上存储。
 */

import { FoodType } from './FoodType';
import { MAX_LAYERS } from './GameConfig';
import { canPlaceFood } from './PlacementValidator';

export { MAX_LAYERS };

export class PlateState {
    /** 自下而上的食材堆叠 */
    readonly foods: FoodType[] = [];

    get isEmpty(): boolean {
        return this.foods.length === 0;
    }

    get layerCount(): number {
        return this.foods.length;
    }

    get isFull(): boolean {
        return this.foods.length >= MAX_LAYERS;
    }

    canPlace(): boolean {
        return canPlaceFood(this.foods).ok;
    }

    /** 放置成功返回 true；调用方应先用 canPlace 判断 */
    push(food: FoodType): boolean {
        if (!this.canPlace()) return false;
        this.foods.push(food);
        return true;
    }

    clear(): void {
        this.foods.length = 0;
    }
}
