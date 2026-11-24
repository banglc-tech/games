#!/bin/bash
# Ve bo nut cho gara (kieu toi, bo tron, nhan xanh neon) bang ImageMagick. Ket qua: ./garage/*.png
set -e
cd "$(dirname "$0")"
rm -rf garage; mkdir -p garage; cd garage
F=DejaVu-Sans-Bold
DARK="#29303f"; TXT="#ebf2ff"; ACC="#dfe9f5"; OFF="#333d52"; INK="#080d14"

btn() {  # file w h radius bg text textcolor pointsize
  convert -size ${2}x${3} xc:none -fill "$5" -draw "roundrectangle 0,0 $(($2-1)),$(($3-1)) $4,$4" \
    -fill "$7" -font $F -pointsize $8 -gravity center -annotate +0+0 "$6" PNG32:$1
}
btn prev.png  112 96 22 "$DARK" "<" "$TXT" 46
btn next.png  112 96 22 "$DARK" ">" "$TXT" 46
btn minus.png 96 80 20 "$DARK" "−" "$TXT" 44
btn plus.png  96 80 20 "$DARK" "+" "$TXT" 44
btn drive.png 640 116 28 "$ACC" "LÁI THỬ  ▶" "$INK" 54

# o mau son: sw_N.png (thuong) va sw_N_on.png (dang chon, vien trang). N=0 la "Goc".
COLORS=("$DARK" "#e53935" "#fb8c00" "#fdd835" "#9ccc2f" "#43a047" "#00acc1" "#1e63e9" "#5e35b1" "#8e24aa" "#d81b9a" "#ec407a")
i=0
for c in "${COLORS[@]}"; do
  t=""; [ $i = 0 ] && t="Gốc"
  convert -size 128x80 xc:none -fill "$c" -draw "roundrectangle 4,4 123,75 18,18" \
    -fill "$TXT" -font $F -pointsize 30 -gravity center -annotate +0+0 "$t" PNG32:sw_$i.png
  convert -size 128x80 xc:none -fill white -draw "roundrectangle 0,0 127,79 22,22" \
    -fill "$c" -draw "roundrectangle 8,8 119,71 15,15" \
    -fill "$TXT" -font $F -pointsize 30 -gravity center -annotate +0+0 "$t" PNG32:sw_${i}_on.png
  i=$((i+1))
done

# thanh thong so 4 vach: bar_0..bar_3 (so vach sang = N+1)
for n in 0 1 2 3; do
  cmd="convert -size 400x44 xc:none"
  for k in 0 1 2 3; do
    x=$((k*102)); col="$OFF"; [ $k -le $n ] && col="$ACC"
    cmd="$cmd -fill '$col' -draw \"roundrectangle $x,8 $((x+92)),35 9,9\""
  done
  eval "$cmd PNG32:bar_$n.png"
done
# thanh 3 vach (co / do cao duoi xe): bar3_0..bar3_2
for n in 0 1 2; do
  cmd="convert -size 400x44 xc:none"
  for k in 0 1 2; do
    x=$((k*137)); col="$OFF"; [ $k -le $n ] && col="$ACC"
    cmd="$cmd -fill '$col' -draw \"roundrectangle $x,8 $((x+126)),35 9,9\""
  done
  eval "$cmd PNG32:bar3_$n.png"
done
ls | wc -l
