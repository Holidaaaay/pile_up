import { _decorator, Color, Component, Graphics, Layers, Node, Sprite, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { FoodType } from '../core/FoodType';
import { ArtAssets } from './ArtAssets';
import { OutlineLayer, SELECTION_COLOR, strokeOutline } from './FoodOutline';

const { ccclass } = _decorator;
export type PlateHighlight = 'idle' | 'valid' | 'invalid' | 'delete' | 'source' | 'ready';

@ccclass('PlateView')
export class PlateView extends Component {
    private art!: ArtAssets;
    private foodStack!: Node;
    private ceramic: Node[] = [];
    private accent!: Graphics;
    private foods: FoodType[] = [];
    private foodWidth = 0;
    private plateY = 0;
    private width = 0;
    private highlight: PlateHighlight = 'idle';

    static create(art: ArtAssets, parent: Node, index: number, opts: { width: number; height: number; foodWidth: number }): PlateView {
        const node = new Node('Plate_' + index);
        node.parent = parent;
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform).setContentSize(opts.width, opts.height);
        const plate = node.addComponent(PlateView);
        plate.art = art;
        plate.width = opts.width;
        plate.foodWidth = opts.foodWidth;
        plate.plateY = -opts.height / 2 + 62;
        const shadow = plate.layer('Shadow').addComponent(Graphics);
        shadow.fillColor = new Color(86, 65, 39, 31);
        shadow.ellipse(0, plate.plateY - 24, opts.width * 0.44, 17);
        shadow.fill();
        plate.accent = plate.layer('Target').addComponent(Graphics);
        for (const name of ['plate_back', 'plate_front']) {
            const slice = art.makeSprite(node, art.getFullFrame(name), name, opts.width - 14, 95);
            slice.setPosition(0, plate.plateY, 0);
            plate.ceramic.push(slice);
        }
        plate.foodStack = plate.layer('FoodStack');
        return plate;
    }

    private layer(name: string): Node {
        const node = new Node(name);
        node.parent = this.node;
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform);
        return node;
    }

    setFoods(foods: FoodType[]): void {
        let shared = 0;
        while (shared < foods.length && this.foods[shared] === foods[shared]) shared++;
        if (shared === foods.length && shared === this.foods.length) return;
        for (const node of this.foodStack.children.slice(shared)) {
            node.removeFromParent();
            node.destroy();
        }
        for (let i = shared; i < foods.length; i++) {
            this.art.makeSprite(this.foodStack, null, 'Food', this.foodWidth);
        }
        this.foods = foods.slice();
        for (let i = Math.max(0, shared - 1); i < foods.length; i++) {
            const node = this.foodStack.children[i];
            Tween.stopAllByTarget(node);
            node.setScale(1, 1, 1);
            const food = foods[i];
            const topBun = food === FoodType.BurgerBun && i === foods.length - 1 && i >= 2;
            this.art.setSprite(node, this.art.getFood(food, topBun), this.foodWidth);
            const h = node.getComponent(UITransform)!.height;
            node.setPosition(0, this.plateY - 12 + h / 2 + i * 29, 0);
        }
        this.paintHighlight();
    }

    setHighlight(next: PlateHighlight): void {
        if (next === this.highlight) return;
        this.highlight = next;
        this.paintHighlight();
    }

    private paintHighlight(): void {
        this.accent.clear();
        if (this.highlight === 'idle' || this.highlight === 'invalid') return;
        if (this.highlight === 'ready') {
            this.accent.lineWidth = 4;
            this.accent.strokeColor = new Color('#2D634C');
            this.accent.ellipse(0, this.plateY - 3, (this.width - 4) / 2, 41);
            this.accent.stroke();
            return;
        }
        const layers: OutlineLayer[] = [{ width: this.width - 14, height: 95, y: this.plateY }];
        this.foodStack.children.forEach((node, index) => {
            const size = node.getComponent(UITransform)!;
            layers.push({
                width: size.width,
                height: size.height,
                y: this.plateY - 12 + size.height / 2 + index * 29,
                frameName: node.getComponent(Sprite)!.spriteFrame?.name,
            });
        });
        const color = this.highlight === 'delete' ? '#AD5041'
            : this.highlight === 'source' ? '#A8652F' : SELECTION_COLOR;
        strokeOutline(this.accent, layers, color);
    }

    flyTopFrom(world: Vec3): void {
        const nodes = this.foodStack.children;
        const top = nodes[nodes.length - 1];
        if (!top) return;
        const target = top.position.clone();
        const start = this.foodStack.getComponent(UITransform)!.convertToNodeSpaceAR(world);
        const lift = new Vec3((start.x + target.x) / 2, Math.max(start.y, target.y) + 36, 0);
        top.setPosition(start);
        top.setScale(0.82, 0.82, 1);
        tween(top)
            .to(0.105, { position: lift, scale: Vec3.ONE }, { easing: 'quadOut' })
            .to(0.125, { position: target, scale: new Vec3(1.08, 0.90, 1) }, { easing: 'quadIn' })
            .call(() => this.pulse())
            .to(0.09, { scale: Vec3.ONE }, { easing: 'sineOut' }).start();
    }

    foodWorldPositions(): Vec3[] {
        return this.foodStack.children.map((food) => food.worldPosition.clone());
    }

    /** 从状态提交前的来源盘复制动画用外观。 */
    makeCapCarrier(): Node {
        const carrier = new Node('CapFlight');
        carrier.parent = this.node.parent;
        carrier.layer = Layers.Enum.UI_2D;
        carrier.setPosition(this.node.position.x, this.node.position.y + this.plateY, 0);
        for (const slice of this.ceramic) {
            this.art.makeSprite(carrier, slice.getComponent(Sprite)!.spriteFrame, slice.name, this.width - 14, 95);
        }
        const food = new Node('CarriedFood');
        food.parent = carrier;
        food.layer = Layers.Enum.UI_2D;
        for (const source of this.foodStack.children) {
            const copy = this.art.makeSprite(food, source.getComponent(Sprite)!.spriteFrame, 'Food', this.foodWidth);
            copy.setPosition(0, source.position.y - this.plateY, 0);
        }
        return carrier;
    }

    /** 来源盘抬起并沿弧翻扣。目标盘承重回弹，空盘随后回到原位。 */
    animateCapTo(carrier: Node, target: PlateView, count: number, onDone: () => void): () => void {
        const start = carrier.position.clone();
        const targetX = target.node.position.x;
        const direction = Math.sign(targetX - start.x);
        const targetY = target.node.position.y + target.plateY + 25 + target.foods.length * 29;
        const midX = (start.x + targetX) / 2;
        const carriedFood = carrier.getChildByName('CarriedFood')!;
        const dropped = target.foodStack.children.slice(-count);
        for (const slice of this.ceramic) slice.active = false;
        for (const food of dropped) food.active = false;

        const revealFood = () => {
            for (const food of dropped) {
                if (food.isValid) food.active = true;
            }
        };
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            revealFood();
            for (const slice of this.ceramic) {
                if (slice.isValid) slice.active = true;
            }
            Tween.stopAllByTarget(carrier);
            if (carrier.isValid) carrier.destroy();
            onDone();
        };

        tween(carrier)
            .to(0.07, { position: new Vec3(start.x - direction * 12, start.y - 5, 0), angle: direction * 9 })
            .to(0.18, {
                position: new Vec3(midX, targetY + 36, 0), angle: -direction * 23, scale: new Vec3(1, 0.10, 1),
            }, { easing: 'sineOut' })
            .to(0.12, {
                position: new Vec3(targetX, targetY, 0), angle: 0, scale: new Vec3(1, -0.86, 1),
            }, { easing: 'quadIn' })
            .call(() => {
                revealFood();
                carriedFood.active = false;
                target.pulse();
            })
            .to(0.12, {
                position: new Vec3(midX, targetY + 30, 0), angle: direction * 16, scale: new Vec3(1, 0.15, 1),
            }, { easing: 'sineOut' })
            .to(0.18, { position: start, angle: 0, scale: Vec3.ONE }, { easing: 'quadIn' })
            .call(finish).start();
        return finish;
    }

    /** Capture an independent visual before the core clears the plate. */
    playClear(): void {
        const ghost = this.layer('ClearingFood');
        for (const source of this.foodStack.children) {
            const copy = this.art.makeSprite(ghost, source.getComponent(Sprite)!.spriteFrame, 'Food', this.foodWidth);
            copy.setPosition(source.position);
        }
        const opacity = ghost.addComponent(UIOpacity);
        tween(opacity).to(0.21, { opacity: 0 }).start();
        tween(ghost).by(0.22, { position: new Vec3(0, 30, 0) }).call(() => ghost.destroy()).start();
    }

    pulse(): void {
        Tween.stopAllByTarget(this.node);
        tween(this.node).to(0.08, { scale: new Vec3(1.04, 1.04, 1) })
            .to(0.16, { scale: Vec3.ONE }, { easing: 'quadOut' }).start();
    }
}
