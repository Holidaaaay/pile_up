import { FOOD_INFO, FoodType } from '../core/FoodType';

/** 填写引号中的介绍，一条占一行，用逗号隔开。留空时厨师只说食材名。 */
export const FOOD_STORIES: Readonly<Record<FoodType, readonly string[]>> = {
    [FoodType.BurgerBun]: [
        // '在这里写第一条汉堡胚介绍。',
        // '在这里写第二条汉堡胚介绍。',
    ],
    [FoodType.Patty]: [],
    [FoodType.Tomato]: [],
    [FoodType.Lettuce]: [],
    [FoodType.Cheese]: [],
    [FoodType.FriedEgg]: [],
    [FoodType.Bacon]: [],
};

export function pickFoodStory(food: FoodType, previous?: string): string {
    const lines = [...new Set(FOOD_STORIES[food].map((line) => line.trim()).filter(Boolean))];
    if (lines.length === 0) return FOOD_INFO[food].nameZh;
    const candidates = lines.length > 1 ? lines.filter((line) => line !== previous) : lines;
    return candidates[Math.floor(Math.random() * candidates.length)];
}
