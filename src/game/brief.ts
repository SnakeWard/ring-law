import { AUDIO_LAW, briefFor } from "../schema/index.ts";

let currentId = "";
let utterance: SpeechSynthesisUtterance | null = null;
let clip: HTMLAudioElement | null = null;
let onDone: (() => void) | null = null;

function pickVoice(): SpeechSynthesisVoice | undefined {
  if (typeof speechSynthesis === "undefined") return undefined;
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => /en-GB|en_GB/i.test(v.lang) && /male|daniel|george|rishi/i.test(v.name)) ||
    voices.find((v) => /^en/i.test(v.lang) && /male/i.test(v.name)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0]
  );
}

function finish() {
  const done = onDone;
  onDone = null;
  currentId = "";
  done?.();
}

export function stopBrief() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  utterance = null;
  if (clip) {
    clip.pause();
    clip.src = "";
    clip = null;
  }
  finish();
}

function speakScript(hullId: string, script: string) {
  if (!AUDIO_LAW.fallbackSpeech || typeof speechSynthesis === "undefined") {
    finish();
    return;
  }
  const speak = () => {
    const u = new SpeechSynthesisUtterance(script);
    u.rate = 0.92;
    u.pitch = 0.82;
    u.lang = "en-GB";
    const v = pickVoice();
    if (v) u.voice = v;
    u.onend = () => {
      if (currentId === hullId) stopBrief();
    };
    utterance = u;
    speechSynthesis.speak(u);
  };
  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.onvoiceschanged = () => {
      if (currentId === hullId) speak();
    };
  }
  speak();
}

export function playBrief(hullId: string, ended?: () => void): boolean {
  const b = briefFor(hullId);
  if (!b) return false;
  onDone = null;
  if (clip) {
    clip.pause();
    clip.src = "";
    clip = null;
  }
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  utterance = null;
  currentId = hullId;
  onDone = ended ?? null;

  if (AUDIO_LAW.playBakedMp3) {
    const a = new Audio(b.src);
    a.preload = "auto";
    clip = a;
    let handedOff = false;
    const fallback = () => {
      if (handedOff || currentId !== hullId) return;
      handedOff = true;
      if (clip === a) clip = null;
      speakScript(hullId, b.script);
    };
    a.onended = () => {
      if (currentId === hullId) stopBrief();
    };
    a.onerror = fallback;
    void a.play().catch(fallback);
    return true;
  }

  speakScript(hullId, b.script);
  return true;
}

export function briefPlayingId(): string {
  return currentId;
}
