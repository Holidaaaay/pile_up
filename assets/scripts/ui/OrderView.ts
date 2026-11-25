import { Button, Color, Font, Graphics, Label, Layers, Node, tween, Tween, UITransform, Vec3 } from 'cc';
import { FoodType } from '../core/FoodType';
import { orderPriceTier } from '../core/GameConfig';
import { RecipeDef } from '../core/Recipe';
import { ArtAssets } from './ArtAssets';
import { DishPreview } from './DishPreview';
import { drawKitchenIcon } from './KitchenUiArt';

const INK = new Color('#49382E');
const GREEN = new Color('#365B42');
const READY_GREEN = '#2D634C';

export interface OrderViewOptions {
    width: number;
    height: number;
    making: boolean;
    submittable: boolean;
    refreshPrice?: number;
    index: number;
    onInspect: (food: FoodType, detail: string) => void;
}

export class OrderView {
    static build(art: ArtAssets, parent: Node, recipe: RecipeDef, opts: OrderViewOptions): Node {
        const { width, height } = opts;
        const card = this.node(parent, 'Order_' + recipe.id, width, height);
        const paper = card.addComponent(Graphics);
        const ready = opts.submittable && opts.refreshPrice === undefined;
        this.drawTornPaper(paper, width, height, ready, opts.refreshPrice !== undefined);
        const tape = ready ? '#588C68' : opts.making ? '#A7B891' : ['#E3BA83', '#B9C3A4', '#DEAA97'][opts.index];
        this.fill(paper, 0, height / 2 + 1, 62, 17, 5, tape);

        this.label(art.font, card, recipe.nameZh, 0, height / 2 - 30, width - 16, 30, 24);
        const rightCenter = width / 4;
        const priceY = -height / 2 + 27;
        this.drawPrice(card, art.font, recipe.score, rightCenter, priceY);
        if (opts.refreshPrice !== undefined) {
            this.drawSwapBadge(card, art.font, priceY);
        } else if (ready || opts.making) {
            this.drawStatusIcon(card, priceY - 1, ready);
        }
        const layers = [...recipe.head, ...recipe.middle, ...recipe.tail];
        const rowY = (i: number) => -4 + (i - (layers.length - 1) / 2) * 29;
        if (recipe.middle.length > 0) {
            const groupY = rowY(recipe.head.length + (recipe.middle.length - 1) / 2);
            this.fill(paper, -67, groupY, 56, recipe.middle.length * 29 - 2, 10, '#BED2AD');
            this.fill(paper, -91, groupY, 4, recipe.middle.length * 29 - 13, 2, '#759A70');
        }
        const dishTop = height / 2 - 49;
        const dishBottom = priceY + 26;
        const dish = DishPreview.build(art, card, recipe, width / 2 - 12, dishTop - dishBottom);
        dish.setPosition(rightCenter, (dishTop + dishBottom) / 2, 0);
        let selected: Node | null = null;
        for (let i = layers.length - 1; i >= 0; i--) {
            const food = layers[i];
            const free = i >= recipe.head.length && i < recipe.head.length + recipe.middle.length;
            const row = this.node(card, 'Layer_' + (i + 1), 62, 28);
            row.setPosition(-67, rowY(i), 0);
            const outline = row.addComponent(Graphics);
            if (!free) this.fill(paper, -67, rowY(i), 56, 24, 6, '#F9EEDB');
            const topBun = food === FoodType.BurgerBun && i === layers.length - 1 && i > 0;
            art.makeSprite(row, art.getFood(food, topBun), 'Ingredient', 38, 24);
            row.addComponent(Button).transition = Button.Transition.NONE;
            row.on(Button.EventType.CLICK, () => {
                if (selected) {
                    selected.getComponent(Graphics)!.clear();
                    this.scaleRow(selected, 1);
                }
                if (selected === row) {
                    selected = null;
                    return;
                }
                selected = row;
                outline.lineWidth = 2;
                outline.strokeColor = GREEN;
                outline.roundRect(-31, -14, 62, 28, 7);
                outline.stroke();
                this.scaleRow(row, 1.06);
                opts.onInspect(food, free ? '同一色带内可以换顺序' : '这一层的位置固定');
            });
        }
        return card;
    }

    private static drawStatusIcon(card: Node, y: number, ready: boolean): void {
        const icon = this.node(card, ready ? 'ReadyIcon' : 'MakingIcon', 44, 44);
        icon.setPosition(-51, y, 0);
        const g = icon.addComponent(Graphics);
        g.strokeColor = new Color(ready ? READY_GREEN : '#8B5C36');
        g.lineWidth = 3.8;
        g.lineCap = Graphics.LineCap.ROUND;
        g.lineJoin = Graphics.LineJoin.ROUND;
        g.circle(0, 0, 18);
        g.stroke();
        if (ready) {
            g.lineWidth = 4.8;
            g.moveTo(-8, 0);
            g.lineTo(-2.5, -5.5);
            g.lineTo(9, 6);
            g.stroke();
            tween(icon).to(0.17, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'quadOut' })
                .to(0.19, { scale: Vec3.ONE }, { easing: 'quadInOut' }).start();
        } else {
            g.lineWidth = 3.4;
            g.moveTo(-11, -5.5);
            g.lineTo(11, -5.5);
            g.moveTo(-8.5, -5.5);
            g.bezierCurveTo(-8.5, 7, 8.5, 7, 8.5, -5.5);
            g.moveTo(0, 4);
            g.lineTo(0, 8);
            g.stroke();
        }
    }

    private static drawSwapBadge(card: Node, font: Font | null, y: number): void {
        const badge = this.node(card, 'SwapBadge', 96, 42);
        badge.setPosition(-51, y, 0);
        const g = badge.addComponent(Graphics);
        this.fill(g, 0, -2, 96, 42, 11, '#A86E39');
        this.fill(g, 0, 0, 96, 42, 11, '#E9BA80');
        const icon = this.node(badge, 'Icon', 21, 21);
        icon.setPosition(-29, 0, 0);
        icon.setScale(0.78, 0.78, 1);
        drawKitchenIcon(icon.addComponent(Graphics), 'swap', '#583820');
        this.label(font, badge, '换这单', 10, 0, 62, 32, 20, new Color('#583820'));
    }

    private static drawPrice(card: Node, font: Font | null, price: number, x: number, y: number): void {
        const tag = this.node(card, 'OrderPrice', 94, 42);
        tag.setPosition(x, y, 0);
        const g = tag.addComponent(Graphics);
        let ink: Color;
        const tier = orderPriceTier(price);
        if (tier === 'red') {
            this.fill(g, 0, -2, 94, 42, 8, '#733629');
            this.fill(g, 0, 0, 94, 42, 8, '#9B4736');
            g.strokeColor = new Color('#F1C498');
            g.lineWidth = 1.5;
            g.roundRect(-43, -17, 86, 34, 5);
            g.stroke();
            ink = new Color('#FFF8E8');
        } else if (tier === 'amber') {
            g.fillColor = new Color('#EABB67');
            g.moveTo(-47, 21);
            g.lineTo(47, 21);
            g.lineTo(47, 7);
            g.quadraticCurveTo(35, 0, 47, -7);
            g.lineTo(47, -21);
            g.lineTo(-47, -21);
            g.lineTo(-47, -7);
            g.quadraticCurveTo(-35, 0, -47, 7);
            g.close();
            g.fill();
            ink = new Color('#543319');
        } else {
            this.fill(g, 0, -2, 94, 42, 20, '#88A17A');
            this.fill(g, 0, 0, 94, 42, 20, '#C3D1A9');
            ink = new Color('#304835');
        }
        this.label(font, tag, '$' + price, 0, 0, 77, 38, 32, ink);
    }

    private static drawTornPaper(g: Graphics, width: number, height: number, ready: boolean, swapping: boolean): void {
        const left = -width / 2;
        const right = width / 2;
        const top = height / 2;
        const bottom = -height / 2;
        const tear = [4, 0, 4, 2, 0, 6, 1, 4, 2, 6, 0, 3, 2, 6, 0, 4];
        const path = (offset: number) => {
            g.moveTo(left + 4, top + offset);
            g.lineTo(right - 4, top + offset);
            g.quadraticCurveTo(right, top + offset, right, top - 5 + offset);
            for (let i = tear.length - 1; i >= 0; i--) {
                g.lineTo(left + i * width / (tear.length - 1), bottom + tear[i] + offset);
            }
            g.lineTo(left, top - 5 + offset);
            g.quadraticCurveTo(left, top + offset, left + 4, top + offset);
            g.close();
        };
        g.fillColor = new Color('#9C724147');
        path(-5);
        g.fill();
        g.fillColor = new Color(ready ? '#F5F7E7' : '#FFF8E8');
        path(0);
        g.fill();
        g.lineWidth = 1.2;
        g.strokeColor = new Color('#98A58E73');
        for (let x = left + 12; x < right - 10; x += 16) {
            g.moveTo(x, bottom + 10);
            g.lineTo(x, top - 7);
        }
        for (let y = bottom + 13; y < top - 8; y += 16) {
            g.moveTo(left + 5, y);
            g.lineTo(right - 5, y);
        }
        g.stroke();
        g.lineWidth = 1.1;
        g.strokeColor = new Color('#B87D696B');
        g.moveTo(left + 17, bottom + 10);
        g.lineTo(left + 17, top - 7);
        g.stroke();
        if (ready || swapping) {
            g.lineWidth = ready ? 5 : 4;
            g.strokeColor = new Color(ready ? READY_GREEN : '#B1763C');
            path(0);
            g.stroke();
        }
    }

    private static scaleRow(row: Node, scale: number): void {
        Tween.stopAllByTarget(row);
        tween(row).to(0.15, { scale: new Vec3(scale, scale, 1) }, { easing: 'quadOut' }).start();
    }

    private static node(parent: Node, name: string, w: number, h: number): Node {
        const node = new Node(name);
        node.parent = parent;
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform).setContentSize(w, h);
        return node;
    }

    private static label(font: Font | null, parent: Node, text: string, x: number, y: number, w: number, h: number, size: number, color = INK): void {
        const node = this.node(parent, 'Label', w, h);
        node.setPosition(x, y, 0);
        const label = node.addComponent(Label);
        label.overflow = Label.Overflow.SHRINK;
        if (font) label.font = font;
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size + 3;
        label.enableWrapText = false;
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        node.getComponent(UITransform)!.setContentSize(w, h);
    }

    private static fill(g: Graphics, x: number, y: number, w: number, h: number, r: number, color: string): void {
        g.fillColor = new Color(color);
        g.roundRect(x - w / 2, y - h / 2, w, h, r);
        g.fill();
    }
}
