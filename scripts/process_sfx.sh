#!/bin/bash
# 효과음 다듬기: art/source/sfx/*.mp3 → public/assets/sfx/*.mp3
# 앞뒤 빈 소리를 잘라 내고(누르자마자 소리가 나게), 크기를 맞추고, 끝을 부드럽게 줄이고, 모노 96k로 줄인다.
cd "$(dirname "$0")/.."
mkdir -p public/assets/sfx
for f in art/source/sfx/*.mp3; do
  n=$(basename "$f")
  # 가장 큰 소리가 -1.5dB가 되도록
  peak=$(ffmpeg -hide_banner -i "$f" -af "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.01,volumedetect" -f null - 2>&1 | grep -o 'max_volume: [-0-9.]*' | cut -d' ' -f2)
  gain=$(python3 -c "print(max(-6, min(30, -1.5 - float('${peak:-0}'))))")
  ffmpeg -hide_banner -loglevel error -y -i "$f" -af "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.01,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.03,afade=t=in:d=0.06,areverse,volume=${gain}dB" -ac 1 -ar 44100 -b:a 96k "public/assets/sfx/$n"
  echo "$n peak ${peak}dB gain ${gain}dB $(ffprobe -v error -show_entries format=duration -of csv=p=0 "public/assets/sfx/$n")s"
done
