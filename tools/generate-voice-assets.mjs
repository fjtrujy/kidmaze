import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initialize, setVoice, getPhonemes } from 'espeak-phonemizer';
import { KokoroTTS } from 'kokoro-js';

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const MODEL_OPTIONS = { dtype: 'q8', device: 'cpu' };
const SPEECH_SPEED = 0.94;

const VOICES = {
  en: 'bf_emma',
  es: 'ef_dora',
};

const CLIPS = {
  en: {
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
  },
  es: {
    up: '¡Arriba!',
    down: '¡Abajo!',
    left: '¡Izquierda!',
    right: '¡Derecha!',
    blocked: 'No puedo avanzar.',
    letter_a: '¡A!',
    letter_b: '¡Be!',
    letter_e: '¡E!',
    letter_i: '¡I!',
    letter_l: '¡Ele!',
    letter_m: '¡Eme!',
    letter_o: '¡O!',
    letter_t: '¡Te!',
    letter_x: '¡Equis!',
    number_0: '¡Cero!',
    number_1: '¡Uno!',
    number_2: '¡Dos!',
    number_3: '¡Tres!',
    number_4: '¡Cuatro!',
    number_5: '¡Cinco!',
    number_6: '¡Seis!',
    number_7: '¡Siete!',
    number_8: '¡Ocho!',
    number_9: '¡Nueve!',
  },
};

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputRoot = path.join(projectRoot, 'public', 'audio', 'voice');

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureSpanishVoice() {
  const kokoroEntry = fileURLToPath(import.meta.resolve('kokoro-js'));
  const packageRoot = path.resolve(path.dirname(kokoroEntry), '..');
  const voicePath = path.join(packageRoot, 'voices', `${VOICES.es}.bin`);
  if (await fileExists(voicePath)) {
    return;
  }

  const voiceUrl = `https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/${VOICES.es}.bin`;
  console.log(`Downloading ${VOICES.es} voice data...`);
  const response = await fetch(voiceUrl);
  if (!response.ok) {
    throw new Error(`Unable to download ${voiceUrl}: ${response.status} ${response.statusText}`);
  }
  await writeFile(voicePath, Buffer.from(await response.arrayBuffer()));
}

function spanishPhonemes(text) {
  return getPhonemes(text)
    .map(({ phonemes, terminator }) => `${phonemes}${terminator}`)
    .join(' ');
}

async function generateEnglish(tts, text) {
  return tts.generate(text, { voice: VOICES.en, speed: SPEECH_SPEED });
}

async function generateSpanish(tts, text) {
  const phonemes = spanishPhonemes(text);
  const { input_ids } = tts.tokenizer(phonemes, { truncation: true });
  return tts.generate_from_ids(input_ids, { voice: VOICES.es, speed: SPEECH_SPEED });
}

async function main() {
  await ensureSpanishVoice();
  await initialize();
  await setVoice('es');

  console.log('Loading Kokoro model...');
  const tts = await KokoroTTS.from_pretrained(MODEL_ID, MODEL_OPTIONS);

  for (const [language, clips] of Object.entries(CLIPS)) {
    const outputDirectory = path.join(outputRoot, language);
    await mkdir(outputDirectory, { recursive: true });

    for (const [name, text] of Object.entries(clips)) {
      const outputPath = path.join(outputDirectory, `${name}.wav`);
      console.log(`${language}/${name}: ${text}`);
      const audio = language === 'es'
        ? await generateSpanish(tts, text)
        : await generateEnglish(tts, text);
      await audio.save(outputPath);
    }
  }

  console.log(`Voice assets written to ${path.relative(projectRoot, outputRoot)}`);
}

await main();
