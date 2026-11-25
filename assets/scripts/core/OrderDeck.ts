import { ALL_FOOD_TYPES, FoodType } from './FoodType';
import { STARTING_STOCK } from './FoodGenerator';
import { ORDERS_PER_GAME, orderPriceTier } from './GameConfig';
import { RECIPES, RecipeDef } from './Recipe';

export const MAX_ORDERS = RECIPES.length * 2;
export const TOTAL_ORDERS = limitCount(ORDERS_PER_GAME);

interface PriceGroup {
    recipes: RecipeDef[];
    quota: number;
}

function limitCount(count: number): number {
    return Math.max(0, Math.min(MAX_ORDERS, Math.trunc(count)));
}

function shuffle<T>(items: T[], rng: () => number): T[] {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

function reserve(stock: Record<FoodType, number>, recipe: RecipeDef): void {
    for (const food of [...recipe.head, ...recipe.middle, ...recipe.tail]) stock[food]--;
}

function pickWithinStock(groups: PriceGroup[], stock: Record<FoodType, number>,
    groupIndex = 0, start = 0, needed = groups[0].quota): RecipeDef[] | null {
    if (needed === 0) {
        const next = groups[groupIndex + 1];
        return next ? pickWithinStock(groups, stock, groupIndex + 1, 0, next.quota) : [];
    }
    const { recipes } = groups[groupIndex];
    for (let i = start; i <= recipes.length - needed; i++) {
        const recipe = recipes[i];
        const remaining = { ...stock };
        reserve(remaining, recipe);
        if (ALL_FOOD_TYPES.some((food) => remaining[food] < 0)) continue;
        const rest = pickWithinStock(groups, remaining, groupIndex, i + 1, needed - 1);
        if (rest) return [recipe, ...rest];
    }
    return null;
}

export function createOrderDeck(rng: () => number = Math.random, count = TOTAL_ORDERS): RecipeDef[] {
    const total = limitCount(count);
    const firstPass = total >= RECIPES.length ? RECIPES.slice() : [];
    const drawCount = total - firstPass.length;
    if (drawCount === 0) return shuffle(firstPass, rng);

    const tiers = ['sage', 'amber', 'red'] as const;
    const groups = shuffle(tiers.map((tier): PriceGroup => {
        const recipes = shuffle(RECIPES.filter((recipe) => orderPriceTier(recipe.score) === tier), rng);
        return { recipes, quota: Math.min(recipes.length, Math.floor(drawCount / tiers.length)) };
    }), rng);
    let assigned = groups.reduce((sum, group) => sum + group.quota, 0);
    while (assigned < drawCount) {
        const next = groups.filter((group) => group.quota < group.recipes.length)
            .sort((a, b) => a.quota - b.quota)[0];
        next.quota++;
        assigned++;
    }

    const remaining = { ...STARTING_STOCK };
    for (const recipe of firstPass) reserve(remaining, recipe);
    // Prefer a stock-compatible selection. The configured ticket count and tier
    // quotas still apply when the fixed food supply cannot cover a larger deck.
    let orders = pickWithinStock(groups, remaining);
    if (!orders) {
        orders = [];
        for (const { recipes, quota } of groups) orders.push(...recipes.slice(0, quota));
    }
    return shuffle([...firstPass, ...orders], rng);
}
