#!/bin/sh
set -eu
: "${FFMPEG:=ffmpeg}"
INPUT=${1:?Usage: FFMPEG=/path/to/ffmpeg sh scripts/extract-frames.sh /path/to/video.mp4}
mkdir -p public/frames
"$FFMPEG" -hide_banner -loglevel error -y -i "$INPUT" -map 0:v:0 -fps_mode passthrough -c:v libwebp -quality 84 -compression_level 5 public/frames/frame-%04d.webp
"$FFMPEG" -hide_banner -loglevel error -y -sseof -0.1 -i "$INPUT" -update 1 public/final.png
