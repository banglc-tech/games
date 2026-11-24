#!/bin/bash
# t.sh "x y [wait]" ... : chay game tren man hinh ao, bam lan luot cac toa do, chup anh sau moi lan bam.
# Anh ghi ra /mnt/d/game-dua-xe/stk/t-N.png
OUT=/mnt/d/game-dua-xe/stk
cd /opt/stk/stk-code/build
pkill Xvfb; pkill supertuxkart; sleep 1
rm -f $OUT/t-*.png
Xvfb :99 -screen 0 1280x720x24 >/dev/null 2>&1 &
sleep 2
export DISPLAY=:99 HOME=/opt/stk/home LIBGL_ALWAYS_SOFTWARE=1
./bin/supertuxkart --screensize=1280x720 > /opt/stk/run.log 2>&1 &
sleep ${BOOT:-40}
n=0
import -window root $OUT/t-$n.png
for a in "$@"; do
  x=$(echo $a | cut -d' ' -f1); y=$(echo $a | cut -d' ' -f2); w=$(echo $a | cut -d' ' -f3)
  xdotool mousemove $x $y click 1
  sleep ${w:-4}
  n=$((n+1))
  import -window root $OUT/t-$n.png
done
echo "song: $(pgrep -c supertuxkart)"
grep -iE "\[error|\[fatal|garage" /opt/stk/run.log | grep -v "Positional audio" | head -8 | cut -c1-200
pkill supertuxkart; pkill Xvfb
exit 0
