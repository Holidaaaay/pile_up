/**
 * 食材类型定义。纯数据模块，不依赖 Cocos。
 */

export enum FoodType {
    BurgerBun = 'BurgerBun',
    Patty = 'Patty',
    Tomato = 'Tomato',
    Lettuce = 'Lettuce',
    Cheese = 'Cheese',
    FriedEgg = 'FriedEgg',
    Bacon = 'Bacon',
}

export const ALL_FOOD_TYPES: FoodType[] = [
    FoodType.BurgerBun,
    FoodType.Patty,
    FoodType.Tomato,
    FoodType.Lettuce,
    FoodType.Cheese,
    FoodType.FriedEgg,
    FoodType.Bacon,
];

export interface FoodInfo {
    type: FoodType;
    nameZh: string;
    nameEn: string;
    /** 扁平卡通配色（十六进制） */
    color: string;
}

export const FOOD_INFO: Record<FoodType, FoodInfo> = {
    [FoodType.BurgerBun]: { type: FoodType.BurgerBun, nameZh: '汉堡胚', nameEn: 'Burger Bun', color: '#E8A952' },
    [FoodType.Patty]: { type: FoodType.Patty, nameZh: '肉饼', nameEn: 'Patty', color: '#8B5A2B' },
    [FoodType.Tomato]: { type: FoodType.Tomato, nameZh: '番茄', nameEn: 'Tomato', color: '#E5533D' },
    [FoodType.Lettuce]: { type: FoodType.Lettuce, nameZh: '生菜', nameEn: 'Lettuce', color: '#7FBF4D' },
    [FoodType.Cheese]: { type: FoodType.Cheese, nameZh: '芝士', nameEn: 'Cheese', color: '#F5C542' },
    [FoodType.FriedEgg]: { type: FoodType.FriedEgg, nameZh: '煎蛋', nameEn: 'Fried Egg', color: '#FDF6E3' },
    [FoodType.Bacon]: { type: FoodType.Bacon, nameZh: '培根', nameEn: 'Bacon', color: '#C96A50' },
};
