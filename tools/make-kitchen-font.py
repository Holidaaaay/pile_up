"""Rasterize the bundled KitchenRound typeface for Cocos BitmapFont."""
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageFont


def main():
    directory = Path(__file__).resolve().parents[1] / "assets/resources/fonts"
    source = directory / "KitchenRound.ttf"
    name = "KitchenRoundBitmap"
    size, atlas_size, padding = 64, 2048, 2
    font = ImageFont.truetype(str(source), size)
    with TTFont(source) as ttf:
        characters = sorted(ttf.getBestCmap())
    ascent, descent = font.getmetrics()
    atlas = Image.new("RGBA", (atlas_size, atlas_size), (255, 255, 255, 0))
    rows = []
    x = y = padding
    row_height = 0
    for code in characters:
        character = chr(code)
        mask, (left, top) = font.getmask2(character, mode="L", anchor="ls")
        width, height = mask.size
        if x + width + padding > atlas_size:
            x, y, row_height = padding, y + row_height + padding, 0
        if y + height + padding > atlas_size:
            raise ValueError("The font atlas is full.")
        if width and height:
            alpha = Image.frombytes("L", mask.size, bytes(mask))
            atlas.paste((255, 255, 255, 255), (x, y, x + width, y + height), alpha)
        rows.append(
            f"char id={code} x={x} y={y} width={width} height={height} "
            f"xoffset={left} yoffset={top + ascent} xadvance={round(font.getlength(character))} "
            "page=0 chnl=15"
        )
        x += width + padding
        row_height = max(row_height, height)

    atlas.save(directory / f"{name}.png", optimize=True)
    header = [
        f'info face="KitchenRound" size={size} bold=0 italic=0 charset="" unicode=1 '
        "stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing=1,1",
        f"common lineHeight={ascent + descent} base={ascent} scaleW={atlas_size} "
        f"scaleH={atlas_size} pages=1 packed=0",
        f'page id=0 file="{name}.png"',
        f"chars count={len(rows)}",
    ]
    (directory / f"{name}.fnt").write_text("\n".join([*header, *rows]) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
