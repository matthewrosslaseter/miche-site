#!/usr/bin/env python3
"""
Makes the web versions of the real-footage clips. Run once after adding or changing a clip:

    python3 scripts/clips.py

Reads media/clips/clip-NN.mp4 (720x1280 H.264, made from the original phone videos) and writes:
  - media/clips/clip-NN-sm.mp4   silent 360x640 preview for the swipe rows and lurk mode (a fraction of the size)
  - media/reel-tall.mp4 / .jpg   phones: short cuts from several clips, dissolving into each other (hero background)
  - media/reel-wide.mp4 / .jpg   desktop: three clips side by side, each cutting through its own picks
Needs ffmpeg on the PATH.
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIPS = os.path.join(ROOT, 'media', 'clips')
MEDIA = os.path.join(ROOT, 'media')
FADE = 0.5

# (clip number, start second, length) for each cut in the reels
TALL = [(2, 3.0, 2.6), (4, 5.0, 2.6), (5, 0.8, 2.6), (3, 2.0, 2.6), (7, 1.0, 2.6), (1, 0.6, 2.6), (6, 1.0, 2.6)]
WIDE = [
    [(2, 3.0, 3.2), (5, 0.8, 3.2), (7, 1.0, 3.2)],
    [(4, 5.0, 3.2), (3, 2.0, 3.2), (1, 0.6, 3.2)],
    [(6, 1.0, 3.2), (9, 3.0, 3.2), (8, 2.0, 3.2)],
]


def run(args):
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y'] + args, check=True)


def clip(n):
    return os.path.join(CLIPS, 'clip-%02d.mp4' % n)


def reel_filter(cuts, offset, w, h, out):
    f = []
    for i in range(len(cuts)):
        f.append('[%d:v]scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,setsar=1,fps=30,format=yuv420p,settb=AVTB[%s%d]' % (offset + i, w, h, w, h, out, i))
    prev, t = '%s0' % out, cuts[0][2] - FADE
    for i in range(1, len(cuts)):
        name = '%sx%d' % (out, i)
        f.append('[%s][%s%d]xfade=transition=fade:duration=%s:offset=%.2f[%s]' % (prev, out, i, FADE, t, name))
        prev, t = name, t + cuts[i][2] - FADE
    return f, prev


def encode(args, path):
    run(args + ['-an', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '27', '-maxrate', '2500k', '-bufsize', '5000k',
                '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path])
    run(['-ss', '0.3', '-i', path, '-frames:v', '1', '-q:v', '4', path[:-4] + '.jpg'])


def main():
    names = sorted(f for f in os.listdir(CLIPS) if f.startswith('clip-') and f.endswith('.mp4') and not f.endswith('-sm.mp4'))
    if not names:
        sys.exit('No clips in media/clips')
    for f in names:
        src = os.path.join(CLIPS, f)
        run(['-i', src, '-an', '-vf', 'scale=360:640,fps=30', '-c:v', 'libx264', '-profile:v', 'main', '-preset', 'slow', '-crf', '30',
             '-maxrate', '700k', '-bufsize', '1400k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', src[:-4] + '-sm.mp4'])
        print('preview', f)

    # Tall reel
    inputs = []
    for n, start, length in TALL:
        inputs += ['-ss', str(start), '-t', str(length), '-i', clip(n)]
    f, last = reel_filter(TALL, 0, 720, 1280, 't')
    encode(inputs + ['-filter_complex', ';'.join(f), '-map', '[%s]' % last], os.path.join(MEDIA, 'reel-tall.mp4'))
    print('reel-tall')

    # Wide reel: three 424x720 panels with 4px gaps
    inputs, graph, outs, k = [], [], [], 0
    for p, cuts in enumerate(WIDE):
        for n, start, length in cuts:
            inputs += ['-ss', str(start), '-t', str(length), '-i', clip(n)]
        f, last = reel_filter(cuts, k, 424, 720, 'p%d' % p)
        graph += f
        outs.append(last)
        k += len(cuts)
    graph.append('color=c=0x0B0B0B:s=1280x720:r=30[bg]')
    graph.append('[bg][%s]overlay=0:0:shortest=1[o1];[o1][%s]overlay=428:0[o2];[o2][%s]overlay=856:0,format=yuv420p[wide]' % tuple(outs))
    encode(inputs + ['-filter_complex', ';'.join(graph), '-map', '[wide]'], os.path.join(MEDIA, 'reel-wide.mp4'))
    print('reel-wide')


if __name__ == '__main__':
    main()
