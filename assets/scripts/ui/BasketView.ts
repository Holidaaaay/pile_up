import { _decorator, Button, Color, Component, Graphics, Layers, Node, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { FoodType } from '../core/FoodType';
import { ArtAssets } from './ArtAssets';

const { ccclass } = _decorator;
const FRONT_START = 0.54;

@ccclass('BasketView')
export class BasketView extends Component {
    private art!: ArtAssets;
    private foodStack!: Node;
    private foodWidth = 0;
    private foodBase = 0;
    private foodKey = '';
    private dimmed = false;
    private picking = false;
    private expanded = false;
    private front!: Node;
    private previewMount!: Node;
    private restPositions: Vec3[] = [];
    private onTake!: () => void;

    static create(art: ArtAssets, parent: Node, previewLayer: Node, index: number,
        opts: { width: number; height: number; foodWidth: number }, onTake: () => void): BasketView {
        const node = new Node('Basket_' + index);
        node.parent = parent;
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform).setContentSize(opts.width, opts.height);
        const basket = node.addComponent(BasketView);
        basket.art = art;
        basket.foodWidth = opts.foodWidth;
        basket.onTake = onTake;

        const shadow = node.addComponent(Graphics);
        shadow.fillColor = new Color(111, 74, 40, 28);
        shadow.ellipse(0, -opts.height / 2 + 34, 83, 13);
        shadow.fill();

        const width = opts.width - 42;
        const height = 133;
        const y = -opts.height / 2 + 94;
        art.makeSprite(node, art.getFullFrame('basket_back'), 'BasketBack', width, height).setPosition(0, y, 0);

        basket.foodStack = new Node('Contents');
        basket.foodStack.parent = node;
        basket.foodStack.layer = Layers.Enum.UI_2D;
        basket.foodStack.addComponent(UITransform);
        basket.foodStack.addComponent(UIOpacity);
        basket.front = art.makeSprite(node, art.getFullFrame('basket_front'), 'FrontRim', width, height);
        basket.front.setPosition(0, y, 0);
        basket.previewMount = new Node('BasketPreview_' + index);
        basket.previewMount.layer = Layers.Enum.UI_2D;
        basket.previewMount.parent = previewLayer;
        basket.previewMount.addComponent(UITransform);
        basket.foodBase = y + height * (0.5 - FRONT_START) - 10;
        return basket;
    }

    setFoods(foods: FoodType[]): void {
        if (this.picking) return;
        this.paintFoods(foods);
    }

    resetView(): void {
        const stack = this.foodStack;
        const opacity = stack.getComponent(UIOpacity)!;
        for (const target of [this.node, this.previewMount, stack, opacity, ...stack.children]) {
            Tween.stopAllByTarget(target);
        }
        this.picking = false;
        this.expanded = false;
        this.restoreFoodLayer();
        this.node.setScale(Vec3.ONE);
        stack.setPosition(Vec3.ZERO);
        opacity.opacity = 255;
        this.paintFoods([]);
    }

    onDestroy(): void {
        if (this.previewMount?.isValid) this.previewMount.destroy();
    }

    private paintFoods(foods: FoodType[]): void {
        const key = foods.join(',');
        if (key === this.foodKey) return;
        this.foodKey = key;
        for (const child of this.foodStack.children.slice()) {
            child.removeFromParent();
            child.destroy();
        }
        this.restPositions = [];
        let bottom = this.foodBase;
        for (let i = 0; i < foods.length; i++) {
            const topBun = foods[i] === FoodType.BurgerBun && i === foods.length - 1;
            const sprite = this.art.makeSprite(this.foodStack, this.art.getFood(foods[i], topBun), 'Food', this.foodWidth);
            const button = sprite.addComponent(Button);
            button.transition = Button.Transition.NONE;
            button.enabled = this.expanded;
            sprite.on(Button.EventType.CLICK, this.onTake, this);
            const height = sprite.getComponent(UITransform)!.height;
            const position = new Vec3(0, bottom + height / 2, 0);
            this.restPositions.push(position);
            sprite.setPosition(position);
            bottom += height * 0.57;
        }
    }

    setExpanded(on: boolean): void {
        if (on === this.expanded) return;
        this.expanded = on;
        const children = this.foodStack.children;
        const mount = this.previewMount;
        Tween.stopAllByTarget(mount);
        if (on) {
            mount.setWorldPosition(this.node.worldPosition);
            mount.setSiblingIndex(mount.parent!.children.length - 1);
            this.foodStack.setParent(mount);
        }
        let y = this.foodBase + 78;
        const duration = on ? 0.31 : 0.23;
        const stagger = on ? 0.027 : 0.018;
        children.forEach((food, index) => {
            const height = food.getComponent(UITransform)!.height;
            const position = on ? new Vec3(0, y + height / 2, 0) : this.restPositions[index];
            if (on) y += height + 10;
            food.getComponent(Button)!.enabled = on;
            Tween.stopAllByTarget(food);
            tween(food)
                .delay((on ? children.length - 1 - index : index) * stagger)
                .to(duration, { position }, { easing: 'cubicOut' })
                .start();
        });
        if (!on) {
            tween(mount).delay(duration + Math.max(0, children.length - 1) * stagger)
                .call(() => this.restoreFoodLayer()).start();
        }
    }

    private restoreFoodLayer(): void {
        if (this.foodStack.parent === this.node) return;
        this.foodStack.setParent(this.node);
        this.foodStack.setSiblingIndex(this.front.getSiblingIndex());
    }

    alignPreview(): void {
        if (this.foodStack.parent === this.previewMount) this.previewMount.setWorldPosition(this.node.worldPosition);
    }

    foodWorldPositions(): Vec3[] {
        return this.foodStack.children.map((food) => food.worldPosition.clone());
    }

    setDimmed(on: boolean): void {
        if (on === this.dimmed) return;
        this.dimmed = on;
        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        tween(opacity).to(0.16, { opacity: on ? 182 : 255 }).start();
    }

    animatePickup(next: FoodType[], onRefill: () => void): void {
        const stack = this.foodStack;
        Tween.stopAllByTarget(stack);
        Tween.stopAllByTarget(this.previewMount);
        for (const food of stack.children) Tween.stopAllByTarget(food);
        this.picking = true;
        stack.setPosition(Vec3.ZERO);
        stack.setScale(Vec3.ONE);
        Tween.stopAllByTarget(this.node);
        tween(this.node).to(0.09, { scale: new Vec3(1.045, 1.045, 1) })
            .to(0.17, { scale: Vec3.ONE }, { easing: 'quadOut' }).start();
        const opacity = stack.getComponent(UIOpacity)!;
        Tween.stopAllByTarget(opacity);
        tween(opacity).to(0.08, { opacity: 0 }).start();
        tween(stack).to(0.14, { position: new Vec3(0, 24, 0) }, { easing: 'quadOut' })
            .call(() => {
                this.picking = false;
                this.restoreFoodLayer();
                this.paintFoods(next);
                // 抽到完全相同的食材时，仍复位复用的精灵。
                stack.children.forEach((food, index) => food.setPosition(this.restPositions[index]));
                opacity.opacity = 255;
                onRefill();
                stack.setPosition(0, -12, 0);
            })
            .to(0.18, { position: Vec3.ZERO }, { easing: 'quadOut' }).start();
    }
}
