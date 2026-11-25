import {
    _decorator, BlockInputEvents, Button, Camera, Canvas, Color, Component, Graphics, Label,
    Layers, Node, profiler, ResolutionPolicy, SubContextView, sys, tween, Tween, UIOpacity, UITransform, Vec3, view,
} from 'cc';
import { GameManager, TUTORIAL_CAP_BASE, TUTORIAL_CAP_SOURCE } from '../core/GameManager';
import { ALL_ORDERS_BONUS, DELETE_CHANCE_MAX, MAX_LAYERS, orderPriceTier } from '../core/GameConfig';
import { ALL_FOOD_TYPES, FOOD_INFO, FoodType } from '../core/FoodType';
import { STARTING_STOCK } from '../core/FoodGenerator';
import { isLegalUnfinished, recipeLayerCount } from '../core/Recipe';
import { ArtAssets } from './ArtAssets';
import { BasketView } from './BasketView';
import { drawChef } from './ChefView';
import { strokeOutline } from './FoodOutline';
import { pickFoodStory } from './FoodStories';
import { KitchenAudio } from './KitchenAudio';
import { drawButtonSkin, drawCoin, drawKitchenIcon, KitchenIcon } from './KitchenUiArt';
import { OrderView } from './OrderView';
import { PlateView } from './PlateView';

const { ccclass } = _decorator;
const WIDTH = 720;
const HEIGHT = 1240;
const BOTTOM_TOUCH_MARGIN = 38;
const HEADER_Y = 532;
const TOOLS_Y = 593;
const SCENERY_BANDS = [
    { y: 620, growth: 0.5 }, { y: 234, growth: 0.5 },
    { y: 218, growth: 0.12 }, { y: -176, growth: 0.12 },
    { y: -265, growth: -0.5 }, { y: -620, growth: -0.5 },
];
const SCENERY_NAME = 'kitchen_service_pass';
const COLUMNS = [-232, 0, 232];
const INK = '#49382E';
const MUTED = '#735D4C';
const GREEN = '#385B44';
const RED = '#97493C';
const PAPER = '#FFF8E9';
const TUTORIAL_SEEN = 'pile-up-tutorial-v1';
const BEST_BALANCE = 'pile-up-best-balance-v1';
const RANK_TYPE = 'pile-up-friends';
const FRIEND_SCOPE = 'scope.WxFriendInteraction';
const SERVE_BURSTS = {
    sage: { coins: 3, spread: 37, lift: 42, glints: 1, color: '#C3D799' },
    amber: { coins: 6, spread: 67, lift: 65, glints: 3, color: '#FFE29A' },
    red: { coins: 9, spread: 99, lift: 91, glints: 5, color: '#FFD0A1' },
} as const;
const COMBO_STYLES = [
    { ink: '#603D21', paper: '#F3D18C', glints: 2, spread: 124 },
    { ink: '#FFF3D4', paper: '#A65D36', glints: 4, spread: 146 },
    { ink: '#FFF3D4', paper: '#8F392C', glints: 6, spread: 173 },
] as const;
type WechatAuthorization = { success: () => void; fail: (error: { errMsg?: string }) => void };
type RankOpenDataContext = { canvas: object; postMessage: (message: object) => void };

declare const wx: {
    getMenuButtonBoundingClientRect?: () => { bottom: number };
    getWindowInfo?: () => { windowHeight: number };
    getSystemInfoSync?: () => { windowHeight: number };
    getOpenDataContext?: () => RankOpenDataContext | undefined;
    requirePrivacyAuthorize?: (options: WechatAuthorization) => void;
    authorize?: (options: WechatAuthorization & { scope: string }) => void;
} | undefined;
const LESSON = [
    ['basket-left', '点左边篮子预览食材'],
    ['basket-left', '再点一次，取走整篮'],
    ['hand', '点生菜，选中它'],
    ['plate-left', '点左盘，放下生菜'],
    ['hand', '接着选番茄'],
    ['plate-left', '把番茄放在同一个盘子'],
    ['Salad', '点带对勾的订单出餐\n同一条绿色带内，食材可以互换顺序'],
    ['end', '每回合只取一篮，放完即可结束回合'],
    ['cap', '练习盘已备好，点盖帽'],
    ['plate-middle', '先点中盘，拿起这一叠'],
    ['plate-left', '再点左盘，翻扣过去\n中盘原本最上层的肉饼先落下'],
] as const;

@ccclass('GameRoot')
export class GameRoot extends Component {
    private gm = new GameManager();
    private art!: ArtAssets;
    private audio!: KitchenAudio;
    private camera?: Camera;
    private backdrop!: Node;
    private content!: Node;
    private scenery: Node[] = [];
    private screenRows: { node: Node; y: number; growth: number }[] = [];
    private orders!: Node;
    private hand!: Node;
    private modal!: Node;
    private stopServiceModal!: Node;
    private stopServiceButton!: Label;
    private loading = true;
    private handKey = '';
    private selected: number | null = null;
    private capMode = false;
    private capSource: number | null = null;
    private refreshingOrders = false;
    private picking: number | null = null;
    private pickupOrigins: Vec3[] = [];
    private swappingTicket: number | null = null;
    private actionEffects = new Set<Node>();
    private previewBasket: number | null = null;
    private cards: Array<{ key: string; node: Node } | undefined> = [];
    private plates: PlateView[] = [];
    private baskets: BasketView[] = [];
    private plateCount: Label[] = [];
    private basketCount: Label[] = [];
    private stockCounts = new Map<FoodType, Label>();
    private lastFoodStories = new Map<FoodType, string>();
    private tiles: Node[] = [];
    private handFaces: Array<{ node: Node; glow: UIOpacity; selected: boolean }> = [];
    private score!: Label;
    private turn!: Label;
    private ordersServed!: Label;
    private ordersTotal!: Label;
    private end!: Label;
    private clear!: Label;
    private clearUses!: Label;
    private clearCountdown!: Label;
    private cap!: Label;
    private swap!: Label;
    private chefBubble!: Label;
    private capBubbleIcon!: Node;
    private coinBurst: Node | null = null;
    private comboBurst: Node | null = null;
    private stopCapMotion: (() => void) | null = null;
    private finalScore!: Label;
    private finalTitle!: Label;
    private finalDetail!: Label;
    private rankModal!: Node;
    private rankCanvas!: Node;
    private rankStatus!: Label;
    private rankBack!: Label;
    private rankSession = 0;
    private rankContext: RankOpenDataContext | null = null;
    private bestBalance = 0;
    private mainMenu!: Node;
    private menuBackground?: UITransform;
    private menuAspect = WIDTH / HEIGHT;
    private menuStart!: Label;
    private hasStarted = false;
    private lessonStep: number | null = null;
    private suspendedGame: GameManager | null = null;
    private lessonPanel!: Node;
    private lessonFocus!: Graphics;
    private lessonArrow!: Node;
    private lessonProgress!: Label;
    private lessonText!: Label;
    private lessonDetail!: Label;
    private lessonDiagram!: Node;
    private lessonNotes!: Node;
    private lessonSkip!: Node;
    private lessonFinish!: Node;

    onLoad(): void {
        profiler.hideStats();
        view.setDesignResolutionSize(WIDTH, 1280, ResolutionPolicy.FIXED_WIDTH);
        const canvas = this.node.parent;
        const canvasComponent = canvas?.getComponent(Canvas);
        if (canvasComponent) canvasComponent.alignCanvasWithScreen = false;
        canvas?.setPosition(0, 0, 0);
        canvas?.setScale(1, 1, 1);
        const cameraNode = canvas?.getChildByName('Camera');
        cameraNode?.setPosition(0, 0, 1000);
        this.camera = cameraNode?.getComponent(Camera) ?? undefined;
        this.backdrop = this.box(this.node, 'Backdrop', WIDTH, HEIGHT, 0, 0);
        this.content = this.box(this.node, 'Kitchen', WIDTH, HEIGHT, 0, 0);
        view.setResizeCallback(() => this.fitScreen());
        this.fitScreen();
        this.art = this.node.addComponent(ArtAssets);
        this.audio = this.node.addComponent(KitchenAudio);
        this.loadKitchen();
    }

    onDestroy(): void {
        this.stopCapMotion?.();
        view.setResizeCallback(null);
        this.gm.onStateChanged = null;
    }

    private loadKitchen(): void {
        this.loading = true;
        this.content.destroyAllChildren();
        this.label(this.content, '正在准备食材…', 0, 24, 600, 60, 34);
        this.art.loadAll((ready) => {
            if (!this.isValid) return;
            this.content.destroyAllChildren();
            this.loading = false;
            if (!ready) {
                this.label(this.content, '厨房素材加载失败', 0, 60, 600, 60, 34, RED);
                this.label(this.content, '请重试加载后再开始游戏', 0, 8, 600, 42, 23, MUTED);
                this.button(this.content, '重新加载', 0, -66, 224, 64, GREEN, 'swap', () => {
                    if (!this.loading) this.loadKitchen();
                });
                return;
            }
            this.build();
            try { this.bestBalance = Number(sys.localStorage.getItem(BEST_BALANCE)) || 0; }
            catch { /* 局内记录仍可用。 */ }
            this.gm.onStateChanged = () => this.refresh();
            this.refresh();
            this.fitScreen();
        });
    }

    private fitScreen(): void {
        const frame = view.getFrameSize();
        if (frame.width <= 0 || frame.height <= 0) return;
        const height = WIDTH * frame.height / frame.width;
        if (this.camera) this.camera.orthoHeight = height / 2;
        const visible = view.getVisibleSize();
        const safe = sys.getSafeAreaRect(false);
        const widthRatio = WIDTH / Math.max(1, visible.width);
        const heightRatio = height / Math.max(1, visible.height);
        const safeW = Math.min(WIDTH, (safe.width || visible.width) * widthRatio);
        const safeBottom = Math.max(0, safe.y * heightRatio) + BOTTOM_TOUCH_MARGIN;
        let safeTop = safe.height > 0 ? Math.min(height, (safe.y + safe.height) * heightRatio) : height;
        if (typeof wx !== 'undefined' && wx.getMenuButtonBoundingClientRect) {
            const windowHeight = (wx.getWindowInfo?.() ?? wx.getSystemInfoSync?.())?.windowHeight;
            const capsuleBottom = wx.getMenuButtonBoundingClientRect()?.bottom;
            if (windowHeight && capsuleBottom && capsuleBottom > 0 && capsuleBottom < windowHeight * 0.35) {
                safeTop = Math.min(safeTop, height * (1 - (capsuleBottom + 6) / windowHeight));
            }
        }
        const safeH = Math.max(1, safeTop - safeBottom);
        const scale = Math.min(safeW / WIDTH, safeH / HEIGHT, 1);
        const extra = Math.max(0, safeH / scale - HEIGHT);
        this.content.setScale(scale, scale, 1);
        this.content.setPosition(safe.width > 0 ? (safe.x + safe.width / 2 - visible.width / 2) * widthRatio : 0,
            (safeBottom + safeTop - height) / 2, 0);
        for (const { node, y, growth } of this.screenRows) node.setPosition(node.position.x, y + extra * growth, 0);
        for (const basket of this.baskets) basket.alignPreview();
        const fullWidth = (WIDTH + Math.abs(this.content.position.x) * 2) / scale;
        const fullHeight = (height + Math.abs(this.content.position.y) * 2) / scale;
        this.fitScenery(height, scale, extra, fullWidth);
        if (this.menuBackground) {
            const menuWidth = Math.max(fullWidth, fullHeight * this.menuAspect);
            this.menuBackground.setContentSize(menuWidth, menuWidth / this.menuAspect);
        }
        if (this.mainMenu) {
            for (const overlay of [this.mainMenu, this.modal, this.stopServiceModal, this.rankModal]) {
                overlay.getComponent(UITransform)!.setContentSize(fullWidth, fullHeight);
                const fill = overlay.getComponent(Graphics)!;
                fill.clear();
                this.paint(fill, 0, 0, fullWidth, fullHeight, 0, overlay === this.mainMenu ? '#F3E5CC' : '#3C2E29B8');
            }
            this.refreshTutorial();
        }
        const g = this.backdrop.getComponent(Graphics) ?? this.backdrop.addComponent(Graphics);
        g.clear();
        g.fillColor = new Color('#F3E5CC');
        g.rect(-WIDTH / 2 - 1, -height / 2 - 1, WIDTH + 2, height + 2);
        g.fill();
    }

    private fitScenery(height: number, scale: number, extra: number, width: number): void {
        const edges = SCENERY_BANDS.map(({ y, growth }) => y + extra * growth);
        edges.unshift(Math.max(edges[0], (height / 2 - this.content.position.y) / scale));
        edges.push(Math.min(edges[edges.length - 1], (-height / 2 - this.content.position.y) / scale));
        this.scenery.forEach((node, index) => {
            const top = edges[index];
            const bottom = edges[index + 1];
            node.active = top > bottom;
            node.setPosition(0, (top + bottom) / 2, 0);
            node.getComponent(UITransform)!.setContentSize(width + 2, top - bottom + 1);
        });
    }

    private build(): void {
        const root = this.content;
        const cuts = SCENERY_BANDS.map(({ y }) => (HEIGHT / 2 - y) / HEIGHT);
        // Reflect the illustration edges into the reserved capsule and home-indicator margins.
        const bands = [[0, 0.045], ...cuts.slice(1).map((to, index) => [cuts[index], to]), [0.982, 1]];
        this.scenery = bands.map(([from, to], index) => {
            const node = this.art.makeSprite(root, this.art.getHorizontalBand(SCENERY_NAME, from, to),
                'SceneryBand_' + index, WIDTH, 1);
            if (index === 0 || index === bands.length - 1) node.setScale(1, -1, 1);
            return node;
        });
        this.panel(root, 'TurnBadge', -275, HEADER_Y, 124, 46, 15, '#F4E5C8');
        this.turn = this.label(root, '', -275, HEADER_Y, 115, 42, 25);
        this.panel(root, 'Till', -132, HEADER_Y, 142, 46, 15, '#EDCCA0');
        this.score = this.label(root, '', -117, HEADER_Y, 104, 42, 29);
        drawCoin(this.box(root, 'WalletCoin', 31, 31, -178, HEADER_Y).addComponent(Graphics), 13);
        const sound = this.panel(root, 'SoundToggle', -247, TOOLS_Y, 47, 43, 12, PAPER);
        const soundArt = this.box(sound, 'SoundIcon', 32, 32, 0, 0).addComponent(Graphics);
        const paintSound = () => drawKitchenIcon(soundArt, this.audio.muted ? 'muted' : 'sound', '#78593D');
        paintSound();
        this.bind(sound, () => {
            this.audio.toggleMute();
            paintSound();
        }, true);
        const restart = this.panel(root, 'QuickRestart', -182, TOOLS_Y, 47, 43, 12, PAPER);
        drawKitchenIcon(this.box(restart, 'RestartIcon', 32, 32, 0, 0).addComponent(Graphics), 'restart', '#78593D');
        this.bind(restart, () => {
            this.suspendedGame = null;
            this.leaveTutorialOrRestart();
        }, true);
        const help = this.panel(root, 'TutorialHelp', -117, TOOLS_Y, 47, 43, 12, PAPER);
        drawKitchenIcon(this.box(help, 'HelpIcon', 32, 32, 0, 0).addComponent(Graphics), 'help', '#78593D');
        this.bind(help, () => this.replayTutorial(), true);
        const home = this.panel(root, 'MainMenuButton', -312, TOOLS_Y, 47, 43, 12, PAPER);
        drawKitchenIcon(this.box(home, 'HomeIcon', 32, 32, 0, 0).addComponent(Graphics), 'home', '#78593D');
        this.bind(home, () => this.showMainMenu(), true);
        this.stopServiceButton = this.button(root, '暂停营业', 232, TOOLS_Y, 216, 51, '#A9332D', 'pause',
            () => { this.stopServiceModal.active = true; }, false, 'button_stop_service');
        this.stopServiceButton.fontSize = 27;
        this.stopServiceButton.lineHeight = 30;
        this.swap = this.button(root, '换单', 49, HEADER_Y, 169, 46, '#8E5F39', 'swap', () => this.toggleRefreshOrders());
        this.orders = this.box(root, 'Orders', WIDTH, 268, 0, 368);
        const orderCount = this.box(root, 'OrderProgress', 156, 48, 260, HEADER_Y);
        const ticket = this.box(orderCount, 'OrderTicketIcon', 42, 42, -56, 0);
        ticket.setScale(1.38, 1.38, 1);
        drawKitchenIcon(ticket.addComponent(Graphics), 'ticket', '#694431');
        this.ordersServed = this.label(orderCount, '', -12, 1, 62, 48, 44, '#3B2518');
        this.ordersServed.horizontalAlign = Label.HorizontalAlign.RIGHT;
        this.ordersTotal = this.label(orderCount, '', 52, -2, 59, 43, 31, '#563827', true);
        for (const number of [this.ordersServed, this.ordersTotal]) {
            number.enableOutline = true;
            number.outlineColor = new Color('#FFF4D9');
            number.outlineWidth = 1.5;
        }

        const prep = this.box(root, 'PrepCounter', 684, 320, 0, 72);
        const chef = this.box(prep, 'ChefIcon', 70, 70, 295, 112);
        drawChef(chef.addComponent(Graphics));
        const plateRow = this.box(root, 'Plates', WIDTH, 244, 0, 53);
        for (let i = 0; i < COLUMNS.length; i++) {
            const plate = PlateView.create(this.art, plateRow, i, { width: 207, height: 244, foodWidth: 130 });
            plate.node.setPosition(COLUMNS[i], 0, 0);
            this.bind(plate.node, () => this.place(i));
            this.plates.push(plate);
            this.panel(plate.node, 'CapacityBadge', 0, -111, 130, 26, 13, '#F5F2E4');
            this.plateCount.push(this.label(plate.node, '', 0, -111, 126, 26, 17, GREEN));
        }

        this.panel(root, 'HandBoard', 0, -131, 684, 69, 17, '#FFF3DFD9');
        this.hand = this.box(root, 'Hand', 684, 69, 0, -131);

        const basketPreviewLayer = this.box(root, 'BasketPreviewLayer', WIDTH, HEIGHT, 0, 0);
        const basketRow = this.box(root, 'Baskets', WIDTH, 218, 0, -348);
        for (let i = 0; i < COLUMNS.length; i++) {
            const take = () => this.take(i);
            const basket = BasketView.create(this.art, basketRow, basketPreviewLayer, i,
                { width: 212, height: 218, foodWidth: 108 }, () => this.interact(basket.node, take));
            basket.node.setPosition(COLUMNS[i], 0, 0);
            this.bind(basket.node, take);
            this.baskets.push(basket);
            this.panel(basket.node, 'CountBadge', 0, -84, 102, 28, 14, PAPER);
            this.basketCount.push(this.label(basket.node, '', 0, -84, 98, 28, 17));
        }

        const stock = this.panel(root, 'Stock', 0, -493, 684, 64, 16, PAPER);
        ALL_FOOD_TYPES.forEach((food, index) => {
            const x = (index - 3) * 95;
            const chip = this.panel(stock, 'Stock_' + food, x, 0, 88, 54, 11, '#F2E7D1');
            this.art.makeSprite(chip, this.art.getFood(food), 'StockIcon_' + food, 33).setPosition(0, 13, 0);
            const numerator = this.label(chip, '', -18, -11, 36, 28, 24);
            numerator.horizontalAlign = Label.HorizontalAlign.RIGHT;
            this.stockCounts.set(food, numerator);
            this.label(chip, '/' + STARTING_STOCK[food], 20, -13, 40, 24, 17, MUTED, true);
            this.bind(chip, () => this.describeFood(food));
        });
        this.clear = this.button(root, '回收', -232, -566, 212, 62, '#A16046', 'clear', () => this.toggleClear());
        this.cap = this.button(root, '盖帽', 0, -566, 218, 62, '#8E5F39', 'cap', () => this.toggleCap());
        this.end = this.button(root, '结束回合', 232, -566, 212, 62, GREEN, 'end', () => this.endTurn());
        const clearStatus = this.panel(root, 'ClearStatus', -232, -609, 117, 23, 11, PAPER);
        this.clearUses = this.label(clearStatus, '', 0, 0, 112, 23, 16, MUTED);
        const timer = this.panel(root, 'ClearCountdown', -135, -589, 32, 32, 16, '#FFF0CD');
        this.clearCountdown = this.label(timer, '', 0, 0, 32, 32, 22, RED);
        basketPreviewLayer.setSiblingIndex(root.children.length - 1);
        this.buildChefBubble();
        this.buildTutorial();
        this.buildStopService();
        this.buildGameOver();
        this.buildMainMenu();
        this.buildFriendRank();
        const group = (growth: number, names: string[]) => names.map((name) => {
            const node = root.getChildByName(name)!;
            return { node, y: node.position.y, growth };
        });
        this.screenRows = [
            ...group(0.5, ['TurnBadge', 'Till', 'WalletCoin', 'SoundToggle', 'QuickRestart', 'TutorialHelp',
                'MainMenuButton', '暂停营业', '换单', 'Orders', 'OrderProgress']),
            { node: this.turn.node, y: HEADER_Y, growth: 0.5 },
            { node: this.score.node, y: HEADER_Y, growth: 0.5 },
            ...group(0.12, ['PrepCounter', 'Plates', 'HandBoard', 'Hand', 'ChefSpeech']),
            ...group(-0.5, ['Baskets', 'Stock', '回收', '盖帽', '结束回合', 'ClearStatus', 'ClearCountdown']),
        ];
    }

    private buildChefBubble(): void {
        const bubble = this.box(this.content, 'ChefSpeech', 395, 71, 56, 184);
        const speech = bubble.addComponent(Graphics);
        this.paint(speech, 0, -4, 395, 71, 19, '#B9C4AA');
        speech.fillColor = new Color(PAPER);
        speech.strokeColor = new Color('#A87550');
        speech.lineWidth = 2.7;
        speech.moveTo(-178, 35);
        speech.lineTo(178, 35);
        speech.quadraticCurveTo(197, 35, 197, 16);
        speech.lineTo(197, 10);
        speech.quadraticCurveTo(213, 7, 221, 0);
        speech.quadraticCurveTo(208, -4, 197, -9);
        speech.lineTo(197, -16);
        speech.quadraticCurveTo(197, -35, 178, -35);
        speech.lineTo(-178, -35);
        speech.quadraticCurveTo(-197, -35, -197, -16);
        speech.lineTo(-197, 16);
        speech.quadraticCurveTo(-197, 35, -178, 35);
        speech.close();
        speech.fill();
        speech.stroke();
        this.chefBubble = this.label(bubble, '', 0, 0, 362, 50, 26, RED);
        this.capBubbleIcon = this.box(bubble, 'CapDiagram', 44, 44, -157, 0);
        this.capBubbleIcon.setScale(1.43, 1.43, 1);
        drawKitchenIcon(this.capBubbleIcon.addComponent(Graphics), 'cap', '#87613E');
        this.capBubbleIcon.active = false;
        bubble.addComponent(UIOpacity);
        bubble.active = false;
    }

    private buildTutorial(): void {
        this.lessonFocus = this.box(this.content, 'TutorialFocus', 0, 0, 0, 0).addComponent(Graphics);
        this.lessonArrow = this.box(this.content, 'TutorialPointer', 38, 36, 0, 0);
        const pointer = this.lessonArrow.addComponent(Graphics);
        pointer.fillColor = new Color('#FFDC88');
        pointer.strokeColor = new Color('#60392C');
        pointer.lineWidth = 3;
        pointer.moveTo(-16, 4);
        pointer.lineTo(-6, 4);
        pointer.lineTo(-6, 16);
        pointer.lineTo(6, 16);
        pointer.lineTo(6, 4);
        pointer.lineTo(16, 4);
        pointer.lineTo(0, -13);
        pointer.close();
        pointer.fill();
        pointer.stroke();
        this.lessonPanel = this.panel(this.content, 'Tutorial', 0, 186, 592, 112, 20, PAPER);
        this.lessonProgress = this.label(this.lessonPanel, '', -123, 29, 285, 32, 23, GREEN, true);
        this.lessonText = this.label(this.lessonPanel, '', 0, 0, 548, 32, 24);
        this.lessonDetail = this.label(this.lessonPanel, '', 0, -27, 548, 29, 21, MUTED);
        this.lessonSkip = this.panel(this.lessonPanel, 'TutorialSkip', 233, 29, 90, 38, 15, '#EFE1CA');
        this.label(this.lessonSkip, '跳过', 0, 0, 90, 34, 20);
        this.bind(this.lessonSkip, () => this.leaveTutorialOrRestart(), true);
        this.lessonFinish = this.button(this.lessonPanel, '开始营业', 178, 29, 198, 44,
            GREEN, 'end', () => this.leaveTutorialOrRestart(), true).node.parent!;
        this.lessonDiagram = this.box(this.lessonPanel, 'CapLessonDiagram', 550, 94, 0, -49);
        this.buildCapDiagram();
        this.lessonNotes = this.box(this.lessonPanel, 'LessonNotes', 550, 98, 0, -36);
        this.addLessonNote('clear', '点回收再点盘子，耗一次，整盘回仓并洗牌', 17);
        this.addLessonNote('swap', '换单，再点订单，扣除按钮上显示的金额', -23);
    }

    private buildCapDiagram(): void {
        const root = this.lessonDiagram;
        const cards = [
            { x: -194, label: '中盘', foods: TUTORIAL_CAP_SOURCE },
            { x: -65, label: '左盘', foods: [TUTORIAL_CAP_BASE] },
            { x: 160, label: '翻扣后', foods: [TUTORIAL_CAP_BASE, ...TUTORIAL_CAP_SOURCE.slice().reverse()] },
        ];
        for (const { x, label, foods } of cards) {
            const card = this.panel(root, label, x, 0, 100, 94, 13, '#F1E5C9');
            const plate = this.box(card, 'Plate', 68, 14, 0, 0).addComponent(Graphics);
            plate.fillColor = new Color('#B5BFA1');
            plate.ellipse(0, -13, 34, 7);
            plate.fill();
            foods.forEach((food, i) => this.art.makeSprite(card, this.art.getFood(food), 'Layer', 48)
                .setPosition(0, -7 + i * 14, 0));
            this.label(card, label, 0, -33, 94, 23, 18, GREEN);
        }
        const arrows = root.addComponent(Graphics);
        arrows.strokeColor = new Color('#885B37');
        arrows.lineWidth = 3;
        arrows.moveTo(-136, 4);
        arrows.lineTo(-123, 4);
        arrows.moveTo(-129.5, -2.5);
        arrows.lineTo(-129.5, 10.5);
        arrows.moveTo(21, 1);
        arrows.lineTo(58, 1);
        arrows.lineTo(48, 10);
        arrows.moveTo(58, 1);
        arrows.lineTo(48, -8);
        arrows.stroke();
    }

    private addLessonNote(icon: 'clear' | 'swap', copy: string, y: number): void {
        const stamp = this.box(this.lessonNotes, icon, 32, 32, -247, y);
        drawKitchenIcon(stamp.addComponent(Graphics), icon, '#8E5F39');
        this.label(this.lessonNotes, copy, 12, y, 476, 32, 21, INK, true);
    }

    private hasSeenTutorial(): boolean {
        try { return sys.localStorage.getItem(TUTORIAL_SEEN) === '1'; }
        catch { return false; }
    }

    private startTutorial(): void {
        if (this.lessonStep !== null) return;
        this.lessonStep = 0;
        this.restartRound(true);
    }

    private replayTutorial(): void {
        this.mainMenu.active = false;
        if (this.lessonStep !== null) return;
        if (this.hasStarted && !this.gm.gameOver) {
            this.suspendedGame = this.gm;
            this.gm.onStateChanged = null;
            this.gm = new GameManager();
            this.gm.onStateChanged = () => this.refresh();
        }
        this.hasStarted = true;
        this.startTutorial();
    }

    private leaveTutorialOrRestart(): void {
        const teaching = this.lessonStep !== null;
        if (teaching) {
            try { sys.localStorage.setItem(TUTORIAL_SEEN, '1'); }
            catch { /* 本地存储不可用时仍可开局。 */ }
        }
        this.lessonStep = null;
        if (this.suspendedGame) {
            this.gm.onStateChanged = null;
            this.gm = this.suspendedGame;
            this.suspendedGame = null;
            this.gm.onStateChanged = () => this.refresh();
            this.resetRoundView();
            this.refresh();
        } else {
            this.restartRound();
            if (!teaching) this.message('新的一局开始了');
        }
    }

    private restartRound(tutorial = false): void {
        this.resetRoundView();
        this.gm.restart(tutorial);
    }

    private resetRoundView(): void {
        this.stopCapMotion?.();
        this.coinBurst?.destroy();
        this.coinBurst = null;
        this.clearComboBurst();
        this.clearActionEffects();
        this.selected = null;
        this.previewBasket = null;
        this.picking = null;
        this.resetCap();
        this.refreshingOrders = false;
        for (const basket of this.baskets) basket.resetView();
        this.message('');
    }

    private tutorialTarget(): Node | undefined {
        if (this.lessonStep === null) return;
        const target = LESSON[this.lessonStep]?.[0];
        switch (target) {
            case 'basket-left': return this.baskets[0].node;
            case 'hand': return this.tiles[0];
            case 'plate-left': return this.plates[0].node;
            case 'plate-middle': return this.plates[1].node;
            case 'end': return this.end.node.parent!;
            case 'cap': return this.cap.node.parent!;
            case 'Salad':
                return this.cards[this.gm.orders.findIndex((recipe) => recipe.id === target)]?.node;
        }
    }

    private refreshTutorial(): void {
        const ring = this.lessonFocus;
        ring.clear();
        const step = this.lessonStep;
        this.lessonPanel.active = step !== null;
        this.stopServiceButton.node.parent!.active = step === null;
        Tween.stopAllByTarget(this.lessonArrow);
        this.lessonArrow.active = false;
        if (step === null) return;
        const entry = LESSON[step];
        const capLesson = !!entry && step >= LESSON.length - 3;
        const panelHeight = capLesson ? 226 : entry ? 112 : 170;
        const panel = this.lessonPanel;
        panel.getComponent(UITransform)!.setContentSize(592, panelHeight);
        const paper = panel.getComponent(Graphics)!;
        paper.clear();
        this.paint(paper, 0, -4, 592, panelHeight, 20, '#432D23B3');
        this.paint(paper, 0, 0, 592, panelHeight, 20, PAPER);
        for (const node of [this.lessonProgress.node, this.lessonSkip, this.lessonFinish]) {
            node.setPosition(node.position.x, panelHeight / 2 - 27, 0);
        }
        const [instruction, detail] = entry?.[1].split('\n') ?? [];
        this.lessonText.node.setPosition(0, panelHeight / 2 - (detail ? 58 : 73), 0);
        this.lessonDetail.node.setPosition(0, panelHeight / 2 - 86, 0);
        this.lessonProgress.string = entry ? '新手教程  ' + (step + 1) + '/' + LESSON.length : '练习完成';
        this.lessonText.string = instruction ?? '';
        this.lessonDetail.string = detail ?? '';
        this.lessonDiagram.active = capLesson;
        this.lessonNotes.active = !entry;
        this.lessonSkip.active = !!entry;
        this.lessonFinish.active = !entry;
        const target = entry ? this.tutorialTarget() : this.plates[0].node;
        if (!target) {
            panel.setPosition(0, 190, 0);
            return;
        }
        const center = this.content.getComponent(UITransform)!.convertToNodeSpaceAR(target.worldPosition);
        const { width, height } = target.getComponent(UITransform)!;
        const plate = this.plates.some((candidate) => candidate.node === target);
        const left = center.x - width / 2 - 7;
        const right = center.x + width / 2 + 7;
        const bottom = center.y - height / 2 - 5;
        const top = plate ? center.y + (entry ? 43 : 76)
            : center.y + height / 2 + (entry?.[0] === 'basket-left' && step === 1 ? 106 : 6);
        const panelY = capLesson || !entry ? this.hand.position.y - 157
            : entry[0] === 'basket-left' ? 166
                : center.y > 250 ? bottom - 70 : top + 113;
        panel.setPosition(0, panelY, 0);
        const ortho = this.camera?.orthoHeight ?? HEIGHT / 2;
        const screenHalf = (ortho + Math.abs(this.content.position.y)) / this.content.scale.y + 2;
        const screenWidth = (WIDTH / 2 + Math.abs(this.content.position.x)) / this.content.scale.x + 2;
        ring.fillColor = new Color(capLesson || !entry ? '#301F1860' : '#301F1885');
        ring.rect(-screenWidth, -screenHalf, screenWidth * 2, bottom + screenHalf);
        ring.rect(-screenWidth, top, screenWidth * 2, screenHalf - top);
        ring.rect(-screenWidth, bottom, left + screenWidth, top - bottom);
        ring.rect(right, bottom, screenWidth - right, top - bottom);
        ring.fill();
        ring.roundRect(left, bottom, right - left, top - bottom, 16);
        ring.lineWidth = 5;
        ring.strokeColor = new Color('#FFDE88');
        ring.stroke();
        if (entry) {
            this.lessonArrow.active = true;
            const rest = new Vec3(center.x, top + 20, 0);
            this.lessonArrow.setPosition(rest);
            tween(this.lessonArrow).repeatForever(tween<Node>()
                .to(0.42, { position: new Vec3(rest.x, rest.y + 8, 0) }, { easing: 'sineOut' })
                .to(0.42, { position: rest }, { easing: 'sineIn' })).start();
        }
    }

    private refresh(): void {
        this.stopCapMotion?.();
        this.refreshOrders();
        for (let i = 0; i < COLUMNS.length; i++) {
            const foods = this.gm.plates[i].foods;
            this.plates[i].setFoods(foods);
            this.plateCount[i].string = foods.length + '/' + MAX_LAYERS;
            if (i !== this.picking) {
                this.baskets[i].setFoods(this.gm.piles[i]);
                this.updateBasketCount(i);
            }
            this.baskets[i].setDimmed(!this.gm.canTakePile(i));
            this.baskets[i].setExpanded(this.previewBasket === i && this.gm.canTakePile(i));
        }
        const remaining = this.gm.getRemainingFoodCounts();
        for (const [food, label] of this.stockCounts) {
            const count = remaining.get(food) ?? 0;
            label.string = String(count);
            label.color = new Color(count > 0 ? INK : MUTED);
        }
        this.refreshHand();
        this.refreshSelection();
        this.turn.string = '回合 ' + this.gm.turn;
        this.score.string = '$' + this.gm.score;
        this.ordersServed.string = String(this.gm.completedOrders);
        this.ordersTotal.string = '/' + this.gm.totalOrderCount;
        this.swap.string = this.refreshingOrders ? '取消换单' : '换单 $' + this.gm.orderRefreshPrice;
        this.setButtonMuted(this.swap, !this.refreshingOrders && !this.gm.checkOrderRefresh().ok);
        this.clear.string = this.gm.deleteMode ? '取消回收' : '回收';
        this.clearUses.string = '剩余 ' + this.gm.deleteChances + '/' + DELETE_CHANCE_MAX;
        const refill = this.gm.turnsUntilDeleteRefill;
        this.clearCountdown.node.parent!.active = refill !== null;
        this.clearCountdown.string = refill?.toString() ?? '';
        this.end.string = this.gm.suppliesExhausted ? '结算收摊' : '结束回合';
        this.setButtonMuted(this.clear, !this.gm.canEnterDeleteMode());
        this.setButtonMuted(this.end, !this.gm.canEndTurn());
        this.modal.active = this.gm.gameOver;
        if (this.gm.gameOver) {
            if (this.lessonStep === null && this.gm.score > this.bestBalance) {
                this.bestBalance = this.gm.score;
                try { sys.localStorage.setItem(BEST_BALANCE, String(this.bestBalance)); }
                catch { /* 局内记录仍可用。 */ }
            }
            const soldOut = this.gm.gameOverReason === 'out-of-stock';
            const allServed = this.gm.gameOverReason === 'all-orders-served';
            const stopped = this.gm.gameOverReason === 'manual-stop';
            this.finalTitle.string = allServed ? '全部订单已完成' : soldOut ? '食材用完了'
                : stopped ? '已暂停营业' : '三个盘子都满了';
            this.finalDetail.string = allServed ? '全单奖励  +$' + ALL_ORDERS_BONUS
                : stopped ? '已完成 ' + this.gm.completedOrders + '/' + this.gm.totalOrderCount + ' 单'
                    : soldOut ? '今日营业结束' : '无法出餐、回收或换单';
            this.finalScore.string = '结算余额  $' + this.gm.score;
        }
        this.refreshTutorial();
    }

    private updateBasketCount(index: number): void {
        const previewing = index === this.previewBasket;
        const count = this.gm.piles[index].length;
        const label = this.basketCount[index];
        const badge = label.node.parent!.getChildByName('CountBadge')!.getComponent(Graphics)!;
        badge.clear();
        this.paint(badge, 0, 0, 102, 28, 14, previewing ? '#375E48' : PAPER);
        label.color = new Color(previewing ? PAPER : INK);
        label.string = previewing && count > 0 ? '再点取走' : String(count);
    }

    private refreshOrders(): void {
        for (const card of this.cards.splice(this.gm.orders.length)) {
            if (!card) continue;
            card.node.active = false;
            card.node.destroy();
        }
        const ready = new Set(this.gm.findSubmittableOrders().map((match) => match.orderIndex));
        this.gm.orders.forEach((recipe, index) => {
            const submittable = ready.has(index);
            const making = this.gm.plates.some(({ foods }) =>
                foods.length > 0 && foods.length < recipeLayerCount(recipe) && isLegalUnfinished(foods, recipe));
            const refreshPrice = this.refreshingOrders ? this.gm.orderRefreshPrice : undefined;
            const key = recipe.id + ':' + making + ':' + submittable + ':' + refreshPrice;
            const current = this.cards[index];
            if (current?.key === key) return;
            const isNew = !current || current.node.name !== 'Order_' + recipe.id;
            if (current) {
                current.node.active = false;
                current.node.destroy();
            }
            const node = OrderView.build(this.art, this.orders, recipe, {
                width: 216, height: 264, making, submittable, index, refreshPrice,
                onInspect: (food, detail) => {
                    this.interact(node, () => {
                        if (this.lessonStep !== null) this.serve(index);
                        else if (this.refreshingOrders) this.refreshTicket(index);
                        else this.message(FOOD_INFO[food].nameZh + '，' + detail);
                    });
                },
            });
            node.setPosition(COLUMNS[index], 0, 0);
            this.bind(node, () => {
                if (this.refreshingOrders) this.refreshTicket(index);
                else this.serve(index);
            });
            this.cards[index] = { key, node };
            if (index === this.swappingTicket) {
                node.setPosition(COLUMNS[index], 19, 0);
                node.setScale(0.84, 0.91, 1);
                const opacity = node.addComponent(UIOpacity);
                opacity.opacity = 0;
                tween(opacity).delay(0.08).to(0.16, { opacity: 255 }).start();
                tween(node).delay(0.08).to(0.22, {
                    position: new Vec3(COLUMNS[index], 0, 0), scale: Vec3.ONE,
                }, { easing: 'backOut' }).start();
            } else if (isNew) {
                node.setScale(0.88, 0.88, 1);
                tween(node).delay(index * 0.025).to(0.24, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
            }
        });
    }

    private refreshHand(): void {
        const key = this.gm.hand.join(',');
        if (key === this.handKey) return;
        this.handKey = key;
        for (const tile of this.tiles) tile.destroy();
        this.handFaces = [];
        this.tiles = this.gm.hand.map((food, i) => {
            const x = (i - (this.gm.hand.length - 1) / 2) * 123;
            const tile = this.box(this.hand, 'Hand_' + i, 108, 61, x, 0);
            const face = this.box(tile, 'HandFace', 108, 61, 0, 0);
            const visual = this.box(face, 'HandVisual', 108, 61, 0, 0);
            const outline = this.box(visual, 'SelectionGlow', 108, 61, 0, 0);
            const frame = this.art.getFood(food);
            const sprite = this.art.makeSprite(visual, frame, 'Ingredient', 92);
            const size = sprite.getComponent(UITransform)!;
            strokeOutline(outline.addComponent(Graphics),
                [{ width: size.width, height: size.height, y: 0, frameName: frame?.name }]);
            const glow = outline.addComponent(UIOpacity);
            glow.opacity = 0;
            this.handFaces.push({ node: face, glow, selected: false });
            this.bind(tile, () => {
                this.cancelOrderRefresh();
                this.resetCap();
                this.gm.cancelDeleteMode();
                this.selected = this.selected === i ? null : i;
                this.refreshSelection();
            });
            const origin = this.pickupOrigins[i];
            if (origin) {
                const from = tile.getComponent(UITransform)!.convertToNodeSpaceAR(origin);
                visual.setPosition(from);
                visual.setScale(0.93, 0.93, 1);
                tween(visual).delay(i * 0.024)
                    .to(0.12, { position: new Vec3(from.x * 0.45, from.y * 0.4 + 19, 0) }, { easing: 'quadOut' })
                    .to(0.15, { position: Vec3.ZERO, scale: Vec3.ONE }, { easing: 'quadInOut' }).start();
            }
            return tile;
        });
    }

    private refreshSelection(): void {
        const selected = this.selected;
        const readyPlates = selected === null && !this.gm.gameOver && !this.refreshingOrders
            ? new Set(this.gm.findSubmittableOrders().map(({ plateIndex }) => plateIndex))
            : new Set<number>();
        const canCap = this.hasCapTarget();
        this.cap.string = this.capMode ? '取消盖帽' : '盖帽';
        this.setButtonMuted(this.cap, !this.capMode && !canCap);
        for (let i = 0; i < this.plates.length; i++) {
            const plate = this.plates[i];
            if (this.capMode) {
                if (this.capSource === null) plate.setHighlight(this.hasCapTarget(i) ? 'valid' : 'idle');
                else if (this.capSource === i) plate.setHighlight('source');
                else plate.setHighlight(this.gm.checkCap(this.capSource, i).ok ? 'valid' : 'invalid');
            } else if (this.gm.deleteMode) plate.setHighlight(this.gm.plates[i].isEmpty ? 'idle' : 'delete');
            else if (selected === null) plate.setHighlight(readyPlates.has(i) ? 'ready' : 'idle');
            else plate.setHighlight(this.gm.canPlaceFromHand(selected, i).ok ? 'valid' : 'invalid');
        }
        this.handFaces.forEach((face, index) => {
            const on = index === selected;
            if (on === face.selected) return;
            face.selected = on;
            Tween.stopAllByTarget(face.node);
            Tween.stopAllByTarget(face.glow);
            tween(face.node)
                .to(0.17, { scale: on ? new Vec3(1.14, 1.14, 1) : Vec3.ONE,
                    position: new Vec3(0, on ? 8 : 0, 0) }, { easing: on ? 'backOut' : 'quadOut' })
                .start();
            tween(face.glow).to(0.16, { opacity: on ? 255 : 0 }).start();
        });
    }

    private setBasketPreview(index: number | null): void {
        if (index === this.previewBasket) return;
        const previous = this.previewBasket;
        this.previewBasket = index;
        this.baskets.forEach((basket, i) => basket.setExpanded(i === index));
        if (previous !== null) this.updateBasketCount(previous);
        if (index !== null) this.updateBasketCount(index);
    }

    private take(index: number): void {
        this.cancelOrderRefresh();
        if (this.gm.canTakePile(index) && this.previewBasket !== index) {
            this.setBasketPreview(index);
            this.audio.play('preview');
            this.message('再点一次，取走这篮食材');
            return;
        }
        this.pickupOrigins = this.baskets[index].foodWorldPositions();
        this.setBasketPreview(null);
        this.picking = index;
        const result = this.gm.takePile(index);
        this.picking = null;
        this.pickupOrigins = [];
        if (result.ok === false) {
            if (result.reason === 'hand-not-empty') this.message('先把手上的食材放完', true);
            if (result.reason === 'pile-already-taken') this.message('本回合已经取过一篮', true);
            if (result.reason === 'empty-basket') this.message('这只篮子空了，选另一篮', true);
            return;
        }
        this.baskets[index].animatePickup(this.gm.piles[index], () => {
            this.updateBasketCount(index);
        });
        this.audio.play('take');
        this.message('已取 ' + this.gm.hand.length + ' 件，先选食材再点盘子');
    }

    private place(index: number): void {
        if (this.gm.gameOver) return;
        this.setBasketPreview(null);
        this.cancelOrderRefresh();
        if (this.capMode) {
            this.capOn(index);
            return;
        }
        if (this.gm.deleteMode) {
            if (this.gm.plates[index].isEmpty) {
                this.message('请选择有食材的盘子', true);
                return;
            }
            const foods = this.gm.plates[index].foods.slice();
            const positions = this.plates[index].foodWorldPositions();
            const result = this.gm.deletePlate(index);
            if (result.ok) {
                this.playStockReturn(foods, positions);
                this.plates[index].pulse();
                this.audio.play('place');
                this.message('食材已回收，仓库已重新洗牌');
            }
            return;
        }
        const selected = this.selected;
        if (selected === null) {
            this.message('先选一件待放置食材', true);
            return;
        }
        const check = this.gm.canPlaceFromHand(selected, index);
        if (!check.ok) {
            this.message('这个盘子已放满 6 层', true);
            return;
        }
        const source = this.handFaces[selected].node.getChildByName('HandVisual')!.worldPosition.clone();
        this.selected = null;
        const result = this.gm.placeFromHand(selected, index);
        if (result.ok) {
            this.plates[index].flyTopFrom(source);
            this.audio.play('place');
            this.message(this.gm.canEndTurn()
                ? this.gm.suppliesExhausted ? '最后出餐后，点击结算收摊' : '食材放完了，可以结束回合'
                : '');
        }
    }

    private serve(index: number): void {
        this.setBasketPreview(null);
        const match = this.gm.findSubmittableOrders().find(({ orderIndex }) => orderIndex === index);
        if (!match) {
            this.message('还没有盘子符合这张订单', true);
            return;
        }
        const recipe = this.gm.orders[index];
        this.resetCap();
        const oldCard = this.cards[index]?.node;
        const coinStart = oldCard?.worldPosition.clone() ?? this.orders.worldPosition.clone();
        this.cards[index] = undefined;
        this.plates[match.plateIndex].playClear();
        const result = this.gm.submitOrder(index, match.plateIndex);
        if (!result.ok) return;
        if (oldCard) {
            for (const button of oldCard.getComponentsInChildren(Button)) button.interactable = false;
            oldCard.setSiblingIndex(this.orders.children.length - 1);
            Tween.stopAllByTarget(oldCard);
            const opacity = oldCard.getComponent(UIOpacity) ?? oldCard.addComponent(UIOpacity);
            Tween.stopAllByTarget(opacity);
            tween(opacity).delay(0.07).to(0.20, { opacity: 0 }).start();
            tween(oldCard).to(0.09, { scale: new Vec3(1.08, 1.08, 1) })
                .to(0.20, { scale: new Vec3(0.86, 0.86, 1), position: new Vec3(COLUMNS[index], 37, 0) })
                .call(() => oldCard.destroy()).start();
        }
        this.plates[match.plateIndex].pulse();
        this.playCoinBurst(coinStart, recipe.score);
        this.audio.play('serve');
        if (result.comboBonus > 0) {
            this.message('');
            this.playComboBurst(result.comboCount, result.comboBonus);
        } else {
            this.message(recipe.nameZh + '已出餐，收入' + recipe.score + '元');
        }
    }

    private clearComboBurst(): void {
        if (!this.comboBurst) return;
        this.comboBurst.active = false;
        this.comboBurst.destroy();
        this.comboBurst = null;
    }

    private finishActionEffect(node: Node): void {
        this.actionEffects.delete(node);
        if (node.isValid) {
            node.active = false;
            node.destroy();
        }
    }

    private clearActionEffects(): void {
        for (const node of this.actionEffects) this.finishActionEffect(node);
    }

    private playStockReturn(foods: FoodType[], positions: Vec3[]): void {
        const layer = this.box(this.content, 'StockReturn', WIDTH, HEIGHT, 0, 0);
        layer.setSiblingIndex(this.chefBubble.node.parent!.getSiblingIndex());
        this.actionEffects.add(layer);
        const transform = layer.getComponent(UITransform)!;
        foods.forEach((food, index) => {
            const start = transform.convertToNodeSpaceAR(positions[index]);
            const chip = this.stockCounts.get(food)!.node.parent!;
            const end = transform.convertToNodeSpaceAR(chip.worldPosition);
            const item = this.art.makeSprite(layer, this.art.getFood(food), 'ReturnedFood', 112);
            item.setPosition(start);
            const delay = index * 0.025;
            const opacity = item.addComponent(UIOpacity);
            tween(opacity).delay(delay + 0.24).to(0.13, { opacity: 0 }).start();
            tween(item).delay(delay)
                .to(0.11, { position: new Vec3(start.x, start.y + 23, 0), scale: new Vec3(0.83, 0.83, 1) }, { easing: 'quadOut' })
                .to(0.26, { position: end, scale: new Vec3(0.24, 0.24, 1) }, { easing: 'quadInOut' })
                .call(() => {
                    if (index === foods.length - 1) this.finishActionEffect(layer);
                }).start();
        });
    }

    private playComboBurst(count: number, bonus: number): void {
        this.clearComboBurst();
        const tier = Math.min(count - 2, COMBO_STYLES.length - 1);
        const style = COMBO_STYLES[tier];
        const y = this.gm.gameOver ? 204 : this.orders.position.y - 151;
        const effect = this.box(this.content, 'ServeCombo', 250, 62, 0, y);
        if (!this.gm.gameOver) effect.setSiblingIndex(this.chefBubble.node.parent!.getSiblingIndex());
        this.comboBurst = effect;

        this.playServeGlints(effect, { ...style, lift: 29, color: '#FFD78B' }, tier === 2);
        const stamp = effect.addComponent(Graphics);
        this.paint(stamp, 0, -4, 244, 59, 19, '#70402AB0');
        this.paint(stamp, 0, 0, 244, 59, 19, style.paper);
        stamp.strokeColor = new Color('#FFE3A5');
        stamp.lineWidth = 2;
        stamp.roundRect(-117, -25, 234, 50, 15);
        stamp.stroke();
        const countLabel = this.label(effect, count + '连击', -56, 0, 102, 48, 30, style.ink);
        countLabel.node.name = 'ComboCount';
        const gain = this.label(effect, '+$' + bonus, 57, 0, 108, 52, 37, style.ink);
        gain.node.name = 'ComboBonus';

        const opacity = effect.addComponent(UIOpacity);
        opacity.opacity = 0;
        effect.setScale(0.72, 0.72, 1);
        tween(effect).to(0.24, { scale: Vec3.ONE }, { easing: 'backOut' })
            .delay(0.56).to(0.24, { position: new Vec3(0, y + 17, 0) }, { easing: 'quadOut' }).start();
        tween(opacity).to(0.12, { opacity: 255 }).delay(0.68).to(0.24, { opacity: 0 })
            .call(() => { if (this.comboBurst === effect) this.clearComboBurst(); }).start();
    }

    private playCoinBurst(worldStart: Vec3, price: number): void {
        this.coinBurst?.destroy();
        const authoringSpace = this.content.getComponent(UITransform)!;
        const start = authoringSpace.convertToNodeSpaceAR(worldStart);
        const end = authoringSpace.convertToNodeSpaceAR(
            (this.gm.gameOver ? this.finalScore : this.score).node.worldPosition,
        );
        const group = this.box(this.content, 'CoinBurst', 0, 0, start.x, start.y);
        if (!this.gm.gameOver) group.setSiblingIndex(this.chefBubble.node.parent!.getSiblingIndex());
        this.coinBurst = group;
        const destination = new Vec3(end.x - start.x, end.y - start.y, 0);
        const tier = orderPriceTier(price);
        const burst = SERVE_BURSTS[tier];
        this.playServeGlints(group, burst, tier === 'red');
        for (let i = 0; i < burst.coins; i++) {
            const coin = this.box(group, 'Coin', 30, 30, 0, 0);
            drawCoin(coin.addComponent(Graphics), 10 + i % 3 + (tier === 'red' ? 2 : 0));
            const fan = 2 * i / (burst.coins - 1) - 1;
            const apex = new Vec3(fan * burst.spread, 28 + Math.cos(fan * 1.22) * burst.lift, 0);
            coin.setScale(0.45, 0.45, 1);
            tween(coin)
                .delay(i * 0.022)
                .to(0.19, { position: apex, scale: Vec3.ONE, angle: fan * 70 }, { easing: 'quadOut' })
                .to(0.29, { position: destination, scale: new Vec3(0.24, 0.24, 1), angle: 0 }, { easing: 'quadIn' })
                .call(() => {
                    coin.active = false;
                    if (i === burst.coins - 1) {
                        if (this.coinBurst === group) this.coinBurst = null;
                        group.destroy();
                    }
                }).start();
        }
    }

    private playServeGlints(group: Node, burst: { glints: number; spread: number; lift: number; color: string },
        ring: boolean): void {
        const sparkles = this.box(group, 'ServeGlints', 0, 0, 0, 45);
        const g = sparkles.addComponent(Graphics);
        if (ring) {
            g.strokeColor = new Color('#B3573E');
            g.lineWidth = 3;
            g.ellipse(0, -8, 50, 29);
            g.stroke();
        }
        for (let i = 0; i < burst.glints; i++) {
            const angle = Math.PI * (i + 1) / (burst.glints + 1);
            const x = Math.cos(angle) * burst.spread;
            const y = Math.sin(angle) * burst.lift * 0.67;
            const radius = i % 2 === 0 ? 9 : 6;
            g.moveTo(x, y + radius);
            g.lineTo(x + 2, y + 2);
            g.lineTo(x + radius, y);
            g.lineTo(x + 2, y - 2);
            g.lineTo(x, y - radius);
            g.lineTo(x - 2, y - 2);
            g.lineTo(x - radius, y);
            g.lineTo(x - 2, y + 2);
            g.close();
        }
        g.fillColor = new Color(burst.color);
        g.fill();
        g.strokeColor = new Color(ring ? '#A34B34' : '#967447');
        g.lineWidth = 1.3;
        g.stroke();
        sparkles.setScale(0.55, 0.55, 1);
        tween(sparkles).to(0.27, { scale: new Vec3(1.14, 1.14, 1) }, { easing: 'quadOut' }).start();
        tween(sparkles.addComponent(UIOpacity)).delay(0.08).to(0.25, { opacity: 0 }).start();
    }

    private cancelOrderRefresh(): void {
        if (!this.refreshingOrders) return;
        this.refreshingOrders = false;
        this.refresh();
    }

    private toggleRefreshOrders(): void {
        this.setBasketPreview(null);
        if (this.refreshingOrders) {
            this.cancelOrderRefresh();
            this.message('');
            return;
        }
        const check = this.gm.checkOrderRefresh();
        if (check.ok === false) {
            this.showRefreshError(check.reason);
            return;
        }
        this.resetCap();
        this.gm.cancelDeleteMode();
        this.selected = null;
        this.refreshingOrders = true;
        this.refresh();
        this.message('点一张订单更换，花费' + this.gm.orderRefreshPrice + '元');
    }

    private refreshTicket(index: number): void {
        const price = this.gm.orderRefreshPrice;
        const previous = this.cards[index];
        this.cards[index] = undefined;
        this.swappingTicket = index;
        this.refreshingOrders = false;
        const result = this.gm.refreshOrder(index);
        this.swappingTicket = null;
        if (result.ok === false) {
            this.cards[index] = previous;
            this.refresh();
            this.showRefreshError(result.reason);
            return;
        }
        if (previous) this.playOrderExit(previous.node);
        this.audio.play('take');
        this.message('已换单，花费' + price + '元');
    }

    private playOrderExit(card: Node): void {
        for (const button of card.getComponentsInChildren(Button)) button.interactable = false;
        this.actionEffects.add(card);
        card.setSiblingIndex(this.orders.children.length - 1);
        Tween.stopAllByTarget(card);
        const opacity = card.getComponent(UIOpacity) ?? card.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        tween(opacity).to(0.16, { opacity: 0 }).start();
        tween(card).to(0.17, {
            position: new Vec3(card.position.x, card.position.y + 22, 0),
            scale: new Vec3(0.70, 0.96, 1), angle: -7,
        }, { easing: 'quadIn' }).call(() => this.finishActionEffect(card)).start();
    }

    private showRefreshError(reason: string): void {
        if (reason === 'not-enough-money') this.message('余额不足，换单需要' + this.gm.orderRefreshPrice + '元', true);
        else if (reason === 'no-replacement') this.message('没有可换的新订单', true);
    }

    private toggleClear(): void {
        this.setBasketPreview(null);
        this.cancelOrderRefresh();
        this.resetCap();
        if (this.gm.deleteMode) this.gm.cancelDeleteMode();
        else if (!this.gm.enterDeleteMode().ok) {
            this.refreshSelection();
            this.message('回收次数已用完', true);
            return;
        }
        this.message(this.gm.deleteMode ? '点要回收食材的盘子' : '');
    }

    private resetCap(): void {
        this.capMode = false;
        this.capSource = null;
    }

    private hasCapTarget(source?: number): boolean {
        if (source === undefined) return this.plates.some((_, i) => this.hasCapTarget(i));
        return this.plates.some((_, target) => this.gm.checkCap(source, target).ok);
    }

    private toggleCap(): void {
        this.setBasketPreview(null);
        this.cancelOrderRefresh();
        if (this.capMode) {
            this.resetCap();
        } else {
            if (!this.hasCapTarget()) {
                this.message('两盘都有料，合计最多六层', true, true);
                return;
            }
            this.gm.cancelDeleteMode();
            this.selected = null;
            this.capMode = true;
        }
        this.refreshSelection();
        this.message(this.capMode ? '先点来源盘，再翻扣到目标盘' : '', false, this.capMode);
    }

    private capOn(index: number): void {
        const source = this.capSource;
        if (source === null) {
            if (!this.hasCapTarget(index)) {
                this.message('请从带蓝边的盘子里选一个', true);
                return;
            }
            this.capSource = index;
            this.refreshSelection();
            this.message('点带蓝边的盘子，扣上这整叠食材', false, true);
            return;
        }
        if (index === source) {
            this.capSource = null;
            this.refreshSelection();
            this.message('再选一只要翻扣的盘子');
            return;
        }
        const check = this.gm.checkCap(source, index);
        if (check.ok === false) {
            const note = check.reason === 'plate-full' ? '整叠扣上会超过六层' : '目标盘需要已有食材';
            this.message(note, true);
            return;
        }
        const count = this.gm.plates[source].layerCount;
        const sourceView = this.plates[source];
        this.stopCapMotion?.();
        const carrier = sourceView.makeCapCarrier();
        this.resetCap();
        if (this.gm.capPlate(source, index).ok) {
            this.stopCapMotion = sourceView.animateCapTo(carrier, this.plates[index], count, () => {
                this.stopCapMotion = null;
            });
            this.audio.play('cap');
            this.message('');
        } else {
            carrier.destroy();
        }
    }

    private endTurn(): void {
        this.setBasketPreview(null);
        this.cancelOrderRefresh();
        if (this.gm.canEndTurn()) this.resetCap();
        const result = this.gm.endTurn();
        if (result.ok === true) {
            if (this.lessonStep !== null && LESSON[this.lessonStep]?.[0] === 'end') {
                this.gm.prepareTutorialCap();
            }
            this.message(this.gm.gameOver ? '' : '点篮子预览，再点一次取走');
        }
        else if (result.reason === 'hand-not-empty') this.message('先把手上的食材放完', true);
        else if (result.reason === 'no-pile-taken') this.message('先选一整篮食材，再结束回合', true);
    }

    private buildStopService(): void {
        const modal = this.box(this.content, 'StopServiceConfirmation', WIDTH, HEIGHT, 0, 0);
        this.stopServiceModal = modal;
        modal.addComponent(BlockInputEvents);
        this.paint(modal.addComponent(Graphics), 0, 0, WIDTH, HEIGHT, 0, '#3C2E29B8');
        this.panel(modal, 'Confirmation', 0, 0, 472, 218, 25, PAPER);
        this.label(modal, '暂停营业？', 0, 60, 395, 47, 35);
        this.label(modal, '结束本局，按当前余额结算', 0, 9, 408, 39, 24, MUTED);
        this.button(modal, '继续营业', -107, -57, 195, 55, GREEN, null, () => { modal.active = false; });
        this.button(modal, '确认结算', 107, -57, 195, 55, '#865C43', null, () => {
            modal.active = false;
            this.setBasketPreview(null);
            this.selected = null;
            this.refreshingOrders = false;
            this.resetCap();
            this.message('');
            this.gm.stopService();
        });
        modal.active = false;
    }

    private buildGameOver(): void {
        this.modal = this.box(this.content, 'GameOver', WIDTH, HEIGHT, 0, 0);
        this.modal.addComponent(BlockInputEvents);
        this.paint(this.modal.addComponent(Graphics), 0, 0, WIDTH, HEIGHT, 0, '#3C2E29B8');
        this.panel(this.modal, 'Result', 0, -16, 472, 306, 25, PAPER);
        this.label(this.modal, '打烊了', 0, 79, 410, 54, 40);
        this.finalTitle = this.label(this.modal, '', 0, 30, 420, 35, 24, MUTED);
        this.finalDetail = this.label(this.modal, '', 0, -2, 420, 30, 19, MUTED);
        this.finalScore = this.label(this.modal, '', 0, -36, 410, 35, 23, GREEN);
        this.button(this.modal, '重新开张', -106, -84, 196, 60, GREEN, 'restart', () => this.leaveTutorialOrRestart());
        this.button(this.modal, '好友榜', 106, -84, 196, 60, '#8E5F39', 'rank', () => this.openFriendRank());
        const home = this.label(this.modal, '返回主菜单', 0, -135, 220, 36, 22, MUTED);
        this.bind(home.node, () => this.showMainMenu(), true);
        this.modal.active = false;
    }

    private buildMainMenu(): void {
        this.mainMenu = this.box(this.content, 'MainMenu', WIDTH, HEIGHT, 0, 0);
        this.mainMenu.addComponent(BlockInputEvents);
        this.paint(this.mainMenu.addComponent(Graphics), 0, 0, WIDTH, HEIGHT, 0, '#F3E5CC');
        const scene = this.art.getFullFrame('kitchen_menu_order_sketch') ?? this.art.getFullFrame('kitchen_menu');
        if (scene) {
            this.menuAspect = scene.rect.width / scene.rect.height;
            this.menuBackground = this.art.makeSprite(this.mainMenu, scene, 'MenuBackground', WIDTH, HEIGHT)
                .getComponent(UITransform)!;
        }
        const shadow = this.label(this.mainMenu, '厨垒拔萃', 0, 440, 590, 125, 86, '#D8AA74');
        shadow.node.name = 'MenuTitleShadow';
        const title = this.label(this.mainMenu, '厨垒拔萃', 0, 447, 590, 125, 86, '#513625');
        title.node.name = 'MenuTitle';
        this.menuStart = this.button(this.mainMenu, '开始游戏', 0, -376, 370, 78,
            '#426247', 'play', () => this.enterGame(), true);
        const rank = this.button(this.mainMenu, '好友排行榜', 0, -473, 370, 72,
            '#885B37', 'rank', () => this.openFriendRank(true), true);
        this.menuStart.fontSize = 38;
        this.menuStart.lineHeight = 42;
        rank.fontSize = 33;
        rank.lineHeight = 37;
        const lesson = this.panel(this.mainMenu, 'TutorialEntry', 0, -552, 218, 46, 17, '#FFF1D7');
        const guideIcon = this.box(lesson, 'GuideIcon', 30, 30, -73, 0).addComponent(Graphics);
        drawKitchenIcon(guideIcon, 'help', GREEN);
        this.label(lesson, '新手教程', 13, 0, 152, 46, 28, GREEN);
        this.bind(lesson, () => this.replayTutorial(), true);
    }

    private showMainMenu(): void {
        this.coinBurst?.destroy();
        this.coinBurst = null;
        this.clearComboBurst();
        this.clearActionEffects();
        this.menuStart.string = this.hasStarted && !this.gm.gameOver ? '继续游戏' : '开始游戏';
        this.mainMenu.active = true;
    }

    private enterGame(): void {
        this.mainMenu.active = false;
        if (!this.hasStarted) {
            this.hasStarted = true;
            if (!this.hasSeenTutorial()) this.startTutorial();
        } else if (this.gm.gameOver) this.leaveTutorialOrRestart();
    }

    private buildFriendRank(): void {
        this.rankModal = this.box(this.content, 'FriendRank', WIDTH, HEIGHT, 0, 0);
        this.rankModal.active = false;
        this.rankModal.addComponent(BlockInputEvents);
        this.paint(this.rankModal.addComponent(Graphics), 0, 0, WIDTH, HEIGHT, 0, '#3C2E29B8');
        this.panel(this.rankModal, 'RankPaper', 0, 0, 532, 909, 24, PAPER);
        this.label(this.rankModal, '好友排行榜', 0, 407, 432, 50, 39, GREEN);
        this.label(this.rankModal, '打开时同步最高结算余额', 0, 358, 432, 31, 22, MUTED);
        this.rankStatus = this.label(this.rankModal, '', 0, 8, 450, 42, 22, MUTED);
        this.rankCanvas = this.box(this.rankModal, 'RankCanvas', 400, 600, 0, 30);
        if (typeof wx !== 'undefined' && wx.getOpenDataContext) {
            this.rankCanvas.addComponent(SubContextView).fps = 12;
        }
        this.rankCanvas.active = false;
        this.button(this.rankModal, '上一页', -165, -309, 150, 47, '#8E5F39', null,
            () => this.rankCommand({ event: 'page', offset: -1 }), true);
        this.button(this.rankModal, '刷新', 0, -309, 150, 47, '#8E5F39', null, () => this.loadRank(), true);
        this.button(this.rankModal, '下一页', 165, -309, 150, 47, '#8E5F39', null,
            () => this.rankCommand({ event: 'page', offset: 1 }), true);
        this.rankBack = this.button(this.rankModal, '返回结算', 0, -390, 210, 59, GREEN, 'end', () => {
            this.rankCommand({ event: 'close' });
            this.rankContext = null;
            this.rankSession++;
            this.rankModal.active = false;
            this.rankCanvas.active = false;
        }, true);
    }

    private openFriendRank(fromMenu = false): void {
        this.rankBack.string = fromMenu ? '返回主菜单' : '返回结算';
        this.rankModal.active = true;
        this.loadRank();
    }

    private loadRank(): void {
        const session = ++this.rankSession;
        this.rankCommand({ event: 'close' });
        this.rankContext = null;
        this.rankStatus.string = '正在连接微信好友榜…';
        this.rankCanvas.active = false;
        const platform = typeof wx === 'undefined' ? undefined : wx;
        if (!platform?.getOpenDataContext || !platform.authorize) {
            this.rankStatus.string = '请在微信小游戏中查看好友榜';
            return;
        }
        const open = () => {
            if (session !== this.rankSession || !this.isValid) return;
            try {
                const context = platform.getOpenDataContext?.();
                if (!context?.canvas || typeof context.postMessage !== 'function') {
                    this.rankStatus.string = '当前版本无法加载好友榜';
                    return;
                }
                this.rankCanvas.active = true;
                context.postMessage({ type: RANK_TYPE, event: 'show', score: this.bestBalance });
                this.rankContext = context;
                this.rankStatus.string = '';
            } catch (error) {
                this.rankCanvas.active = false;
                this.rankStatus.string = '无法加载好友榜，请刷新';
                console.warn('[好友榜] 开放数据域启动失败', error);
            }
        };
        const showFailure = (message: string, error: { errMsg?: string }) => {
            if (session === this.rankSession && this.isValid) {
                this.rankStatus.string = message;
                console.warn('[好友榜]', error?.errMsg);
            }
        };
        const authorizeFriends = () => {
            if (session !== this.rankSession || !this.isValid) return;
            platform.authorize!({
                scope: FRIEND_SCOPE,
                success: open,
                fail: (error) => showFailure('请在微信设置中允许使用朋友关系', error),
            });
        };
        if (platform.requirePrivacyAuthorize) {
            platform.requirePrivacyAuthorize({
                success: authorizeFriends,
                fail: (error) => showFailure('尚未获得微信隐私授权', error),
            });
        } else {
            authorizeFriends();
        }
    }

    private rankCommand(message: object): void {
        this.rankContext?.postMessage({ type: RANK_TYPE, ...message });
    }

    private describeFood(food: FoodType): void {
        const story = pickFoodStory(food, this.lastFoodStories.get(food));
        this.lastFoodStories.set(food, story);
        this.message(story, false, false, true);
    }

    private message(text: string, error = false, capHelp = false, ingredientStory = false): void {
        if (text && this.lessonStep !== null) return;
        const bubble = this.chefBubble.node.parent!;
        const opacity = bubble.getComponent(UIOpacity)!;
        Tween.stopAllByTarget(opacity);
        this.unschedule(this.hideChefBubble);
        bubble.active = text.length > 0;
        if (text) {
            if (error) this.audio.play('reject');
            this.capBubbleIcon.active = capHelp;
            this.chefBubble.node.setPosition(capHelp ? 24 : 0, 0, 0);
            this.chefBubble.useSystemFont = ingredientStory || !this.art.font;
            this.chefBubble.enableWrapText = ingredientStory;
            this.chefBubble.fontSize = ingredientStory ? 23 : 26;
            this.chefBubble.lineHeight = ingredientStory ? 25 : 29;
            this.chefBubble.node.getComponent(UITransform)!.setContentSize(capHelp ? 303 : 362, ingredientStory ? 57 : 50);
            this.chefBubble.string = text;
            this.chefBubble.color = new Color(error ? RED : GREEN);
            opacity.opacity = 0;
            tween(opacity).to(0.11, { opacity: 255 }).start();
            this.scheduleOnce(this.hideChefBubble, ingredientStory ? 4.0 : error ? 2.8 : 2.2);
        }
    }

    private hideChefBubble = (): void => {
        const bubble = this.chefBubble.node.parent!;
        const opacity = bubble.getComponent(UIOpacity)!;
        tween(opacity).to(0.20, { opacity: 0 }).call(() => { bubble.active = false; }).start();
    };

    private box(parent: Node, name: string, w: number, h: number, x: number, y: number): Node {
        const node = new Node(name);
        node.parent = parent;
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform).setContentSize(w, h);
        node.setPosition(x, y, 0);
        return node;
    }

    private label(parent: Node, text: string, x: number, y: number, w: number, h: number, size: number, color = INK, left = false): Label {
        const node = this.box(parent, 'Label', w, h, x, y);
        const label = node.addComponent(Label);
        label.overflow = Label.Overflow.SHRINK;
        if (this.art?.font) label.font = this.art.font;
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size + 3;
        label.enableWrapText = false;
        label.color = new Color(color);
        label.horizontalAlign = left ? Label.HorizontalAlign.LEFT : Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        node.getComponent(UITransform)!.setContentSize(w, h);
        return label;
    }

    private paint(g: Graphics, x: number, y: number, w: number, h: number, r: number, fill: string): void {
        g.fillColor = new Color(fill);
        g.roundRect(x - w / 2, y - h / 2, w, h, r);
        g.fill();
    }

    private panel(parent: Node, name: string, x: number, y: number, w: number, h: number, radius: number, fill: string): Node {
        const node = this.box(parent, name, w, h, x, y);
        this.paint(node.addComponent(Graphics), 0, 0, w, h, radius, fill);
        return node;
    }

    private interact(node: Node, action: () => void, unrestricted = false): void {
        this.audio?.startFromGesture();
        const step = this.lessonStep;
        if (unrestricted || step === null) {
            action();
        } else if (node === this.tutorialTarget()) {
            action();
            this.lessonStep = step + 1;
            this.refreshTutorial();
        }
    }

    private bind(node: Node, action: () => void, unrestricted = false): Button {
        const button = node.addComponent(Button);
        button.transition = Button.Transition.NONE;
        node.on(Button.EventType.CLICK, () => this.interact(node, action, unrestricted), this);
        return button;
    }

    private button(parent: Node, text: string, x: number, y: number, w: number, h: number,
        color: string, icon: KitchenIcon | null, action: () => void, unrestricted = false, skin?: string): Label {
        const node = this.box(parent, text, w, h, x, y);
        const frame = skin && this.art.getFullFrame(skin);
        if (frame) this.art.makeSprite(node, frame, 'ButtonArtwork', w, h);
        else drawButtonSkin(node.addComponent(Graphics), w, h, color);
        if (icon) drawKitchenIcon(this.box(node, 'ButtonIcon', 32, 32, -w / 2 + 33, 0).addComponent(Graphics), icon);
        const button = this.bind(node, action, unrestricted);
        button.target = node;
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 0.97;
        return this.label(node, text, icon ? 13 : 0, 0, w - (icon ? 59 : 18), h, 24, PAPER);
    }

    private setButtonMuted(label: Label, muted: boolean): void {
        const node = label.node.parent!;
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        opacity.opacity = muted ? 154 : 255;
    }
}
