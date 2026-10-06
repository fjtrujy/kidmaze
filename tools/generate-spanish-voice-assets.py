#!/usr/bin/env python3
"""Generate Kid Maze Spanish speech clips with MeloTTS."""

from pathlib import Path
import array
import sys
import types
import wave

# MeloTTS imports its Japanese frontend even when only Spanish is requested.
# Point that optional import at the bundled lightweight dictionary instead of
# requiring the separate ~500 MB full UniDic download.
import unidic_lite

unidic_compat = types.ModuleType("unidic")
unidic_compat.DICDIR = unidic_lite.DICDIR
sys.modules["unidic"] = unidic_compat

from melo.api import TTS  # noqa: E402


SPEECH_SPEED = 1.08
TARGET_PEAK = 0.88
CLIPS = {
    "up": "Arriba.",
    "down": "Abajo.",
    "left": "Izquierda.",
    "right": "Derecha.",
    "blocked": "No puedo avanzar.",
    "letter_a": "A.",
    "letter_b": "Be.",
    "letter_c": "Ce.",
    "letter_d": "De.",
    "letter_e": "E.",
    "letter_f": "Efe.",
    # MeloTTS articulates these isolated names more reliably with a doubled
    # Spanish /x/ onset while keeping the intended words "ge" / "jota".
    "letter_g": "Jjé.",
    "letter_h": "Hache.",
    "letter_i": "I.",
    "letter_j": "Jjota.",
    "letter_k": "Ka.",
    "letter_l": "Ele.",
    "letter_m": "Eme.",
    "letter_n": "Ene.",
    "letter_o": "O.",
    "letter_p": "Pe.",
    "letter_q": "Cu.",
    "letter_r": "Erre.",
    "letter_s": "Ese.",
    "letter_t": "Te.",
    "letter_u": "U.",
    "letter_v": "Uve.",
    "letter_w": "Uve doble.",
    "letter_x": "Equis.",
    "letter_y": "I griega.",
    "letter_z": "Zeta.",
    "number_0": "Cero.",
    "number_1": "Uno.",
    "number_2": "Dos.",
    "number_3": "Tres.",
    "number_4": "Cuatro.",
    "number_5": "Cinco.",
    "number_6": "Seis.",
    "number_7": "Siete.",
    "number_8": "Ocho.",
    "number_9": "Nueve.",
}


def normalize_peak(path: Path) -> None:
    with wave.open(str(path), "rb") as source:
        params = source.getparams()
        if params.sampwidth != 2:
            raise RuntimeError(f"Expected 16-bit PCM from MeloTTS, got {params.sampwidth * 8}-bit")
        frames = source.readframes(params.nframes)

    samples = array.array("h")
    samples.frombytes(frames)
    if sys.byteorder != "little":
        samples.byteswap()
    peak = max((abs(sample) for sample in samples), default=0)
    if peak == 0:
        return

    target = int(32767 * TARGET_PEAK)
    scale = target / peak
    normalized = array.array("h", (max(-32768, min(32767, round(sample * scale))) for sample in samples))
    if sys.byteorder != "little":
        normalized.byteswap()

    with wave.open(str(path), "wb") as destination:
        destination.setparams(params)
        destination.writeframes(normalized.tobytes())


def main() -> None:
    project_root = Path(__file__).resolve().parent.parent
    output_directory = project_root / "public" / "audio" / "voice" / "es"
    output_directory.mkdir(parents=True, exist_ok=True)

    requested = sys.argv[1:]
    unknown = [name for name in requested if name not in CLIPS]
    if unknown:
        raise SystemExit(f"Unknown Spanish voice clip(s): {', '.join(unknown)}")
    clips = ((name, CLIPS[name]) for name in requested) if requested else CLIPS.items()

    print("Loading MeloTTS Spanish model...")
    tts = TTS(language="ES", device="cpu")
    speaker_id = tts.hps.data.spk2id["ES"]

    for name, text in clips:
        output_path = output_directory / f"{name}.wav"
        print(f"es/{name}: {text}")
        tts.tts_to_file(
            text,
            speaker_id,
            str(output_path),
            speed=SPEECH_SPEED,
        )
        normalize_peak(output_path)

    print(f"Spanish voice assets written to {output_directory.relative_to(project_root)}")


if __name__ == "__main__":
    main()
