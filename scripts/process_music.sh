#!/bin/bash
# 배경음악 다듬기: art/source/music/*.mp3 → public/assets/music/*.mp3
# 앞뒤 빈 소리를 자르고, 곡마다 크기를 맞추고(-17 LUFS), 이어 붙여도 튀지 않게 처음·끝을 살짝 줄인다. 스테레오 96k.
cd "$(dirname "$0")/.."
mkdir -p public/assets/music
for f in art/source/music/*.mp3; do
  n=$(basename "$f")
  ffmpeg -hide_banner -loglevel error -y -i "$f" -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,afade=t=in:d=0.5,areverse,afade=t=in:d=0.15,loudnorm=I=-17:TP=-1.5:LRA=9" -ar 44100 -b:a 96k "public/assets/music/$n"
  echo "$n $(ffprobe -v error -show_entries format=duration -of csv=p=0 "public/assets/music/$n")s $(du -k "public/assets/music/$n" | cut -f1)KB $(ffmpeg -i "public/assets/music/$n" -af volumedetect -f null - 2>&1 | grep -o 'mean_volume: [-0-9.]* dB')"
done
