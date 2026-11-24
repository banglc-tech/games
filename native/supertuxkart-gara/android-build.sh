#!/bin/bash
# Build SuperTuxKart (co gara) cho Android arm64 trong Docker.  Chay trong WSL: bash android-build.sh [prep|assets|deps|apk|all]
# Ket qua: /opt/stk/stk-code/android/build/outputs/apk/...  ; log: /opt/stk/android-*.log
set -e
STEP=${1:-all}
SRC=/opt/stk/stk-code
LOG=/opt/stk

if ! docker image inspect stk-android >/dev/null 2>&1; then
  mkdir -p /opt/stk/docker
  cat > /opt/stk/docker/Dockerfile <<'EOF'
FROM a9-rn-build
RUN apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
    cmake automake autoconf libtool pkg-config make patch xz-utils unzip zip git python3 python-is-python3 \
    imagemagick vorbis-tools pngquant optipng advancecomp libjpeg-turbo-progs file curl ca-certificates >/dev/null \
 && rm -rf /var/lib/apt/lists/*
RUN /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --install "ndk;28.1.13356709" >/dev/null
EOF
  docker build -q --cpuset-cpus=0-2 -t stk-android /opt/stk/docker
fi

# ma nguon thu vien phu thuoc cho Android (curl, freetype, openal ...) do du an phat hanh
if [ ! -d $SRC/lib/freetype ] && [ ! -d $SRC/lib/curl ]; then
  cd /opt/stk
  [ -s dependencies-android-src.tar.xz ] || curl -sL -o dependencies-android-src.tar.xz \
    https://github.com/supertuxkart/dependencies/releases/download/1.5/dependencies-android-src.tar.xz
  tar -xJf dependencies-android-src.tar.xz -C $SRC/lib
fi
# libadrenotools (SDL dung de nap driver Vulkan rieng): goi nguon thieu thu vien con linkernsbypass
# va script goc "git clone" tu thu muc khong phai kho git -> lay thu vien con, doi sang chep thu muc.
LNB=$SRC/lib/libadrenotools/lib/linkernsbypass
if [ -z "$(ls -A $LNB 2>/dev/null)" ]; then
  rm -rf $LNB; git clone -q --depth 1 https://github.com/bylaws/liblinkernsbypass.git $LNB && rm -rf $LNB/.git
fi
sed -i 's#^            git clone "$DIRNAME/../lib/libadrenotools" "$DIRNAME/deps-$ARCH_OPTION/libadrenotools"#            cp -a "$DIRNAME/../lib/libadrenotools/." "$DIRNAME/deps-$ARCH_OPTION/libadrenotools/"#; s#^            git submodule update --init$#            true#' $SRC/android/make_deps.sh
# Bo qua buoc dung driver mesa/turnip (rat nang, chi can cho driver Vulkan tuy bien): danh dau da xong.
mkdir -p $SRC/android/deps-arm64-v8a $SRC/android/mesa/arm64-v8a
touch $SRC/android/deps-arm64-v8a/mesa.stamp
[ "$STEP" = prep ] && { ls $SRC/lib | tr '\n' ' '; ls $LNB | head -5; grep -n "libadrenotools/\." $SRC/android/make_deps.sh | head -2; exit 0; }

RUN="docker run --rm --cpuset-cpus=0-2 -v /opt/stk:/opt/stk -w $SRC/android \
  -e SDK_PATH=/opt/android-sdk -e NDK_PATH=/opt/android-sdk/ndk -e PROJECT_VERSION=1.5 \
  -e STK_MIN_ANDROID_SDK=21 -e STK_TARGET_ANDROID_SDK=36 -e BUILD_TOOLS_VER=36.0.0 -e STK_NDK_VERSION=28.1.13356709 \
  -e COMPILE_ARCH=aarch64 -e BUILD_TYPE=debug stk-android"

if [ "$STEP" = assets ] || [ "$STEP" = all ]; then
  $RUN bash -c './generate_assets.sh' > $LOG/android-assets.log 2>&1 || { tail -15 $LOG/android-assets.log; exit 1; }
  echo "assets: $(du -sh $SRC/android/assets | cut -f1)"
fi
if [ "$STEP" = deps ] || [ "$STEP" = all ]; then
  $RUN bash -c './make_deps.sh' > $LOG/android-deps.log 2>&1 || { tail -25 $LOG/android-deps.log; exit 1; }
  echo "deps ok"
fi
if [ "$STEP" = apk ] || [ "$STEP" = all ]; then
  $RUN bash -c './make.sh -j3' > $LOG/android-make.log 2>&1 || { tail -30 $LOG/android-make.log; exit 1; }
  find $SRC/android -name "*.apk" -newer $LOG/android-make.log -o -name "*.apk" | head -5 | xargs -r ls -la
fi
echo "XONG $STEP"
