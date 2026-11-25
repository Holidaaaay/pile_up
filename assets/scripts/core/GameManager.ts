/**
 * GameManager：游戏整体状态与回合流程。纯逻辑模块，不依赖 Cocos。
 *
 * 职责：
 * - 三个盘子、三堆可选食材、当前待放置食材（hand）
 * - 三个订单的生成与提交
 * - 回合推进（只有主动 endTurn 才进入下一回合）
 * - 删除机会与删除模式
 * - 分数
 * - 失败判定
 *
 * UI 通过 onStateChanged 订阅状态变化，所有规则判断都在本模块完成。
 */

import { FoodType } from './FoodType';
import { RECIPES, RecipeDef, ingredientSimilarity, isExactMatch } from './Recipe';
import { PlateState } from './Plate';
import { canPlaceFood, PlaceRejection } from './PlacementValidator';
import { createFoodDeck, drawPile, PILE_SIZES, shuffleFoodDeck } from './FoodGenerator';
import { createOrderDeck, TOTAL_ORDERS } from './OrderDeck';
import {
    ALL_ORDERS_BONUS,
    PLATE_COUNT,
    MAX_LAYERS,
    ORDER_COUNT,
    ORDER_REFRESH_START_PRICE,
    ORDER_REFRESH_PRICE_STEP,
    SERVE_COMBO_BONUSES,
    DELETE_CHANCE_START,
    DELETE_CHANCE_MAX,
    DELETE_CHANCE_TURN_INTERVAL,
} from './GameConfig';

export type GameActionResult =
    | { ok: true }
    | { ok: false; reason: string };

type OrderSubmitResult =
    | { ok: true; comboCount: number; comboBonus: number }
    | { ok: false; reason: string };

export const TUTORIAL_CAP_SOURCE = [FoodType.Cheese, FoodType.Patty] as const;
export const TUTORIAL_CAP_BASE = FoodType.BurgerBun;

export class GameManager {
    readonly plates: PlateState[] = [];
    /** 底部三堆可选食材 */
    piles: FoodType[][] = [];
    /** 当前已拿取但尚未放置的食材 */
    hand: FoodType[] = [];
    /** 顶部三个订单 */
    orders: RecipeDef[] = [];
    completedOrders = 0;
    /** 当前回合，从 1 开始 */
    turn = 1;
    score = 0;
    private turnServeCount = 0;
    orderRefreshPrice = ORDER_REFRESH_START_PRICE;
    deleteChances = DELETE_CHANCE_START;
    deleteMode = false;
    gameOver = false;
    gameOverReason: 'no-space' | 'out-of-stock' | 'all-orders-served' | 'manual-stop' | null = null;

    /** 状态变化通知（UI 订阅后整体刷新） */
    onStateChanged: (() => void) | null = null;

    private rng: () => number;
    private foodDeck: FoodType[] = [];
    private orderDeck: RecipeDef[] = [];

    /** 当前回合是否已拿取过食材堆（须拿取并放完一堆才能结束回合） */
    tookPileThisTurn = false;

    constructor(rng: () => number = Math.random) {
        this.rng = rng;
        this.restart();
    }

    private notify(): void {
        if (this.onStateChanged) this.onStateChanged();
    }

    get pendingOrderCount(): number {
        return this.orderDeck.length;
    }

    get totalOrderCount(): number {
        return this.completedOrders + this.orders.length + this.pendingOrderCount;
    }

    /** 同屏不重复。重名候补留在队列里，优先补不同于刚完成订单的菜。 */
    private fillOrderSlots(insertionIndex: number, justServed?: string): void {
        while (this.orders.length < ORDER_COUNT) {
            const isAvailable = (recipe: RecipeDef) => !this.orders.some((order) => order.id === recipe.id);
            let index = this.orderDeck.findIndex((recipe) => recipe.id !== justServed && isAvailable(recipe));
            if (index < 0) index = this.orderDeck.findIndex(isAvailable);
            if (index < 0) break;
            const [recipe] = this.orderDeck.splice(index, 1);
            this.orders.splice(insertionIndex, 0, recipe);
            insertionIndex++;
        }
    }

    // ---------- 拿取食材 ----------

    get unstockedCount(): number {
        return this.foodDeck.length;
    }

    get suppliesExhausted(): boolean {
        return this.foodDeck.length === 0 && this.piles.every((pile) => pile.length === 0);
    }

    /** 未取走的食材，包括仓库和三个篮子。 */
    getRemainingFoodCounts(): ReadonlyMap<FoodType, number> {
        const counts = new Map<FoodType, number>();
        for (const group of [this.foodDeck, ...this.piles]) {
            for (const food of group) counts.set(food, (counts.get(food) ?? 0) + 1);
        }
        return counts;
    }

    canTakePile(index?: number): boolean {
        const hasFood = index === undefined ? this.piles.some((pile) => pile.length > 0) : !!this.piles[index]?.length;
        return hasFood && !this.gameOver && this.hand.length === 0 && !this.tookPileThisTurn;
    }

    takePile(index: number): GameActionResult {
        if (this.gameOver) return { ok: false, reason: 'game-over' };
        if (this.hand.length > 0) return { ok: false, reason: 'hand-not-empty' };
        if (this.tookPileThisTurn) return { ok: false, reason: 'pile-already-taken' };
        const pile = this.piles[index];
        if (!pile) return { ok: false, reason: 'bad-index' };
        if (pile.length === 0) return { ok: false, reason: 'empty-basket' };
        this.hand = pile.slice();
        this.piles[index] = drawPile(this.foodDeck, PILE_SIZES[index]);
        this.tookPileThisTurn = true;
        this.checkGameOver();
        this.notify();
        return { ok: true };
    }

    // ---------- 放置食材 ----------

    /** 查询某食材能否放到某盘子（不改变状态，供 UI 高亮用） */
    canPlaceFromHand(handIndex: number, plateIndex: number): { ok: boolean; reason?: PlaceRejection | 'bad-index' } {
        if (handIndex < 0 || handIndex >= this.hand.length) return { ok: false, reason: 'bad-index' };
        if (plateIndex < 0 || plateIndex >= this.plates.length) return { ok: false, reason: 'bad-index' };
        return canPlaceFood(this.plates[plateIndex].foods);
    }

    /** 将 hand 中第 handIndex 个食材放到 plateIndex 盘子顶部 */
    placeFromHand(handIndex: number, plateIndex: number): GameActionResult {
        if (this.gameOver) return { ok: false, reason: 'game-over' };
        const check = this.canPlaceFromHand(handIndex, plateIndex);
        if (!check.ok) return { ok: false, reason: check.reason ?? 'illegal' };
        const food = this.hand.splice(handIndex, 1)[0];
        this.plates[plateIndex].foods.push(food);
        this.checkGameOver();
        this.notify();
        return { ok: true };
    }

    /** 来源盘从顶到底扣到目标盘。校验整叠后，才会清空来源盘。 */
    checkCap(sourceIndex: number, targetIndex: number): GameActionResult {
        if (this.gameOver) return { ok: false, reason: 'game-over' };
        const source = this.plates[sourceIndex];
        const target = this.plates[targetIndex];
        if (!source || !target) return { ok: false, reason: 'bad-index' };
        if (source === target) return { ok: false, reason: 'same-plate' };
        if (source.isEmpty || target.isEmpty) return { ok: false, reason: 'plate-empty' };
        if (source.layerCount + target.layerCount > MAX_LAYERS) return { ok: false, reason: 'plate-full' };
        return { ok: true };
    }

    capPlate(sourceIndex: number, targetIndex: number): GameActionResult {
        const result = this.checkCap(sourceIndex, targetIndex);
        if (result.ok === false) return result;
        const source = this.plates[sourceIndex];
        this.plates[targetIndex].foods.push(...source.foods.slice().reverse());
        source.clear();
        this.checkGameOver();
        this.notify();
        return { ok: true };
    }

    // ---------- 订单 ----------

    private isRefreshCandidate(candidate: RecipeDef): boolean {
        return !this.orders.some((order) => order.id === candidate.id);
    }

    checkOrderRefresh(): GameActionResult {
        if (this.gameOver) return { ok: false, reason: 'game-over' };
        if (this.orders.length === 0 || !RECIPES.some((candidate) => this.isRefreshCandidate(candidate))) {
            return { ok: false, reason: 'no-replacement' };
        }
        if (this.score < this.orderRefreshPrice) return { ok: false, reason: 'not-enough-money' };
        return { ok: true };
    }

    /** 从完整食谱库挑食材最不相似的一道菜，直接替换当前订单。 */
    refreshOrder(orderIndex: number): GameActionResult {
        const current = this.orders[orderIndex];
        if (!current) return { ok: false, reason: 'bad-index' };
        const check = this.checkOrderRefresh();
        if (check.ok === false) return check;
        let replacement: RecipeDef | undefined;
        let bestSimilarity = Infinity;
        for (const candidate of RECIPES) {
            if (!this.isRefreshCandidate(candidate)) continue;
            const similarity = ingredientSimilarity(current, candidate);
            if (similarity >= bestSimilarity) continue;
            replacement = candidate;
            bestSimilarity = similarity;
            if (similarity === 0) break;
        }
        if (!replacement) return { ok: false, reason: 'no-replacement' };
        this.orders[orderIndex] = replacement;
        this.score -= this.orderRefreshPrice;
        this.orderRefreshPrice += ORDER_REFRESH_PRICE_STEP;
        this.checkGameOver();
        this.notify();
        return { ok: true };
    }

    /** 该盘子当前是否能完成某个订单（严格匹配） */
    canSubmitOrder(orderIndex: number, plateIndex: number): boolean {
        if (this.gameOver) return false;
        if (orderIndex < 0 || orderIndex >= this.orders.length) return false;
        if (plateIndex < 0 || plateIndex >= this.plates.length) return false;
        const plate = this.plates[plateIndex];
        if (plate.isEmpty) return false;
        return isExactMatch(plate.foods, this.orders[orderIndex]);
    }

    /** 返回所有可提交的 (orderIndex, plateIndex) 组合，供 UI 提示 */
    findSubmittableOrders(): Array<{ orderIndex: number; plateIndex: number }> {
        const result: Array<{ orderIndex: number; plateIndex: number }> = [];
        for (let o = 0; o < this.orders.length; o++) {
            for (let p = 0; p < this.plates.length; p++) {
                if (this.canSubmitOrder(o, p)) result.push({ orderIndex: o, plateIndex: p });
            }
        }
        return result;
    }

    /** 提交订单：加分、清空盘子，从候补补单。做完所有订单即可收摊。 */
    submitOrder(orderIndex: number, plateIndex: number): OrderSubmitResult {
        if (!this.canSubmitOrder(orderIndex, plateIndex)) {
            return { ok: false, reason: 'not-matching' };
        }
        const recipe = this.orders[orderIndex];
        const comboCount = ++this.turnServeCount;
        const comboBonus = SERVE_COMBO_BONUSES[comboCount] ?? 0;
        this.score += recipe.score + comboBonus;
        this.completedOrders += 1;
        this.plates[plateIndex].clear();
        this.orders.splice(orderIndex, 1);
        this.fillOrderSlots(orderIndex, recipe.id);
        if (this.orders.length === 0 && this.pendingOrderCount === 0) {
            this.score += ALL_ORDERS_BONUS;
            this.gameOver = true;
            this.gameOverReason = 'all-orders-served';
            this.deleteMode = false;
        } else {
            this.checkGameOver();
        }
        this.notify();
        return { ok: true, comboCount, comboBonus };
    }

    // ---------- 回合 ----------

    /** 主动打烊，按已获得的余额结算。 */
    stopService(): GameActionResult {
        if (this.gameOver) return { ok: false, reason: 'game-over' };
        this.gameOver = true;
        this.gameOverReason = 'manual-stop';
        this.deleteMode = false;
        this.notify();
        return { ok: true };
    }

    canEndTurn(): boolean {
        return !this.gameOver && this.hand.length === 0 && this.tookPileThisTurn;
    }

    /** 主动结束回合。须本回合拿取过一堆且食材全部放置完毕。 */
    endTurn(): GameActionResult {
        if (this.gameOver) return { ok: false, reason: 'game-over' };
        if (this.hand.length > 0) return { ok: false, reason: 'hand-not-empty' };
        if (!this.tookPileThisTurn) return { ok: false, reason: 'no-pile-taken' };
        this.turnServeCount = 0;
        if (this.suppliesExhausted) {
            this.gameOver = true;
            this.gameOverReason = 'out-of-stock';
            this.deleteMode = false;
            this.notify();
            return { ok: true };
        }
        // 清盘可能在三篮都空后恢复库存，此时开下一回合前重新供货。
        if (this.piles.every((pile) => pile.length === 0)) {
            this.piles = PILE_SIZES.map((size) => drawPile(this.foodDeck, size));
        }
        this.turn += 1;
        // 按完成的回合数奖励清盘机会。
        const completedTurns = this.turn - 1;
        if (completedTurns % DELETE_CHANCE_TURN_INTERVAL === 0 && this.deleteChances < DELETE_CHANCE_MAX) {
            this.deleteChances += 1;
        }
        this.deleteMode = false;
        this.tookPileThisTurn = false;
        this.notify();
        return { ok: true };
    }

    // ---------- 删除 ----------

    get turnsUntilDeleteRefill(): number | null {
        if (this.deleteChances >= DELETE_CHANCE_MAX) return null;
        return DELETE_CHANCE_TURN_INTERVAL - (this.turn - 1) % DELETE_CHANCE_TURN_INTERVAL;
    }

    canEnterDeleteMode(): boolean {
        return !this.gameOver && this.deleteChances > 0;
    }

    enterDeleteMode(): GameActionResult {
        if (!this.canEnterDeleteMode()) return { ok: false, reason: 'no-chance' };
        this.deleteMode = true;
        this.notify();
        return { ok: true };
    }

    /** 取消删除模式，不消耗机会 */
    cancelDeleteMode(): void {
        if (!this.deleteMode) return;
        this.deleteMode = false;
        this.notify();
    }

    /** 整盘食材放回仓库，洗匀待抽队列，并消耗一次机会。 */
    deletePlate(plateIndex: number): GameActionResult {
        if (!this.deleteMode) return { ok: false, reason: 'not-in-delete-mode' };
        if (plateIndex < 0 || plateIndex >= this.plates.length) return { ok: false, reason: 'bad-index' };
        const plate = this.plates[plateIndex];
        if (plate.isEmpty) return { ok: false, reason: 'plate-empty' };
        this.foodDeck.push(...plate.foods);
        shuffleFoodDeck(this.foodDeck, this.rng);
        plate.clear();
        this.deleteChances -= 1;
        this.deleteMode = false;
        this.checkGameOver();
        this.notify();
        return { ok: true };
    }

    // ---------- 失败判定 ----------

    /** 三盘全满、手上还有食材，且无法出餐、清盘或换单时才结束。 */
    checkGameOver(): boolean {
        if (this.gameOver) return true;
        if (this.hand.length === 0 || this.plates.some((plate) => !plate.isFull)) return false;
        if (this.deleteChances > 0) return false;
        if (this.findSubmittableOrders().length > 0) return false;
        if (this.checkOrderRefresh().ok) return false;
        this.gameOver = true;
        this.gameOverReason = 'no-space';
        return true;
    }

    /** 重开一局 */
    prepareTutorialCap(): void {
        const [target, source] = this.plates;
        if (!target.isEmpty || !source.isEmpty) return;
        target.foods.push(TUTORIAL_CAP_BASE);
        source.foods.push(...TUTORIAL_CAP_SOURCE);
        for (const food of [TUTORIAL_CAP_BASE, ...TUTORIAL_CAP_SOURCE]) {
            const index = this.foodDeck.lastIndexOf(food);
            if (index >= 0) this.foodDeck.splice(index, 1);
        }
        this.notify();
    }

    restart(tutorial = false): void {
        this.plates.length = 0;
        this.hand = [];
        this.piles = [];
        this.orders = [];
        this.completedOrders = 0;
        this.turn = 1;
        this.score = 0;
        this.turnServeCount = 0;
        this.orderRefreshPrice = ORDER_REFRESH_START_PRICE;
        this.deleteChances = DELETE_CHANCE_START;
        this.deleteMode = false;
        this.tookPileThisTurn = false;
        this.gameOver = false;
        this.gameOverReason = null;
        for (let i = 0; i < PLATE_COUNT; i++) {
            this.plates.push(new PlateState());
        }
        this.foodDeck = createFoodDeck(this.rng);
        if (tutorial) {
            const opening = [FoodType.Lettuce, FoodType.Tomato, FoodType.BurgerBun, FoodType.Patty, FoodType.BurgerBun];
            for (const food of opening) this.foodDeck.splice(this.foodDeck.lastIndexOf(food), 1);
            this.foodDeck.push(...opening.reverse());
        }
        this.piles = PILE_SIZES.map((size) => drawPile(this.foodDeck, size));
        // The practice round always has a salad ticket, even with a shorter live deck.
        this.orderDeck = createOrderDeck(this.rng, tutorial ? Math.max(TOTAL_ORDERS, RECIPES.length) : TOTAL_ORDERS);
        if (tutorial) {
            for (const id of ['BasicBeefBurger', 'Salad']) {
                const index = this.orderDeck.findIndex((recipe) => recipe.id === id);
                if (index >= 0) this.orderDeck.unshift(...this.orderDeck.splice(index, 1));
            }
        }
        this.fillOrderSlots(0);
        this.notify();
    }
}
