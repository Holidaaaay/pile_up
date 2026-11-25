/** 从仓库队列顶部抽取食材，清盘回收后可重新洗牌。 */

import { ALL_FOOD_TYPES, FoodType } from './FoodType';

export const PILE_SIZES = [2, 3, 4] as const;
export const STARTING_STOCK: Readonly<Record<FoodType, number>> = {
    [FoodType.BurgerBun]: 27,
    [FoodType.Patty]: 11,
    [FoodType.Tomato]: 13,
    [FoodType.Lettuce]: 8,
    [FoodType.Cheese]: 7,
    [FoodType.FriedEgg]: 6,
    [FoodType.Bacon]: 5,
};

export function createFoodDeck(rng: () => number = Math.random): FoodType[] {
    const deck: FoodType[] = [];
    for (const food of ALL_FOOD_TYPES) {
        for (let i = 0; i < STARTING_STOCK[food]; i++) deck.push(food);
    }
    shuffleFoodDeck(deck, rng);
    return deck;
}

export function shuffleFoodDeck(deck: FoodType[], rng: () => number): void {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

export function drawPile(deck: FoodType[], size: number): FoodType[] {
    const pile: FoodType[] = [];
    while (pile.length < size && deck.length > 0) pile.push(deck.pop()!);
    return pile;
}
