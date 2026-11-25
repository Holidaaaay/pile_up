import { Color, Graphics } from 'cc';

type Span = readonly [number, number];

/** 左右边缘按裁切后贴图逐行采样。数据从底到顶，范围为 -1 到 1。 */
const PROFILES: Record<string, readonly Span[]> = {
    food_bacon: [[.50,.63],[-.23,.98],[-.96,.97],[-.91,.97],[-.95,.94],[-.99,.86],[-.95,.84],[-.24,.95],[.12,.89],[.24,.88],[.61,.80]],
    food_bun_bottom: [[-.34,.28],[-.71,.69],[-.85,.84],[-.93,.93],[-.97,.97],[-.98,.99],[-.98,.98],[-.96,.96],[-.90,.90],[-.75,.74],[-.31,.30]],
    food_bun_top: [[-.36,.37],[-.86,.87],[-.98,.98],[-.99,.99],[-.97,.97],[-.93,.93],[-.87,.87],[-.81,.78],[-.67,.67],[-.48,.51],[.02,.10]],
    food_cheese: [[-.21,-.13],[-.24,-.09],[-.33,-.06],[-.44,.13],[-.62,.96],[-.99,.98],[-.97,.99],[-.92,.95],[-.57,.74],[-.25,.51],[.05,.24]],
    food_egg: [[.14,.39],[-.21,.64],[-.69,.78],[-.75,.84],[-.96,.94],[-1,.99],[-.94,.98],[-.79,.91],[-.63,.69],[-.20,.49],[.10,.27]],
    food_lettuce: [[.52,.58],[-.40,.67],[-.66,.68],[-.73,.89],[-.88,.89],[-.99,.97],[-.99,.99],[-.87,.96],[-.86,.87],[-.61,.89],[.55,.64]],
    food_patty: [[-.24,.26],[-.68,.74],[-.87,.88],[-.95,.94],[-.98,.98],[-.99,.99],[-.97,.96],[-.94,.94],[-.87,.85],[-.74,.70],[-.38,.31]],
    food_tomato: [[-.48,.68],[-.81,.87],[-.92,.95],[-.98,.98],[-.99,.99],[-.98,.98],[-.96,.95],[-.90,.89],[-.79,.79],[-.57,.64],[.01,.37]],
};

export interface OutlineLayer {
    width: number;
    height: number;
    y: number;
    /** 瓷盘用椭圆。食材读取裁切后精灵边缘。 */
    frameName?: string;
}

export const SELECTION_COLOR = '#536DAF';

function spansAt(layer: OutlineLayer, y: number): Span | null {
    const normalized = (y - layer.y) / layer.height + 0.5;
    if (normalized < 0 || normalized > 1) return null;
    const half = layer.width / 2;
    const profile = layer.frameName ? PROFILES[layer.frameName] : null;
    if (!profile) {
        const extent = Math.sqrt(1 - (normalized * 2 - 1) ** 2) * half;
        return [-extent, extent];
    }
    const index = normalized * (profile.length - 1);
    const low = Math.floor(index);
    const high = Math.min(low + 1, profile.length - 1);
    const mix = index - low;
    return [
        (profile[low][0] * (1 - mix) + profile[high][0] * mix) * half,
        (profile[low][1] * (1 - mix) + profile[high][1] * mix) * half,
    ];
}

/** 每条水平线取并集的最外侧，再闭合成一条连续外轮廓。 */
export function strokeOutline(g: Graphics, layers: OutlineLayer[], color = SELECTION_COLOR): void {
    const bottom = Math.min(...layers.map((layer) => layer.y - layer.height / 2));
    const top = Math.max(...layers.map((layer) => layer.y + layer.height / 2));
    const steps = Math.ceil((top - bottom) / 3);
    const edges: Array<{ y: number; left: number; right: number }> = [];
    for (let i = 0; i <= steps; i++) {
        const y = i === steps ? top : bottom + i * (top - bottom) / steps;
        let left = Infinity;
        let right = -Infinity;
        for (const layer of layers) {
            const span = spansAt(layer, y);
            if (!span) continue;
            left = Math.min(left, span[0]);
            right = Math.max(right, span[1]);
        }
        if (left !== Infinity) edges.push({ y, left: left - 2, right: right + 2 });
    }
    if (edges.length < 2) return;
    g.lineJoin = Graphics.LineJoin.ROUND;
    for (const [width, stroke] of [[13, '#F5F0E5'], [7, color]] as const) {
        g.lineWidth = width;
        g.strokeColor = new Color(stroke);
        g.moveTo(edges[0].right, edges[0].y);
        for (const edge of edges) g.lineTo(edge.right, edge.y);
        for (let i = edges.length - 1; i >= 0; i--) g.lineTo(edges[i].left, edges[i].y);
        g.close();
        g.stroke();
    }
}
