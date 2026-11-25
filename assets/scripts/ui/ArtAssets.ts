/**
 * ArtAssets：集中管理全部美术资源。
 *
 * - 运行时通过 resources.loadDir 加载 assets/resources/art 下的全部 SpriteFrame
 * - 提供 FoodType → SpriteFrame 的统一映射（汉堡胚区分底层/顶层）
 * - 提供创建 Sprite 节点的工厂方法
 *
 * UI 层不直接关心图片文件名，只通过本模块取帧。
 */

import { _decorator, BitmapFont, Component, Node, Sprite, SpriteFrame, UITransform, Layers, resources, Rect, Size } from 'cc';
import { ALL_FOOD_TYPES, FoodType } from '../core/FoodType';

const { ccclass } = _decorator;

const ART_DIR = 'art';

/** 文件名（不含扩展名）集中定义 */
const FILE = {
    background: 'background',
    plateBack: 'plate_back',
    plateFront: 'plate_front',
    basketBack: 'basket_back',
    basketFront: 'basket_front',
    paperGreen: 'order_paper_green',
    paperRed: 'order_paper_red',
    bunBottom: 'food_bun_bottom',
    bunTop: 'food_bun_top',
    patty: 'food_patty',
    bacon: 'food_bacon',
    cheese: 'food_cheese',
    egg: 'food_egg',
    tomato: 'food_tomato',
    lettuce: 'food_lettuce',
} as const;

const FOOD_FILE: Record<FoodType, string> = {
    [FoodType.BurgerBun]: FILE.bunBottom,
    [FoodType.Patty]: FILE.patty,
    [FoodType.Tomato]: FILE.tomato,
    [FoodType.Lettuce]: FILE.lettuce,
    [FoodType.Cheese]: FILE.cheese,
    [FoodType.FriedEgg]: FILE.egg,
    [FoodType.Bacon]: FILE.bacon,
};

@ccclass('ArtAssets')
export class ArtAssets extends Component {
    font: BitmapFont | null = null;
    private frames = new Map<string, SpriteFrame>();
    /** 原始帧尺寸缓存，用于保持宽高比 */
    private sizes = new Map<string, Size>();
    private generated = new Map<string, SpriteFrame>();

    /** 加载全部美术资源，完成后回调 */
    loadAll(onDone: (ready: boolean) => void): void {
        resources.loadDir(ART_DIR, SpriteFrame, (err, frames) => {
            if (!this.isValid) return;
            if (err) {
                console.error('[ArtAssets] 加载失败', err);
                onDone(false);
                return;
            }
            for (const f of frames) {
                this.frames.set(f.name, f);
                if (f.texture) {
                    this.sizes.set(f.name, new Size(f.texture.width, f.texture.height));
                }
            }
            const required = [FILE.plateBack, FILE.plateFront, FILE.basketBack, FILE.basketFront,
                FILE.bunTop, ...ALL_FOOD_TYPES.map((food) => FOOD_FILE[food])];
            if (!required.every((name) => this.frames.get(name)?.texture)) {
                onDone(false);
                return;
            }
            resources.load('fonts/KitchenRoundBitmap', BitmapFont, (fontError, font) => {
                if (!this.isValid) return;
                if (fontError || !font?.spriteFrame?.texture) {
                    console.error('[ArtAssets] 厨房字体图集加载失败', fontError);
                    onDone(false);
                    return;
                }
                this.font = font;
                onDone(true);
            });
        });
    }

    /** 盘与篮沿用原图像素，忽略旧的上下裁切元数据。 */
    getFullFrame(name: string): SpriteFrame | null {
        const cached = this.generated.get(name);
        if (cached) return cached;
        const texture = this.get(name)?.texture;
        if (!texture) return null;
        const frame = new SpriteFrame();
        frame.reset({
            texture,
            rect: new Rect(0, 0, texture.width, texture.height),
            originalSize: new Size(texture.width, texture.height),
        });
        frame.packable = false;
        this.generated.set(name, frame);
        return frame;
    }

    getHorizontalBand(name: string, from: number, to: number): SpriteFrame | null {
        const key = `${name}:${from}:${to}`;
        const cached = this.generated.get(key);
        if (cached) return cached;
        const texture = this.getFullFrame(name)?.texture;
        if (!texture) return null;
        const top = Math.min(texture.height - 1, Math.round(from * texture.height));
        const bottom = Math.max(top + 1, Math.round(to * texture.height));
        const frame = new SpriteFrame();
        frame.reset({ texture, rect: new Rect(0, top, texture.width, bottom - top) });
        frame.packable = false;
        this.generated.set(key, frame);
        return frame;
    }

    onDestroy(): void {
        for (const frame of this.generated.values()) frame.destroy();
        this.generated.clear();
    }

    get(name: string): SpriteFrame | null {
        return this.frames.get(name) ?? null;
    }

    /** 食材帧；asTopBun 为 true 时汉堡胚取顶层面包 */
    getFood(type: FoodType, asTopBun = false): SpriteFrame | null {
        if (type === FoodType.BurgerBun && asTopBun) {
            return this.get(FILE.bunTop);
        }
        return this.get(FOOD_FILE[type]);
    }

    /** 帧的原始宽高比（宽/高） */
    aspectOf(name: string): number {
        const s = this.sizes.get(name);
        return s && s.height > 0 ? s.width / s.height : 2;
    }

    aspectOfFrame(frame: SpriteFrame): number {
        const t = frame.texture;
        if (!t) return 2;
        const r = frame.rect;
        return r.height > 0 ? r.width / r.height : 2;
    }

    // ---------- 工厂 ----------

    /** 创建挂接 Sprite 的节点；指定宽度，高度按帧比例自动；可强制尺寸 */
    makeSprite(parent: Node, frame: SpriteFrame | null, name: string, width: number, fixedHeight?: number): Node {
        const node = new Node(name);
        node.parent = parent;
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform);
        node.addComponent(Sprite).sizeMode = Sprite.SizeMode.CUSTOM;
        this.setSprite(node, frame, width, fixedHeight);
        return node;
    }

    setSprite(node: Node, frame: SpriteFrame | null, width: number, fixedHeight?: number): void {
        const ratio = frame ? this.aspectOfFrame(frame) : 2;
        node.getComponent(UITransform)!.setContentSize(width, fixedHeight ?? width / ratio);
        node.getComponent(Sprite)!.spriteFrame = frame;
    }
}
