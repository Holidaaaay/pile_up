import { Color, Graphics } from 'cc';

/** 圆形小厨头像，与弹出的对话气泡配对。 */
export function drawChef(g: Graphics): void {
    const ink = '#624231';
    const skin = '#F3B77F';
    const cream = '#FFF6E0';
    const ellipse = (x: number, y: number, rx: number, ry: number, color: string) => {
        g.fillColor = new Color(color);
        g.ellipse(x, y, rx, ry);
        g.fill();
    };

    ellipse(0, -2, 35, 35, '#9CAF90');
    ellipse(0, 0, 35, 35, cream);
    ellipse(0, 0, 31, 31, '#E0E9D2');
    ellipse(0, -24, 16, 7, '#C8725C');
    ellipse(-15, -5, 4, 5, skin);
    ellipse(15, -5, 4, 5, skin);
    ellipse(0, -6, 16, 17, skin);
    ellipse(-9, -7, 1.8, 2.2, ink);
    ellipse(9, -7, 1.8, 2.2, ink);
    ellipse(-11, -12, 3, 1.5, '#E89777');
    ellipse(11, -12, 3, 1.5, '#E89777');

    g.fillColor = new Color(ink);
    g.moveTo(0, -11);
    g.bezierCurveTo(-4, -6, -7, -14, -11, -11);
    g.bezierCurveTo(-9, -19, -4, -16, 0, -13);
    g.bezierCurveTo(4, -16, 9, -19, 11, -11);
    g.bezierCurveTo(7, -14, 4, -6, 0, -11);
    g.close();
    g.fill();

    g.fillColor = new Color(cream);
    g.strokeColor = new Color('#A37957');
    g.lineWidth = 1.6;
    g.moveTo(-14, 5);
    g.lineTo(-17, 14);
    g.bezierCurveTo(-25, 15, -20, 26, -11, 23);
    g.bezierCurveTo(-8, 34, 7, 33, 10, 24);
    g.bezierCurveTo(22, 27, 25, 16, 17, 14);
    g.lineTo(14, 5);
    g.quadraticCurveTo(0, 3, -14, 5);
    g.close();
    g.fill();
    g.stroke();
}
