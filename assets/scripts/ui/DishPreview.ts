/**
 * DishPreview：根据食谱数据，用真实食材 Sprite 组合出成品示意图。
 *
 * 纯视觉组件，不创建任何游戏数据、不参与订单判定。
 * 构建逻辑独立封装，未来若有独立成品图，可直接替换 build() 实现。
 */

import { _decorator, Component, Node, Layers, UITransform } from 'cc';
import { RecipeDef } from '../core/Recipe';
import { FoodType } from '../core/FoodType';
import { ArtAssets } from './ArtAssets';

const { ccclass } = _decorator;

/** 层间垂直重叠比例（每层压住下层高度的百分比） */
const LAYER_OVERLAP = 0.42;

@ccclass('DishPreview')
export class DishPreview extends Component {
    /**
     * 在 parent 下构建成品示意图。
     * @param maxW 最大宽度
     * @param maxH 最大高度（含汉堡上下面包）
     * @returns 成品在示意图根节点内按实际高度居中
     */
    static build(art: ArtAssets, parent: Node, recipe: RecipeDef, maxW: number, maxH: number): Node {
        const root = new Node('DishPreview');
        root.parent = parent;
        root.layer = Layers.Enum.UI_2D;
        root.addComponent(UITransform).setContentSize(maxW, maxH);

        const layers: FoodType[] = [...recipe.head, ...recipe.middle, ...recipe.tail];
        if (layers.length === 0) return root;

        const frames = layers.map((food, i) => art.getFood(food, food === FoodType.BurgerBun && i === layers.length - 1));
        const heights = frames.map((frame) => maxW / (frame ? art.aspectOfFrame(frame) : 2));
        const step = heights[0] * (1 - LAYER_OVERLAP);
        const bottom = Math.min(...heights.map((height, i) => i * step - height / 2));
        const top = Math.max(...heights.map((height, i) => i * step + height / 2));
        const center = (top + bottom) / 2;
        const scale = Math.min(1, maxH / (top - bottom));
        layers.forEach((food, i) => {
            const node = art.makeSprite(root, frames[i], `Dish_${food}`, maxW * scale, heights[i] * scale);
            node.setPosition(0, (i * step - center) * scale, 0);
        });
        return root;
    }
}
