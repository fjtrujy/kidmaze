import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KokoroTTS } from 'kokoro-js';

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const MODEL_OPTIONS = { dtype: 'q8', device: 'cpu' };
const SPEECH_SPEED = 0.94;

const VOICE = 'bf_emma';

const CLIPS = {
    up: 'Up!',
    down: 'Down!',
    left: 'Left!',
    right: 'Right!',
    blocked: "I can't move forward.",
    letter_a: 'Ay!',
    letter_b: 'Bee!',
    letter_e: 'E!',
    letter_i: 'Eye!',
    letter_l: 'Ell!',
    letter_m: 'Em!',
    letter_o: 'Oh!',
    letter_t: 'Tee!',
    letter_x: 'Ex!',
    number_0: 'Zero!',
    number_1: 'One!',
    number_2: 'Two!',
    number_3: 'Three!',
    number_4: 'Four!',
    number_5: 'Five!',
    number_6: 'Six!',
    number_7: 'Seven!',
    number_8: 'Eight!',
    number_9: 'Nine!',
};

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputRoot = path.join(projectRoot, 'public', 'audio', 'voice');

async function main() {
  console.log('Loading Kokoro English model...');
  const tts = await KokoroTTS.from_pretrained(MODEL_ID, MODEL_OPTIONS);

  const outputDirectory = path.join(outputRoot, 'en');
  await mkdir(outputDirectory, { recursive: true });

  for (const [name, text] of Object.entries(CLIPS)) {
    const outputPath = path.join(outputDirectory, `${name}.wav`);
    console.log(`en/${name}: ${text}`);
    const audio = await tts.generate(text, { voice: VOICE, speed: SPEECH_SPEED });
    await audio.save(outputPath);
  }

  console.log(`English voice assets written to ${path.relative(projectRoot, outputDirectory)}`);
}

await main();
