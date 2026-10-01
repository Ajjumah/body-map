#!/usr/bin/env sh
# Regenerates the favicon and PWA icons in assets/icons/.
# Uses assets/logo.png when present; otherwise draws a blue circle with a yellow "B".
# Needs ImageMagick (`convert`). Run from anywhere: sh tools/make-icons.sh
set -e
cd "$(dirname "$0")/.."
OUT=assets/icons
mkdir -p "$OUT"

if [ -f assets/logo.png ]; then
  SRC=assets/logo.png
else
  SRC="$OUT/fallback-src.png"
  convert -size 1024x1024 xc:none -fill '#00338D' -draw 'circle 512,512 512,8' \
    -fill '#FFC72C' -font DejaVu-Sans-Bold -pointsize 680 -gravity center -annotate +0+20 'B' "$SRC"
fi

# "any" icons keep transparency
for s in 16 32 192 512; do
  convert "$SRC" -resize ${s}x${s} -background none -gravity center -extent ${s}x${s} "$OUT/icon-$s.png"
done
# Maskable icon and Apple touch icon: logo inside the safe zone on a solid white square
convert "$SRC" -resize 360x360 -background white -gravity center -extent 512x512 "$OUT/maskable-512.png"
convert "$SRC" -resize 150x150 -background white -gravity center -extent 180x180 "$OUT/apple-touch-icon.png"

rm -f "$OUT/fallback-src.png"
echo "Icons written to $OUT"
