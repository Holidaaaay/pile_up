"""Render the game's original, quiet mono effects as PCM WAV."""

from math import exp, pi, sin
from pathlib import Path
from random import Random
import struct
import wave


RATE = 22050
OUT = Path(__file__).resolve().parent.parent / "assets" / "resources" / "audio"


def render(name, duration, bells=(), sweeps=(), rustles=()):
    buffer = [0.0] * int(duration * RATE)

    def add(start, length, signal):
        first = int(start * RATE)
        for i in range(min(int(length * RATE), len(buffer) - first)):
            t = i / RATE
            envelope = min(1.0, t / 0.006, (length - t) / 0.014)
            buffer[first + i] += signal(t) * envelope

    for start, frequency, gain, decay in bells:
        add(start, min(duration - start, decay * 7), lambda t:
            gain * exp(-t / decay) * (sin(2 * pi * frequency * t) +
                0.16 * sin(2 * pi * frequency * 2.37 * t) * exp(-t / (decay * 0.55))))

    for start, length, begin, end, gain in sweeps:
        add(start, length, lambda t: gain * sin(pi * t / length) ** 1.5 *
            sin(2 * pi * (begin * t + (end - begin) * t * t / (2 * length))))

    random = Random(647)
    for start, length, gain in rustles:
        smoothed = 0.0

        def filtered_noise(t):
            nonlocal smoothed
            smoothed = 0.77 * smoothed + 0.23 * random.uniform(-1, 1)
            return gain * sin(pi * t / length) ** 2 * smoothed

        add(start, length, filtered_noise)

    with wave.open(str(OUT / (name + ".wav")), "wb") as output:
        output.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        output.writeframes(b"".join(struct.pack("<h", round(32767 * max(-0.95, min(0.95, x)))) for x in buffer))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    render("preview", 0.19, bells=[(0.033, 480, 0.15, 0.027)], rustles=[(0, 0.14, 0.36)])
    render("take", 0.25, bells=[(0, 439, 0.25, 0.045), (0.045, 657, 0.19, 0.039)])
    render("place", 0.17, bells=[(0, 257, 0.24, 0.03), (0, 1048, 0.075, 0.038)])
    render("cap", 0.45, bells=[(0.30, 328, 0.29, 0.035)], sweeps=[(0.05, 0.29, 215, 620, 0.10)],
           rustles=[(0.04, 0.29, 0.26)])
    render("serve", 0.58, bells=[(0, 659.25, 0.28, 0.09), (0.066, 830.61, 0.27, 0.105),
           (0.134, 987.77, 0.25, 0.12), (0.195, 1318.51, 0.19, 0.102)])
    render("reject", 0.18, sweeps=[(0, 0.15, 285, 223, 0.24)])


if __name__ == "__main__":
    main()
