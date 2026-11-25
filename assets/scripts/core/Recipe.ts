/**
 * 食谱定义与匹配。纯规则模块，不依赖 Cocos。
 *
 * 每个食谱建模为：固定顺序的头部 head + 顺序不限的中段 middle（多重集）+ 固定顺序的尾部 tail。
 * 完整成品 = head + middle 的任意排列 + tail，顺序统一为自下而上。
 * 固定顺序食谱的 middle 为空。
 */

import { FoodType } from './FoodType';

export interface RecipeDef {
    id: string;
    nameZh: string;
    nameEn: string;
    /** 固定顺序前缀（自下而上） */
    head: FoodType[];
    /** 顺序不限的中段食材（多重集，可含重复食材） */
    middle: FoodType[];
    /** 固定顺序后缀（自下而上） */
    tail: FoodType[];
    /** 完成订单得分 */
    score: number;
}

export const RECIPES: RecipeDef[] = [
    {
        id: 'Cheeseburger',
        nameZh: '芝士牛堡',
        nameEn: 'Cheeseburger',
        head: [FoodType.BurgerBun],
        middle: [FoodType.Patty, FoodType.Cheese],
        tail: [FoodType.BurgerBun],
        score: 40,
    },
    {
        id: 'BigMac',
        nameZh: '巨无霸',
        nameEn: 'Big Mac',
        head: [FoodType.BurgerBun],
        middle: [FoodType.Tomato, FoodType.Lettuce, FoodType.Patty, FoodType.Cheese],
        tail: [FoodType.BurgerBun],
        score: 70,
    },
    {
        id: 'GardenBurger',
        nameZh: '田园堡',
        nameEn: 'Garden Burger',
        head: [FoodType.BurgerBun],
        middle: [FoodType.Lettuce, FoodType.Tomato, FoodType.Patty],
        tail: [FoodType.BurgerBun],
        score: 50,
    },
    {
        id: 'BaconEggBurger',
        nameZh: '培根煎蛋堡',
        nameEn: 'Bacon Egg Burger',
        head: [FoodType.BurgerBun],
        middle: [FoodType.FriedEgg, FoodType.Bacon],
        tail: [FoodType.BurgerBun],
        score: 50,
    },
    {
        id: 'MeatLoversBurger',
        nameZh: '食肉男孩',
        nameEn: 'Meat Lovers Burger',
        head: [FoodType.BurgerBun],
        middle: [FoodType.Patty, FoodType.Bacon, FoodType.FriedEgg],
        tail: [FoodType.BurgerBun],
        score: 60,
    },
    {
        id: 'VegetarianSandwich',
        nameZh: '素食三明治',
        nameEn: 'Vegetarian Sandwich',
        head: [FoodType.BurgerBun],
        middle: [FoodType.Cheese, FoodType.Lettuce, FoodType.Tomato],
        tail: [FoodType.BurgerBun],
        score: 50,
    },
    {
        id: 'BasicBeefBurger',
        nameZh: '牛宝',
        nameEn: 'Basic Beef Burger',
        head: [FoodType.BurgerBun, FoodType.Patty],
        middle: [],
        tail: [FoodType.BurgerBun],
        score: 30,
    },
    {
        id: 'DoubleBurger',
        nameZh: '双层汉堡',
        nameEn: 'Double Burger',
        head: [FoodType.BurgerBun, FoodType.Patty, FoodType.BurgerBun, FoodType.Patty],
        middle: [],
        tail: [FoodType.BurgerBun],
        score: 80,
    },
    {
        id: 'Salad',
        nameZh: '沙拉',
        nameEn: 'Salad',
        head: [],
        middle: [FoodType.Lettuce, FoodType.Tomato],
        tail: [],
        score: 20,
    },
    {
        id: 'CapreseSalad',
        nameZh: '番茄奶酪沙拉',
        nameEn: 'Caprese Salad',
        head: [FoodType.Tomato, FoodType.Cheese],
        middle: [],
        tail: [FoodType.Tomato],
        score: 35,
    },
    {
        id: 'BaconAndEgg',
        nameZh: '培根煎蛋',
        nameEn: 'Bacon and Egg',
        head: [],
        middle: [FoodType.Bacon, FoodType.FriedEgg],
        tail: [],
        score: 35,
    },
    {
        id: 'TomatoAndEgg',
        nameZh: '西红柿炒蛋',
        nameEn: 'Tomato and Egg',
        head: [],
        middle: [FoodType.Tomato, FoodType.FriedEgg],
        tail: [],
        score: 25,
    },
];

export function recipeLayerCount(recipe: RecipeDef): number {
    return recipe.head.length + recipe.middle.length + recipe.tail.length;
}

/** 多重集 Jaccard 相似度。同种食材的每一份单独计数，忽略叠放顺序。 */
export function ingredientSimilarity(a: RecipeDef, b: RecipeDef): number {
    const unmatched = [...b.head, ...b.middle, ...b.tail];
    let shared = 0;
    for (const food of [...a.head, ...a.middle, ...a.tail]) {
        const index = unmatched.indexOf(food);
        if (index < 0) continue;
        unmatched.splice(index, 1);
        shared++;
    }
    const total = recipeLayerCount(a) + unmatched.length;
    return total === 0 ? 1 : shared / total;
}

/** 生成数组的全排列（保留重复项的排列，输入长度 <= 4，规模可控） */
function permutations<T>(items: T[]): T[][] {
    if (items.length <= 1) return [items.slice()];
    const result: T[][] = [];
    for (let i = 0; i < items.length; i++) {
        const rest = items.slice(0, i).concat(items.slice(i + 1));
        for (const perm of permutations(rest)) {
            result.push([items[i], ...perm]);
        }
    }
    return result;
}

function startsWith(stack: FoodType[], prefix: FoodType[]): boolean {
    if (prefix.length > stack.length) return false;
    for (let i = 0; i < prefix.length; i++) {
        if (stack[i] !== prefix[i]) return false;
    }
    return true;
}

/**
 * 严格匹配（Exact Match）：盘子全部食材恰好构成该食谱。
 * 固定首尾按顺序比对，中段为 middle 多重集的一个排列。
 */
export function isExactMatch(stack: FoodType[], recipe: RecipeDef): boolean {
    const total = recipeLayerCount(recipe);
    if (stack.length !== total) return false;
    if (!startsWith(stack, recipe.head)) return false;
    const tailStart = total - recipe.tail.length;
    for (let i = 0; i < recipe.tail.length; i++) {
        if (stack[tailStart + i] !== recipe.tail[i]) return false;
    }
    const midSection = stack.slice(recipe.head.length, tailStart);
    return isPermutationOf(midSection, recipe.middle);
}

/** a 是否为多重集 b 的一个排列 */
function isPermutationOf(a: FoodType[], b: FoodType[]): boolean {
    if (a.length !== b.length) return false;
    const pool = b.slice();
    for (const item of a) {
        const idx = pool.indexOf(item);
        if (idx < 0) return false;
        pool.splice(idx, 1);
    }
    return true;
}

/**
 * 合法未完成结构判断：stack（自下而上）是否是该食谱某个完整成品序列的前缀。
 * 完整成品本身也算（前缀长度为全长）。
 */
export function isLegalUnfinished(stack: FoodType[], recipe: RecipeDef): boolean {
    const total = recipeLayerCount(recipe);
    if (stack.length > total) return false;
    for (const midPerm of permutations(recipe.middle)) {
        const full = [...recipe.head, ...midPerm, ...recipe.tail];
        if (startsWith(full, stack)) return true;
    }
    return false;
}

/** stack 是否至少是某种食谱的合法未完成结构 */
export function isLegalUnfinishedForAnyRecipe(stack: FoodType[]): boolean {
    return RECIPES.some((r) => isLegalUnfinished(stack, r));
}

/** 找出与 stack 严格匹配的全部食谱（正常情况最多一个，防御性返回数组） */
export function findExactMatches(stack: FoodType[]): RecipeDef[] {
    return RECIPES.filter((r) => isExactMatch(stack, r));
}
