import { Color, Graphics } from 'cc';

export type KitchenIcon = 'swap' | 'clear' | 'cap' | 'end' | 'sound' | 'muted' | 'restart' | 'help' | 'rank' | 'play' | 'home' | 'ticket' | 'pause';

export function drawCoin(g: Graphics, radius = 15): void {
    const disc = (x: number, y: number, r: number, fill: string) => {
        g.fillColor = new Color(fill);
        g.circle(x, y, r);
        g.fill();
    };
    disc(0, -radius * 0.19, radius, '#A46539');
    disc(0, 0, radius, '#E8A646');
    disc(0, 0, radius * 0.83, '#FFE29A');
    disc(0, 0, radius * 0.67, '#F5C86F');
    const r = radius * 0.47;
    g.fillColor = new Color('#FFF4C7');
    g.moveTo(0, r);
    g.quadraticCurveTo(r * 0.24, r * 0.24, r, 0);
    g.quadraticCurveTo(r * 0.24, -r * 0.24, 0, -r);
    g.quadraticCurveTo(-r * 0.24, -r * 0.24, -r, 0);
    g.quadraticCurveTo(-r * 0.24, r * 0.24, 0, r);
    g.close();
    g.fill();
}

export function drawButtonSkin(g: Graphics, width: number, height: number, base: string): void {
    const fill = (inset: number, offsetY: number, color: string) => {
        g.fillColor = new Color(color);
        g.roundRect(-width / 2 + inset, -height / 2 + inset + offsetY,
            width - inset * 2, height - inset * 2, Math.min(16, height * 0.25));
        g.fill();
    };
    fill(0, -4, '#6C4635A0');
    fill(0, 0, '#64432F');
    fill(1.4, 0, base);
    g.strokeColor = new Color('#FFF4D85C');
    g.lineWidth = 1.5;
    g.roundRect(-width / 2 + 4, -height / 2 + 5, width - 8, height - 9, Math.min(13, height * 0.22));
    g.stroke();
}

export function drawKitchenIcon(g: Graphics, icon: KitchenIcon, color = '#FFF4DF'): void {
    g.clear();
    g.strokeColor = new Color(color);
    g.lineWidth = 2.4;
    g.lineCap = Graphics.LineCap.ROUND;
    g.lineJoin = Graphics.LineJoin.ROUND;
    if (icon === 'swap') {
        g.moveTo(-10, 1);
        g.bezierCurveTo(-9, 11, 3, 12, 9, 5);
        g.lineTo(10, 2);
        g.moveTo(5, 3);
        g.lineTo(10, 2);
        g.lineTo(11, 7);
        g.moveTo(10, -1);
        g.bezierCurveTo(9, -11, -3, -12, -9, -5);
        g.lineTo(-10, -2);
        g.moveTo(-5, -3);
        g.lineTo(-10, -2);
        g.lineTo(-11, -7);
    } else if (icon === 'clear') {
        g.moveTo(-10, 0);
        g.lineTo(-8, -8);
        g.lineTo(8, -8);
        g.lineTo(10, 0);
        g.moveTo(0, 11);
        g.lineTo(0, 0);
        g.moveTo(-4, 4);
        g.lineTo(0, 0);
        g.lineTo(4, 4);
    } else if (icon === 'cap') {
        // 左上方的盘经弧线翻到右下方的盘上。
        g.ellipse(-7, 5, 5, 2.3);
        g.moveTo(-1, 9);
        g.quadraticCurveTo(9, 13, 12, 2);
        g.moveTo(8, 4);
        g.lineTo(12, 2);
        g.lineTo(14, 6);
        g.ellipse(4, -6, 9, 2.8);
        g.moveTo(0, -3);
        g.lineTo(2, 0);
        g.lineTo(7, 0);
        g.lineTo(9, -3);
    } else if (icon === 'end') {
        g.circle(0, 0, 10);
        g.moveTo(-5, 0);
        g.lineTo(-1, -4);
        g.lineTo(5, 4);
    } else if (icon === 'ticket') {
        g.lineWidth = 2.5;
        const outline = () => {
            g.moveTo(-10, 9);
            g.quadraticCurveTo(-10, 12, -7, 12);
            g.lineTo(7, 12);
            g.quadraticCurveTo(10, 12, 10, 9);
            g.lineTo(10, -11);
            g.lineTo(6.7, -8.5);
            g.lineTo(3.4, -11);
            g.lineTo(0, -8.5);
            g.lineTo(-3.4, -11);
            g.lineTo(-6.7, -8.5);
            g.lineTo(-10, -11);
            g.close();
        };
        g.fillColor = new Color('#FFF0D2');
        outline();
        g.fill();
        outline();
        g.moveTo(-5, 5);
        g.lineTo(5, 5);
        g.moveTo(-5, 0);
        g.lineTo(3, 0);
    } else if (icon === 'pause') {
        g.lineWidth = 3.5;
        g.moveTo(-4, -6);
        g.lineTo(-4, 6);
        g.moveTo(4, -6);
        g.lineTo(4, 6);
    } else if (icon === 'play') {
        g.lineWidth = 4;
        g.moveTo(-5, 9);
        g.lineTo(9, 0);
        g.lineTo(-5, -9);
        g.close();
    } else if (icon === 'home') {
        g.moveTo(-11, 0);
        g.lineTo(0, 9);
        g.lineTo(11, 0);
        g.moveTo(-8, 1);
        g.lineTo(-8, -9);
        g.lineTo(8, -9);
        g.lineTo(8, 1);
        g.moveTo(-2, -9);
        g.lineTo(-2, -4);
        g.lineTo(2, -4);
        g.lineTo(2, -9);
    } else if (icon === 'rank') {
        g.lineWidth = 4;
        g.moveTo(-6, 8);
        g.lineTo(6, 8);
        g.lineTo(6, 3);
        g.quadraticCurveTo(6, -2, 0, -4);
        g.quadraticCurveTo(-6, -2, -6, 3);
        g.close();
        g.moveTo(-6, 6);
        g.lineTo(-11, 6);
        g.quadraticCurveTo(-11, 0, -5, 0);
        g.moveTo(6, 6);
        g.lineTo(11, 6);
        g.quadraticCurveTo(11, 0, 5, 0);
        g.moveTo(0, -4);
        g.lineTo(0, -9);
        g.moveTo(-5, -9);
        g.lineTo(5, -9);
    } else if (icon === 'restart') {
        g.lineWidth = 3.5;
        g.moveTo(-9, 3);
        g.bezierCurveTo(-5, 14, 12, 10, 10, -2);
        g.bezierCurveTo(9, -11, -4, -13, -8, -6);
        g.moveTo(-10, 8);
        g.lineTo(-9, 3);
        g.lineTo(-4, 4);
    } else if (icon === 'help') {
        g.lineWidth = 3.5;
        g.moveTo(-5, 5);
        g.bezierCurveTo(-3, 12, 8, 9, 6, 3);
        g.quadraticCurveTo(5, 1, 2, 0);
        g.quadraticCurveTo(0, -1, 0, -3);
        g.moveTo(0, -8);
        g.lineTo(0, -8.5);
    } else {
        g.moveTo(-9, -4);
        g.lineTo(-5, -4);
        g.lineTo(1, -8);
        g.lineTo(1, 8);
        g.lineTo(-5, 4);
        g.lineTo(-9, 4);
        g.close();
        if (icon === 'sound') {
            g.moveTo(5, -4);
            g.quadraticCurveTo(10, 0, 5, 4);
            g.moveTo(8, -7);
            g.quadraticCurveTo(15, 0, 8, 7);
        } else {
            g.moveTo(5, -3);
            g.lineTo(11, 3);
            g.moveTo(5, 3);
            g.lineTo(11, -3);
        }
    }
    g.stroke();
}
