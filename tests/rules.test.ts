/**
 * 核心规则单元测试（不经过 Cocos，直接 node 运行）。
 * 覆盖任务书阶段 6 中属于逻辑层的验收项。
 */

import { ALL_FOOD_TYPES, FoodType as F } from '../assets/scripts/core/FoodType';
import {
    RECIPES,
    ingredientSimilarity,
    isExactMatch,
    isLegalUnfinished,
    isLegalUnfinishedForAnyRecipe,
    findExactMatches,
} from '../assets/scripts/core/Recipe';
import { canPlaceFood } from '../assets/scripts/core/PlacementValidator';
import { GameManager } from '../assets/scripts/core/GameManager';
import { ALL_ORDERS_BONUS, DELETE_CHANCE_MAX, DELETE_CHANCE_START, DELETE_CHANCE_TURN_INTERVAL,
    ORDERS_PER_GAME, ORDER_COUNT, ORDER_REFRESH_PRICE_STEP, ORDER_REFRESH_START_PRICE,
    SERVE_COMBO_BONUSES, orderPriceTier } from '../assets/scripts/core/GameConfig';
import { createFoodDeck, drawPile, PILE_SIZES, STARTING_STOCK } from '../assets/scripts/core/FoodGenerator';
import { createOrderDeck, MAX_ORDERS, TOTAL_ORDERS } from '../assets/scripts/core/OrderDeck';
import { FOOD_STORIES, pickFoodStory } from '../assets/scripts/ui/FoodStories';

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean): void {
    if (cond) {
        passed++;
    } else {
        failed++;
        console.error(`FAIL: ${name}`);
    }
}

function recipeById(id: string) {
    const r = RECIPES.find((x) => x.id === id);
    if (!r) throw new Error(`recipe ${id} not found`);
    return r;
}

// ---------- 1. 严格匹配：固定顺序食谱 ----------
check('牛宝 匹配', isExactMatch([F.BurgerBun, F.Patty, F.BurgerBun], recipeById('BasicBeefBurger')));
check('双层汉堡 匹配', isExactMatch([F.BurgerBun, F.Patty, F.BurgerBun, F.Patty, F.BurgerBun], recipeById('DoubleBurger')));
check('意大利番茄奶酪沙拉 匹配', isExactMatch([F.Tomato, F.Cheese, F.Tomato], recipeById('CapreseSalad')));
check('意大利番茄奶酪沙拉 顺序错误 不匹配', !isExactMatch([F.Cheese, F.Tomato, F.Tomato], recipeById('CapreseSalad')));

// ---------- 2. 严格匹配：中段乱序食谱 ----------
check('沙拉 生菜番茄', isExactMatch([F.Lettuce, F.Tomato], recipeById('Salad')));
check('沙拉 番茄生菜', isExactMatch([F.Tomato, F.Lettuce], recipeById('Salad')));
check('培根煎蛋 两种顺序', isExactMatch([F.Bacon, F.FriedEgg], recipeById('BaconAndEgg')) && isExactMatch([F.FriedEgg, F.Bacon], recipeById('BaconAndEgg')));
check('西红柿炒蛋 两种顺序', isExactMatch([F.Tomato, F.FriedEgg], recipeById('TomatoAndEgg')) && isExactMatch([F.FriedEgg, F.Tomato], recipeById('TomatoAndEgg')));

// 巨无霸：中段 4 种食材的全部 24 种排列都必须匹配
function permutations<T>(items: T[]): T[][] {
    if (items.length <= 1) return [items.slice()];
    const out: T[][] = [];
    for (let i = 0; i < items.length; i++) {
        const rest = items.slice(0, i).concat(items.slice(i + 1));
        for (const p of permutations(rest)) out.push([items[i], ...p]);
    }
    return out;
}
const bigMac = recipeById('BigMac');
const cheeseburger = recipeById('Cheeseburger');
check('芝士牛堡两片汉堡胚之间的肉饼、芝士可交换', permutations([F.Patty, F.Cheese]).every((middle) =>
    isExactMatch([F.BurgerBun, ...middle, F.BurgerBun], cheeseburger)));
check('芝士牛堡要求汉堡胚在底层和顶层', !isExactMatch([F.Cheese, F.BurgerBun, F.Patty, F.BurgerBun], cheeseburger) &&
    !isExactMatch([F.BurgerBun, F.Patty, F.BurgerBun, F.Cheese], cheeseburger));
check('芝士牛堡仍需要两个胚，不能用第二片芝士代替', !isExactMatch([F.BurgerBun, F.Patty, F.Cheese, F.Cheese], cheeseburger));
const meatLovers = recipeById('MeatLoversBurger');
check('食肉男孩售价 60，三种夹馅全部六种排列可出餐', meatLovers.score === 60 &&
    permutations([F.Patty, F.Bacon, F.FriedEgg]).every((middle) =>
        isExactMatch([F.BurgerBun, ...middle, F.BurgerBun], meatLovers)));
check('食肉男孩需要两片面包在两端，且夹馅不可重复代替',
    !isExactMatch([F.BurgerBun, F.Patty, F.BurgerBun, F.Bacon, F.FriedEgg], meatLovers) &&
    !isExactMatch([F.BurgerBun, F.Patty, F.Patty, F.FriedEgg, F.BurgerBun], meatLovers));
const bigMacMiddles = permutations([F.Tomato, F.Lettuce, F.Patty, F.Cheese]);
check('巨无霸 24 种中段排列全部匹配', bigMacMiddles.length === 24 && bigMacMiddles.every((m) => isExactMatch([F.BurgerBun, ...m, F.BurgerBun], bigMac)));
check('巨无霸 中段食材错误(缺番茄) 不匹配', !isExactMatch([F.BurgerBun, F.Lettuce, F.Patty, F.Cheese, F.BurgerBun], bigMac));
check('巨无霸 5层 不匹配', !isExactMatch([F.BurgerBun, F.Patty, F.Cheese, F.BurgerBun], bigMac));
check('培根煎蛋堡 两种中段顺序', isExactMatch([F.BurgerBun, F.FriedEgg, F.Bacon, F.BurgerBun], recipeById('BaconEggBurger')) && isExactMatch([F.BurgerBun, F.Bacon, F.FriedEgg, F.BurgerBun], recipeById('BaconEggBurger')));
const garden = recipeById('GardenBurger');
check('田园堡接受全部 6 种中段排列', permutations([F.Lettuce, F.Tomato, F.Patty]).every((middle) =>
    isExactMatch([F.BurgerBun, ...middle, F.BurgerBun], garden)));
check('田园堡不接受用芝士替代肉饼', !isExactMatch([F.BurgerBun, F.Lettuce, F.Tomato, F.Cheese, F.BurgerBun], garden));
check('素食三明治 中段乱序', isExactMatch([F.BurgerBun, F.Tomato, F.Cheese, F.Lettuce, F.BurgerBun], recipeById('VegetarianSandwich')));

// ---------- 3. 严格匹配：不能有多余食材 ----------
check('牛宝+多余芝士 不匹配牛宝', !isExactMatch([F.BurgerBun, F.Patty, F.Cheese, F.BurgerBun], recipeById('BasicBeefBurger')));
check('空盘子 不匹配任何食谱', findExactMatches([]).length === 0);

// ---------- 4. 合法未完成结构 ----------
check('空盘子 合法(可开始)', isLegalUnfinishedForAnyRecipe([]));
check('[汉堡胚] 合法', isLegalUnfinishedForAnyRecipe([F.BurgerBun]));
check('[汉堡胚,肉饼] 合法(可完成牛宝/芝士牛堡等)', isLegalUnfinishedForAnyRecipe([F.BurgerBun, F.Patty]));
check('[汉堡胚,肉饼,芝士] 合法未完成芝士牛堡', isLegalUnfinished([F.BurgerBun, F.Patty, F.Cheese], recipeById('Cheeseburger')));
check('[汉堡胚,芝士] 合法(巨无霸中段可从芝士开始)', isLegalUnfinished([F.BurgerBun, F.Cheese], bigMac));
check('[汉堡胚,芝士,肉饼] 合法(巨无霸中段乱序)', isLegalUnfinished([F.BurgerBun, F.Cheese, F.Patty], bigMac));
check('[生菜] 合法(沙拉前缀)', isLegalUnfinishedForAnyRecipe([F.Lettuce]));
check('[生菜,番茄] 合法(沙拉成品)', isLegalUnfinishedForAnyRecipe([F.Lettuce, F.Tomato]));
check('[番茄,芝士] 合法(Caprese前缀)', isLegalUnfinishedForAnyRecipe([F.Tomato, F.Cheese]));
check('[番茄,生菜,芝士] 非法', !isLegalUnfinishedForAnyRecipe([F.Tomato, F.Lettuce, F.Cheese]));
check('巨无霸 底部汉堡胚后可放中段任意一种', isLegalUnfinishedForAnyRecipe([F.BurgerBun, F.Tomato]) && isLegalUnfinishedForAnyRecipe([F.BurgerBun, F.Cheese]) && isLegalUnfinishedForAnyRecipe([F.BurgerBun, F.Patty]) && isLegalUnfinishedForAnyRecipe([F.BurgerBun, F.Lettuce]));
check('巨无霸 中段不允许重复肉饼', !isLegalUnfinished([F.BurgerBun, F.Patty, F.Patty], bigMac));
check('巨无霸 中段放完才能放顶胚: 缺一种放顶胚非法', !isLegalUnfinished([F.BurgerBun, F.Tomato, F.Lettuce, F.Patty, F.BurgerBun], bigMac));
check('巨无霸 中段放完放顶胚合法', isLegalUnfinished([F.BurgerBun, F.Tomato, F.Lettuce, F.Patty, F.Cheese, F.BurgerBun], bigMac));

// ---------- 5. 已完成的盘子不能随意扩展 ----------
const doneBurger = [F.BurgerBun, F.Patty, F.Cheese, F.BurgerBun];
check('完成的芝士牛堡本身是合法结构', isLegalUnfinishedForAnyRecipe(doneBurger));
check('完成的芝士牛堡上不能再放肉饼', !isLegalUnfinishedForAnyRecipe([...doneBurger, F.Patty]));
check('完成的牛宝上不能再放生菜', !isLegalUnfinishedForAnyRecipe([F.BurgerBun, F.Patty, F.BurgerBun, F.Lettuce]));

// ---------- 6. 放置限制 ----------
{
    const gm = new GameManager(() => 0);
    gm.hand = [F.Cheese, F.Patty, F.Patty, F.Lettuce];
    check('芝士可以放空盘', gm.placeFromHand(0, 0).ok);
    check('肉饼可以放空盘', gm.placeFromHand(0, 1).ok);
    check('重复食材可以堆在一起', gm.placeFromHand(0, 1).ok);
    check('废料盘可以继续叠，但不能冒充成品出餐', gm.placeFromHand(0, 1).ok &&
        gm.plates[1].foods.join() === [F.Patty, F.Patty, F.Lettuce].join() &&
        gm.orders.every((_, order) => !gm.canSubmitOrder(order, 1)));
}
// 满 6 层盘子（完成的巨无霸）不能再放
const fullPlate = [F.BurgerBun, F.Tomato, F.Lettuce, F.Patty, F.Cheese, F.BurgerBun];
check('6 层盘子已满', !canPlaceFood(fullPlate).ok && canPlaceFood(fullPlate).reason === 'plate-full');

// ---------- 7. 食材堆生成 ----------
{
    const stock = ALL_FOOD_TYPES.map((food) => [food, STARTING_STOCK[food]] as const);
    const deck = createFoodDeck(() => 0.4);
    check('固定牌库保留每种食材数量且总数为 77', deck.length === 77 &&
        stock.every(([food, count]) => deck.filter((card) => card === food).length === count));
    check('七种食材数量均不同，汉堡胚最多', new Set(stock.map(([, count]) => count)).size === 7 &&
        stock.every(([food, count]) => food === F.BurgerBun || count < STARTING_STOCK[F.BurgerBun]));
    check('抽牌从牌库顶取，不打乱剩余顺序', drawPile(deck, 3).join() === createFoodDeck(() => 0.4).slice(-3).reverse().join());
    const lastCards = [F.Patty, F.Cheese];
    check('剩余食材不足时，只抽剩下的食材', drawPile(lastCards, 4).join() === [F.Cheese, F.Patty].join() &&
        drawPile(lastCards, 2).length === 0);
}

// ---------- 8. GameManager：拿取与放置 ----------
{
    const gm = new GameManager(() => 0);
    check('左中右初始食材依次为 2、3、4 件', gm.piles.map((pile) => pile.length).join() === PILE_SIZES.join());
    check('初始三个订单', gm.orders.length === 3);
    check('开局订单不重复', new Set(gm.orders.map((order) => order.id)).size === 3);
    check('初始删除机会符合配置', gm.deleteChances === DELETE_CHANCE_START);
    check('回合从 1 开始', gm.turn === 1);
    check('未拿取食材堆时不能结束回合（即使手牌为空）', !gm.canEndTurn() && gm.endTurn().ok === false);

    // 固定一堆内容以便断言
    gm.piles[1] = [F.BurgerBun, F.Patty, F.Tomato];
    const r0 = gm.takePile(1);
    check('拿取成功', r0.ok);
    check('hand 获得整堆 3 个食材', gm.hand.length === 3);
    check('拿取中篮后仍补 3 件', gm.piles[1].length === 3);
    check('hand 未放完时不能再拿', !gm.canTakePile() && !gm.takePile(0).ok);
    check('hand 未放完时不能结束回合', !gm.canEndTurn() && !gm.endTurn().ok);

    // 拆分到不同盘子：汉堡胚→盘0，肉饼→盘0顶，番茄→盘1
    // 拆分到不同盘子：汉堡胚→盘0，肉饼→盘0顶，番茄→盘1
    check('放置 汉堡胚→盘0', gm.placeFromHand(0, 0).ok);
    check('放置 肉饼→盘0', gm.placeFromHand(0, 0).ok);
    check('放置 番茄→盘1（拆分）', gm.placeFromHand(0, 1).ok);
    check('hand 已空', gm.hand.length === 0);
    check('本回合已取过一篮，即使手牌为空也不能再次拿取', !gm.canTakePile() && !gm.takePile(1).ok);
    check('盘0 = [汉堡胚,肉饼]', gm.plates[0].foods.length === 2 && gm.plates[0].foods[1] === F.Patty);
    check('盘1 = [番茄]', gm.plates[1].foods.length === 1);

    check('放完后可结束回合', gm.endTurn().ok && gm.turn === 2);
    check('下一回合可以拿取新的一篮', gm.canTakePile());
    check('新回合重置"已拿取"标记，不能直接结束', !gm.canEndTurn() && gm.endTurn().ok === false);
}

// ---------- 9. GameManager：订单提交 ----------
{
    const gm = new GameManager(() => 0);
    gm.orders[0] = recipeById('BasicBeefBurger');
    gm.plates[0].foods.push(F.BurgerBun, F.Patty, F.BurgerBun);
    check('盘子恰好匹配订单 可提交', gm.canSubmitOrder(0, 0));
    const scoreBefore = gm.score;
    const turnBefore = gm.turn;
    check('提交成功', gm.submitOrder(0, 0).ok);
    check('提交后加分', gm.score === scoreBefore + recipeById('BasicBeefBurger').score);
    check('提交后盘子清空', gm.plates[0].isEmpty);
    check('提交后订单被替换', gm.orders[0].id !== 'BasicBeefBurger');
    check('替换后仍然没有重复订单', new Set(gm.orders.map((order) => order.id)).size === 3);
    check('提交订单不结束回合', gm.turn === turnBefore);

    // 严格匹配：多一层食材不能提交
    gm.orders[1] = recipeById('BasicBeefBurger');
    gm.plates[1].foods.push(F.BurgerBun, F.Patty, F.Cheese, F.BurgerBun);
    check('含多余食材 不可提交', !gm.canSubmitOrder(1, 1) && !gm.submitOrder(1, 1).ok);
    check('提交失败后盘子保留', gm.plates[1].foods.length === 4);
}

// ---------- 10. GameManager：删除 ----------
{
    const gm = new GameManager();
    gm.deleteChances = 1;
    check('可进入删除模式', gm.enterDeleteMode().ok && gm.deleteMode);
    check('删除空盘子被拒绝且不消耗机会', !gm.deletePlate(0).ok && gm.deleteChances === 1 && gm.deleteMode);
    gm.cancelDeleteMode();
    check('取消删除模式不消耗机会', !gm.deleteMode && gm.deleteChances === 1);

    gm.plates[2].foods.push(F.BurgerBun, F.Patty);
    const stockBeforeClear = gm.unstockedCount;
    const bunsBeforeClear = gm.getRemainingFoodCounts().get(F.BurgerBun)!;
    const basketsBeforeClear = JSON.stringify(gm.piles);
    gm.enterDeleteMode();
    check('删除非空盘子成功', gm.deletePlate(2).ok);
    check('删除后盘子清空', gm.plates[2].isEmpty);
    check('清盘食材归还仓库，库存计数恢复，现有篮子保留', gm.unstockedCount === stockBeforeClear + 2 &&
        gm.getRemainingFoodCounts().get(F.BurgerBun) === bunsBeforeClear + 1 && JSON.stringify(gm.piles) === basketsBeforeClear);
    check('删除消耗 1 次机会并退出删除模式', gm.deleteChances === 0 && !gm.deleteMode);
    check('没有删除机会时不能再进入删除模式', !gm.enterDeleteMode().ok);
    check('删除不结束回合', gm.turn === 1);
}

{
    const gm = new GameManager(() => 0);
    gm['foodDeck'] = [F.FriedEgg, F.Lettuce, F.Tomato];
    gm.plates[0].foods.push(F.Bacon);
    gm.enterDeleteMode();
    check('回收空盘不会洗仓库', !gm.deletePlate(1).ok &&
        gm['foodDeck'].join() === [F.FriedEgg, F.Lettuce, F.Tomato].join());
    check('回收同时洗乱原库存和新返回的食材', gm.deletePlate(0).ok &&
        gm['foodDeck'].join() === [F.Lettuce, F.Tomato, F.Bacon, F.FriedEgg].join());
    check('回收后的食材可在下一次补篮抽到', gm.takePile(0).ok &&
        gm.piles[0].join() === [F.FriedEgg, F.Bacon].join());
}

{
    const gm = new GameManager();
    gm['foodDeck'] = [];
    gm.piles = [[], [], []];
    gm.tookPileThisTurn = true;
    gm.plates[0].foods.push(F.Bacon, F.Patty, F.Patty);
    check('库存耗尽时仍可清盘回收', gm.suppliesExhausted && gm.enterDeleteMode().ok &&
        gm.deletePlate(0).ok && gm.unstockedCount === 3 && !gm.suppliesExhausted);
    check('三篮都空时，结束回合用归还的库存重新补货', gm.endTurn().ok && !gm.gameOver &&
        gm.canTakePile() && gm.getRemainingFoodCounts().get(F.Patty) === 2 && gm.getRemainingFoodCounts().get(F.Bacon) === 1);
}

// ---------- 11. 清盘机会倒计时，满额时隐藏 ----------
{
    const gm = new GameManager();
    const interval = DELETE_CHANCE_TURN_INTERVAL;
    check('开局清盘倒计时符合配置', gm.turnsUntilDeleteRefill === (DELETE_CHANCE_START >= DELETE_CHANCE_MAX ? null : interval));
    gm.deleteChances = 0;
    const completeOneTurn = (g: GameManager) => {
        g.tookPileThisTurn = true; // 模拟"已拿取并放完一堆"的回合收尾
        g.endTurn();
    };
    for (let i = 0; i < interval - 1; i++) completeOneTurn(gm);
    check('未满补充间隔的回合数时不补清盘', gm.deleteChances === 0 && gm.turnsUntilDeleteRefill === 1);
    completeOneTurn(gm);
    check('达到间隔后补 1 次，未满额时重置倒计时', gm.deleteChances === 1 &&
        gm.turnsUntilDeleteRefill === (Number(DELETE_CHANCE_MAX) === 1 ? null : interval));
    for (let i = 0; i < (DELETE_CHANCE_MAX - 1) * interval; i++) completeOneTurn(gm);
    check('满额不显示清盘倒计时', gm.turnsUntilDeleteRefill === null);
    for (let i = 0; i < interval; i++) completeOneTurn(gm);
    check('达到清盘次数上限后不再增加', gm.deleteChances === DELETE_CHANCE_MAX);
    if (interval > 1) completeOneTurn(gm);
    gm.plates[0].push(F.Tomato);
    gm.enterDeleteMode();
    gm.deletePlate(0);
    check('用掉一次后恢复当前回合周期的倒计时', gm.deleteChances === DELETE_CHANCE_MAX - 1
        && gm.turnsUntilDeleteRefill === Math.max(1, interval - 1));
}

// ---------- 12. 失败判定 ----------
{
    const fullBigMac = [F.BurgerBun, F.Tomato, F.Lettuce, F.Patty, F.Cheese, F.BurgerBun] as F[];
    const makeGame = (rng = () => 0) => {
        const game = new GameManager(rng);
        game.orders = ['Salad', 'Cheeseburger', 'BaconAndEgg'].map(recipeById);
        return game;
    };
    const fillAll = (gm: GameManager) => {
        gm.plates[0].foods.push(...fullBigMac);
        gm.plates[1].foods.push(...fullBigMac);
        gm.plates[2].foods.push(...fullBigMac);
    };

    // 三盘全满，手牌为空可继续，出现待放置食材且没有出路才失败。
    const gm = makeGame();
    fillAll(gm);
    gm.deleteChances = 0;
    check('三盘全满但无待放食材，不立即失败', !gm.checkGameOver());
    gm.hand = [F.Cheese];
    check('三盘全满、有手牌，无法清盘或出餐 → 失败', gm.checkGameOver() && gm.gameOver);

    // 场景 B：删除能解锁（汉堡胚可以放空盘）→ 不失败；机会为 0 → 失败
    const gm2 = makeGame();
    fillAll(gm2);
    gm2.hand = [F.BurgerBun];
    gm2.deleteChances = 1;
    check('删除能解锁放置 → 不失败', !gm2.checkGameOver());
    gm2.deleteChances = 0;
    check('删除机会为 0 且无处可放 → 失败', gm2.checkGameOver());

    const lastSlot = makeGame();
    fillAll(lastSlot);
    lastSlot.plates[0].foods.pop();
    lastSlot.deleteChances = 0;
    lastSlot.piles[0] = [F.Cheese, F.Patty];
    check('还剩一格时取料不会输', lastSlot.takePile(0).ok && !lastSlot.gameOver);
    check('最后一格可放任意食材，放满后仍有手牌才打烊', lastSlot.placeFromHand(0, 0).ok &&
        lastSlot.hand[0] === F.Patty && lastSlot.gameOver);

    // 场景 C：只要有任意一种食材能放 → 不失败
    const gm3 = makeGame();
    fillAll(gm3);
    gm3.plates[2].foods.length = 0; // 盘 2 空，汉堡胚可以放置
    gm3.hand = [F.Cheese, F.BurgerBun];
    gm3.deleteChances = 0;
    check('存在合法放置位置 → 不失败', !gm3.checkGameOver());

    // 场景 D：空盘可以接住任何食材，即使没有清盘机会。
    const gm4 = makeGame();
    gm4.hand = [F.Patty];
    gm4.deleteChances = 0;
    check('只有肉饼、盘子全空，不判负且可落盘', !gm4.checkGameOver() && gm4.placeFromHand(0, 0).ok);

    // 场景 E：删除后解除卡死——有非空盘且手牌有能上空盘的食材
    const gm5 = makeGame();
    gm5.plates[0].foods.push(F.BurgerBun, F.Tomato, F.Lettuce, F.Patty, F.Cheese, F.BurgerBun);
    gm5.plates[1].foods.push(F.BurgerBun, F.Tomato, F.Lettuce, F.Patty, F.Cheese, F.BurgerBun);
    gm5.plates[2].foods.push(F.BurgerBun, F.Tomato, F.Lettuce, F.Patty, F.Cheese, F.BurgerBun);
    gm5.hand = [F.Lettuce];
    gm5.deleteChances = 1;
    check('生菜可放空盘 → 删除能解锁 → 不失败', !gm5.checkGameOver());
    gm5.enterDeleteMode();
    check('删除一个满盘后生菜可放置', gm5.deletePlate(0).ok && gm5.canPlaceFromHand(0, 0).ok);
    check('删除后不再失败', !gm5.checkGameOver());

    // 场景 F：三盘已满，但可以出餐腾出空间。
    const gm6 = makeGame(() => 0.5);
    gm6.plates[0].foods.push(...fullBigMac);
    gm6.plates[1].foods.push(...fullBigMac);
    gm6.plates[2].foods.push(...fullBigMac);
    gm6.orders[0] = bigMac;
    gm6.hand = [F.Cheese];
    gm6.deleteChances = 0;
    check('三盘全满但有可交付订单 → 不判负', !gm6.checkGameOver() && !gm6.gameOver);
    check('提交订单成功', gm6.submitOrder(0, 0).ok);
    check('提交后可在腾出的盘子放芝士', !gm6.checkGameOver() && gm6.placeFromHand(0, 0).ok);
}

// 教程复用正式局的订单和库存，只固定开局顺序。
{
    const gm = new GameManager(() => 0);
    gm.restart(true);
    check('教程前两篮可完成沙拉和牛宝', gm.piles[0].join() === [F.Lettuce, F.Tomato].join()
        && gm.piles[1].join() === [F.BurgerBun, F.Patty, F.BurgerBun].join());
    check('教程两道练习菜出现在开局订单中', gm.orders[0].id === 'Salad' && gm.orders[1].id === 'BasicBeefBurger');
    const stock = gm.getRemainingFoodCounts();
    check('教程开局保留完整库存和订单数量', ALL_FOOD_TYPES
        .every((food) => stock.get(food) === STARTING_STOCK[food])
        && gm.orders.length + gm.pendingOrderCount === TOTAL_ORDERS);
}

// ---------- 13. 重开 ----------
{
    const gm = new GameManager();
    gm.plates[0].foods.push(F.BurgerBun);
    gm.score = 100;
    gm.turn = 5;
    gm.tookPileThisTurn = true;
    gm.restart();
    check('重开后的订单不重复', new Set(gm.orders.map((order) => order.id)).size === 3);
    check('重开重置一切', gm.score === 0 && gm.turn === 1 && gm.deleteChances === DELETE_CHANCE_START && gm.plates.every((p) => p.isEmpty) && gm.hand.length === 0 && gm.piles.length === 3 && gm.orders.length === ORDER_COUNT && !gm.tookPileThisTurn);
}

// ---------- 14. 盖帽 ----------
{
    const gm = new GameManager(() => 0);
    gm.orders = [recipeById('BaconEggBurger'), garden, recipeById('Salad')];
    gm.plates[0].foods.push(F.BurgerBun);
    gm.plates[1].foods.push(F.Bacon, F.FriedEgg);
    gm.plates[2].foods.push(F.Lettuce);
    gm.hand = [F.BurgerBun];
    gm.deleteChances = 0;
    check('不能把来源盘盖到自身', !gm.checkCap(1, 1).ok);
    check('盖帽把来源从顶到底翻扣到目标上', gm.capPlate(1, 0).ok &&
        gm.plates[0].foods.join() === [F.BurgerBun, F.FriedEgg, F.Bacon].join() && gm.plates[1].isEmpty);
    check('盖帽不消耗手牌和回合', gm.hand[0] === F.BurgerBun && gm.turn === 1 && gm.score === 0);
    check('不能盖到空盘', !gm.checkCap(0, 1).ok);
    check('翻扣后仍可盖上顶胚并出餐', gm.placeFromHand(0, 0).ok && gm.submitOrder(0, 0).ok);

    gm.plates[0].foods.push(F.BurgerBun);
    gm.plates[1].foods.push(F.Lettuce, F.Tomato);
    gm.hand = [F.Patty, F.BurgerBun];
    check('沙拉翻扣到汉堡胚后可叠肉饼和顶胚做田园堡', gm.capPlate(1, 0).ok &&
        gm.placeFromHand(0, 0).ok && gm.placeFromHand(0, 0).ok && gm.canSubmitOrder(1, 0));
    gm.plates[1].foods.push(F.Bacon, F.FriedEgg);
    const overCapacity = gm.capPlate(1, 0);
    check('总层数超过 6 层时拒绝且保留原盘', overCapacity.ok === false &&
        overCapacity.reason === 'plate-full' && gm.plates[0].layerCount === 5 && gm.plates[1].layerCount === 2);
    check('允许把食材翻扣到废料盘，仍然不能出餐', gm.capPlate(1, 2).ok &&
        gm.plates[2].foods.join() === [F.Lettuce, F.FriedEgg, F.Bacon].join() &&
        gm.plates[1].isEmpty && gm.orders.every((_, order) => !gm.canSubmitOrder(order, 2)));
}

// ---------- 15. 有限库存与最终结算 ----------
{
    const gm = new GameManager(() => 0.4);
    const expected = createFoodDeck(() => 0.4);
    const expectedPiles = PILE_SIZES.map((size) => drawPile(expected, size));
    const collected: F[] = [];
    let drawOrderMatches = true;
    let sawShortRefill = false;
    let keptPlayingWithEmptyWarehouse = false;
    let refusedEmptyBasket = false;
    check('开局库存统计包含预装入篮子的 9 件', gm.unstockedCount === 68 &&
        ALL_FOOD_TYPES.every((food) => gm.getRemainingFoodCounts().get(food) === STARTING_STOCK[food]));
    while (!gm.suppliesExhausted && !gm.gameOver && collected.length < 77) {
        const index = collected.length === 0 ? 0 : gm.piles[2].length > 0 ? 2
            : gm.piles[1].length > 0 ? 1 : 0;
        if (!gm.unstockedCount) keptPlayingWithEmptyWarehouse = gm.canTakePile() || keptPlayingWithEmptyWarehouse;
        const empty = gm.piles.findIndex((pile) => pile.length === 0);
        if (empty >= 0) {
            const result = gm.takePile(empty);
            refusedEmptyBasket ||= result.ok === false && result.reason === 'empty-basket';
        }
        const take = gm.takePile(index);
        if (!take.ok) break;
        drawOrderMatches &&= gm.hand.join() === expectedPiles[index].join();
        expectedPiles[index] = drawPile(expected, PILE_SIZES[index]);
        drawOrderMatches &&= gm.piles[index].join() === expectedPiles[index].join();
        sawShortRefill ||= gm.piles[index].length > 0 && gm.piles[index].length < PILE_SIZES[index];
        collected.push(...gm.hand);
        if (gm.suppliesExhausted) {
            check('最后一篮还有手牌时不能结算', !gm.canEndTurn() && !gm.endTurn().ok && !gm.gameOver);
            break;
        }
        // 隔离库存测试与备餐难度，正常落盘后腾出测试空间。
        for (const _food of gm.hand.slice()) gm.placeFromHand(0, 0);
        gm.plates[0].clear();
        gm.endTurn();
    }
    check('每个篮子只从固定序列顶部抽牌', drawOrderMatches);
    check('尾货可以少于篮子容量且空篮不可取', sawShortRefill && refusedEmptyBasket);
    check('仓库空了还可以取走篮中剩货', keptPlayingWithEmptyWarehouse);
    check('整局实际只拿到固定的 77 件食材', collected.length === 77 &&
        ALL_FOOD_TYPES.every((food) => collected.filter((card) => card === food).length === STARTING_STOCK[food]));
    check('库存面板在仓库和篮子皆空时归零', gm.suppliesExhausted && gm.getRemainingFoodCounts().size === 0);
    for (const _food of gm.hand.slice()) gm.placeFromHand(0, 0);
    gm.orders[0] = recipeById('Salad');
    gm.plates[1].foods.push(F.Lettuce, F.Tomato);
    check('库存耗尽但最后一回合仍然可以出餐', gm.canEndTurn() && gm.submitOrder(0, 1).ok && !gm.gameOver);
    const finalTurn = gm.turn;
    check('最后一回合收摊并保留最终得分', gm.endTurn().ok && gm.gameOver &&
        gm.gameOverReason === 'out-of-stock' && gm.score === 20 && gm.turn === finalTurn);
    gm.restart();
    check('重开补满牌库并清空结算原因', gm.unstockedCount === 68 &&
        gm.piles.map((pile) => pile.length).join() === '2,3,4' && gm.gameOverReason === null);
}

// ---------- 16. 有限订单与提前收摊 ----------
{
    const tickets = createOrderDeck(() => 0.4);
    const ingredients: F[] = [];
    for (const recipe of tickets) ingredients.push(...recipe.head, ...recipe.middle, ...recipe.tail);
    check('开局只有配置的订单总数', TOTAL_ORDERS === Math.min(ORDERS_PER_GAME, MAX_ORDERS) &&
        tickets.length === TOTAL_ORDERS);
    check('每种食材的订单总需求都不超过开局供应', ALL_FOOD_TYPES.every((food) =>
        ingredients.filter((ingredient) => ingredient === food).length <= STARTING_STOCK[food]));
    const tiers = ['sage', 'amber', 'red'] as const;
    const countByTier = (deck: typeof tickets) => tiers.map((tier) =>
        deck.filter((recipe) => orderPriceTier(recipe.score) === tier).length);
    check('订单数小于菜谱总数时全部不同，余数填到有容量的价格档', [0, 1, 2, 6, 8, 10, 11].every((count) => {
        const deck = createOrderDeck(() => 0.4, count);
        const quota = countByTier(deck);
        return deck.length === count && new Set(deck.map((recipe) => recipe.id)).size === count &&
            quota.every((n) => n >= Math.floor(count / tiers.length)) && Math.max(...quota) - Math.min(...quota) <= 1;
    }));
    check('订单数等于菜谱总数时每种各一单', createOrderDeck(() => 0.4, RECIPES.length)
        .map((recipe) => recipe.id).sort().join() === RECIPES.map((recipe) => recipe.id).sort().join());
    check('超过菜谱总数时，第二轮分档抽取且每道菜至多出现两次', [13, 14, 16, 18, 21, 23].every((count) => {
        const deck = createOrderDeck(() => 0.4, count);
        const copies = RECIPES.map((recipe) => deck.filter((order) => order.id === recipe.id).length);
        const quota = countByTier(RECIPES.filter((_, index) => copies[index] === 2));
        return deck.length === count && copies.every((n) => n === 1 || n === 2) &&
            quota.every((n) => n >= Math.floor((count - RECIPES.length) / tiers.length));
    }));
    const maxDeck = createOrderDeck(() => 0.4, MAX_ORDERS + 100);
    check('订单数达到上限时每道菜恰好两张', maxDeck.length === RECIPES.length * 2 &&
        RECIPES.every((recipe) => maxDeck.filter((order) => order.id === recipe.id).length === 2));
    const combinations = new Set<string>();
    let allValid = true;
    for (let seed = 1; seed <= 200; seed++) {
        let value = seed;
        const rng = () => {
            value = (value * 48271) % 2147483647;
            return value / 2147483647;
        };
        const deck = createOrderDeck(rng, 15);
        const extras = RECIPES.filter((recipe) =>
            deck.filter((order) => order.id === recipe.id).length === 2);
        const foods: F[] = [];
        for (const recipe of deck) foods.push(...recipe.head, ...recipe.middle, ...recipe.tail);
        allValid &&= countByTier(extras).join() === '1,1,1' && deck.length === 15 &&
            RECIPES.every((r) => deck.some((order) => order.id === r.id)) && ALL_FOOD_TYPES.every((food) =>
                foods.filter((item) => item === food).length <= STARTING_STOCK[food]);
        combinations.add(extras.map((recipe) => recipe.id).join());
    }
    check('默认 15 单覆盖全部菜谱，重复的三单每档各一且满足库存', allValid && combinations.size > 1);

    const gm = new GameManager(() => 0.4);
    check('开局挂单和候补数量符合配置', gm.orders.length === ORDER_COUNT && gm.pendingOrderCount === TOTAL_ORDERS - ORDER_COUNT && gm.completedOrders === 0
        && gm.totalOrderCount === TOTAL_ORDERS);
    let keepsProgress = true;
    let shrinksAfterQueue = false;
    const served: string[] = [];
    for (let i = 0; i < TOTAL_ORDERS; i++) {
        const index = i % Math.max(1, gm.orders.length);
        const recipe = gm.orders[index];
        if (!recipe || gm.gameOver) break;
        gm.plates[0].foods.push(...recipe.head, ...recipe.middle, ...recipe.tail);
        if (!gm.submitOrder(index, 0).ok) break;
        served.push(recipe.id);
        keepsProgress &&= gm.completedOrders === i + 1 && gm.orders.length <= 3 &&
            gm.totalOrderCount === TOTAL_ORDERS &&
            new Set(gm.orders.map((order) => order.id)).size === gm.orders.length;
        shrinksAfterQueue ||= gm.pendingOrderCount === 0 && gm.orders.length === 2;
    }
    check('出餐只消耗既有订单，同屏不重复且库存守恒', keepsProgress &&
        served.slice().sort().join() === tickets.map((ticket) => ticket.id).sort().join());
    check('候补池发完后餐单槽逐渐清空', shrinksAfterQueue && gm.orders.length === 0);
    const comboTotal = tickets.reduce((sum, _, index) => sum + (SERVE_COMBO_BONUSES[index + 1] ?? 0), 0);
    check('出完全部订单，计入最后一单分数、连击及全单奖励', gm.gameOver && !gm.suppliesExhausted &&
        gm.gameOverReason === 'all-orders-served' &&
        gm.score === ALL_ORDERS_BONUS + comboTotal + tickets.reduce((sum, ticket) => sum + ticket.score, 0));
    const finishedScore = gm.score;
    check('结算后重复提交不重复奖励', !gm.submitOrder(0, 0).ok && gm.score === finishedScore);
    gm.restart();
    check('重开恢复完整的订单池', !gm.gameOver && gm.orders.length === 3 &&
        gm.pendingOrderCount === TOTAL_ORDERS - ORDER_COUNT && gm.completedOrders === 0);
}

// 同回合连续出餐，奖励在达到对应次数时到账。
{
    const gm = new GameManager(() => 0.4);
    const serve = () => {
        const recipe = gm.orders[0];
        const before = gm.score;
        gm.plates[0].foods.push(...recipe.head, ...recipe.middle, ...recipe.tail);
        const result = gm.submitOrder(0, 0);
        return result.ok ? [result.comboCount, result.comboBonus, gm.score - before - recipe.score].join() : 'failed';
    };
    const first = serve();
    check('首单无奖励，失败提交及结束回合失败都不断连击',
        first === '1,0,0' && !gm.submitOrder(0, 0).ok && !gm.endTurn().ok && serve() === '2,20,20');
    check('三连给 30、四连给 50、第五单只收菜价',
        serve() === '3,30,30' && serve() === '4,50,50' && serve() === '5,0,0');
    gm.takePile(0);
    while (gm.hand.length > 0) gm.placeFromHand(0, 1);
    check('结束回合清空连击次数', gm.endTurn().ok && serve() === '1,0,0');
    gm.restart();
    check('重开清空连击次数', serve() === '1,0,0');
}

// ---------- 17. 花费余额换单 ----------
{
    const cheese = recipeById('Cheeseburger');
    const beef = recipeById('BasicBeefBurger');
    const double = recipeById('DoubleBurger');
    const salad = recipeById('Salad');
    const egg = recipeById('BaconAndEgg');
    const gm = new GameManager();
    gm.orders = [cheese, egg, recipeById('GardenBurger')];
    gm['orderDeck'] = [egg, beef, double];
    gm.score = 100;
    check('食材相似度按份数计算，忽略上下层', ingredientSimilarity(cheese, beef) === 3 / 4 &&
        ingredientSimilarity(cheese, double) === 3 / 6 && ingredientSimilarity(cheese, egg) === 0);
    check('换单从完整食谱库找最低相似度，跳过同屏菜名，平手按食谱顺序', gm.refreshOrder(0).ok &&
        gm.orders[0] === salad && gm['orderDeck'].map((recipe) => recipe.id).join() === 'BaconAndEgg,BasicBeefBurger,DoubleBurger');
}
{
    const gm = new GameManager(() => 0.4);
    const first = gm.orders[0];
    const start = ORDER_REFRESH_START_PRICE;
    const step = ORDER_REFRESH_PRICE_STEP;
    gm.score = start - 1;
    const unaffordable = gm.refreshOrder(0);
    check('余额不足时不改订单、不涨价', unaffordable.ok === false &&
        unaffordable.reason === 'not-enough-money' && gm.orders[0] === first && gm.orderRefreshPrice === start);
    gm.score = start * 2 + step + 15;
    check('第一次换单扣初始价格并涨价', gm.refreshOrder(0).ok &&
        gm.score === start + step + 15 && gm.orderRefreshPrice === start + step && gm.orders[0].id !== first.id);
    check('第二次换单按涨价后的价格扣费', gm.refreshOrder(0).ok &&
        gm.score === 15 && gm.orderRefreshPrice === start + step * 2);
    check('换单后在场、候补和已完成数量不变', gm.orders.length === ORDER_COUNT && gm.pendingOrderCount === TOTAL_ORDERS - ORDER_COUNT &&
        gm.completedOrders === 0 && new Set(gm.orders.map((order) => order.id)).size === 3 && gm.turn === 1);
    check('无效位置不扣钱', !gm.refreshOrder(-1).ok && gm.score === 15 && gm.orderRefreshPrice === start + step * 2);
    const served: string[] = [];
    while (!gm.gameOver && served.length < TOTAL_ORDERS && gm.pendingOrderCount > 0) {
        const recipe = gm.orders[0];
        gm.plates[0].foods.push(...recipe.head, ...recipe.middle, ...recipe.tail);
        if (!gm.submitOrder(0, 0).ok) break;
        served.push(recipe.id);
    }
    const cash = gm.score;
    const lastOriginal = gm.orders[0];
    const lastPrice = gm.orderRefreshPrice;
    check('候补发完仍可从完整食谱库换单', gm.pendingOrderCount === 0 && gm.refreshOrder(0).ok &&
        gm.pendingOrderCount === 0 && gm.orders[0].id !== lastOriginal.id &&
        gm.score === cash - lastPrice && gm.orderRefreshPrice === lastPrice + step);
    while (!gm.gameOver && served.length < TOTAL_ORDERS) {
        const recipe = gm.orders[0];
        gm.plates[0].foods.push(...recipe.head, ...recipe.middle, ...recipe.tail);
        if (!gm.submitOrder(0, 0).ok) break;
        served.push(recipe.id);
    }
    check('换单保留总单数，做完换上的订单可正常结算', served.length === TOTAL_ORDERS &&
        gm.totalOrderCount === TOTAL_ORDERS && gm.gameOverReason === 'all-orders-served');
    gm.restart();
    check('重开归零余额并重置换单价格', gm.score === 0 && gm.orderRefreshPrice === start);
}

// ---------- 18. 主动结算与食材彩蛋 ----------
{
    const gm = new GameManager(() => 0.4);
    const recipe = gm.orders[0];
    gm.plates[0].foods.push(...recipe.head, ...recipe.middle, ...recipe.tail);
    gm.submitOrder(0, 0);
    gm.takePile(0);
    const score = gm.score;
    check('手上还有食材时也能主动结算并保留余额', gm.hand.length > 0 && gm.stopService().ok
        && gm.gameOver && gm.gameOverReason === 'manual-stop' && gm.score === score);
    check('主动结算后订单进度保留，且无法继续操作或再次结算', gm.completedOrders === 1
        && gm.totalOrderCount === TOTAL_ORDERS && !gm.endTurn().ok && !gm.stopService().ok);
    gm.restart();
    check('重开后订单进度归零', gm.completedOrders === 0 && gm.totalOrderCount === TOTAL_ORDERS);
}
{
    const lines = FOOD_STORIES[F.BurgerBun] as string[];
    const original = lines.splice(0);
    try {
        check('食材未填写台词时仍可介绍名称', pickFoodStory(F.BurgerBun) === '汉堡胚');
        lines.push('第一句', ' ', '第一句', '第二句');
        check('多条食材台词可轮换，忽略空行和重复内容', pickFoodStory(F.BurgerBun, '第一句') === '第二句'
            && pickFoodStory(F.BurgerBun, '第二句') === '第一句');
    } finally {
        lines.splice(0, lines.length, ...original);
    }
}

declare const process: { exit(code: number): never };

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
