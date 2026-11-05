/**
 * Voice in and out. Everything degrades to text: if the microphone or the
 * recognition engine is unavailable, the caller still gets typed input.
 */
const STORE_KEYS = { voice: "kairos.voice", muted: "kairos.muted" };

export function createVoice({ hud, orb, language = "en-IN", onInterim, onResult, onError, onIdle }) {
  const synth = window.speechSynthesis;
  let voices = [];
  let chosen = localStorage.getItem(STORE_KEYS.voice) || null;
  let muted = localStorage.getItem(STORE_KEYS.muted) === "1";
  let talkTimer = null;
  let speaking = false;

  function refreshVoices() {
    if (!synth) return;
    voices = synth.getVoices().filter((v) => /^en/i.test(v.lang));
    if (!voices.length) voices = synth.getVoices();
    if (chosen && !voices.some((v) => v.name === chosen)) chosen = null;
    if (!chosen) {
      const preferred =
        voices.find((v) => /^en[-_]IN/i.test(v.lang)) ||
        voices.find((v) => /female|aria|neerja|swara/i.test(v.name)) ||
        voices[0];
      chosen = preferred?.name || null;
    }
    hud.setVoiceName(shortName(chosen));
  }

  if (synth) {
    refreshVoices();
    synth.addEventListener?.("voiceschanged", refreshVoices);
  }

  function shortName(name) {
    return name ? name.replace(/^Microsoft\s+/i, "") : "\u2014";
  }

  function cycleVoice() {
    if (!voices.length) return null;
    const index = voices.findIndex((v) => v.name === chosen);
    chosen = voices[(index + 1) % voices.length].name;
    localStorage.setItem(STORE_KEYS.voice, chosen);
    hud.setVoiceName(shortName(chosen));
    speak("Voice set to " + shortName(chosen));
    return chosen;
  }

  function toggleMute() {
    muted = !muted;
    localStorage.setItem(STORE_KEYS.muted, muted ? "1" : "0");
    if (muted) synth?.cancel();
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function stopSpeaking() {
    if (!synth) return;
    synth.cancel();
    clearTimeout(talkTimer);
    speaking = false;
  }

  function speak(text) {
    if (!synth || muted || !text) return;
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voices.find((v) => v.name === chosen);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = language;
    }
    utterance.rate = 1.02;
    const settle = () => {
      if (!speaking) return;
      speaking = false;
      clearTimeout(talkTimer);
      onIdle?.();
    };
    utterance.onstart = () => {
      speaking = true;
      orb.setState("speaking");
    };
    utterance.onend = settle;
    utterance.onerror = settle;
    synth.speak(utterance);
    // Some engines skip onstart on a silent device; fall back to a length timer
    // so the orb does not sit in "speaking" forever.
    clearTimeout(talkTimer);
    talkTimer = setTimeout(settle, Math.min(20000, 900 + text.length * 62));
  }

  return {
    speak,
    stopSpeaking,
    cycleVoice,
    toggleMute,
    isMuted,
    isSpeaking: () => speaking,
    voiceCount: () => voices.length,
    currentVoice: () => chosen,
    hasSynthesis: Boolean(synth),
    listen: createListener({ hud, orb, language, onInterim, onResult, onError, isSpeaking: () => speaking, stopSpeaking }),
  };
}

function createListener({ hud, orb, language, onInterim, onResult, onError, isSpeaking, stopSpeaking }) {
  const Engine = window.SpeechRecognition || window.webkitSpeechRecognition;
  let analyser = null;
  let stream = null;
  let audioCtx = null;
  let levelClock = null;
  let recognition = null;
  let listening = false;
  let finalText = "";

  async function ensureMic() {
    if (analyser) return true;
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return false;
    }
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    return true;
  }

  function pumpLevel() {
    if (!analyser) return;
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!listening) return;
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const value = (buffer[i] - 128) / 128;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / buffer.length);
      orb.setLevel(Math.min(1, rms * 6));
      hud.setSignal(Math.min(1, 0.15 + rms * 7));
      levelClock = requestAnimationFrame(tick);
    };
    tick();
  }

  function releaseMic() {
    cancelAnimationFrame(levelClock);
    levelClock = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    analyser = null;
    audioCtx?.close().catch(() => {});
    audioCtx = null;
    hud.setSignal(0);
  }

  async function start() {
    if (listening || !Engine) return false;
    if (isSpeaking()) stopSpeaking(); // echo guard: SPACE interrupts speech
    finalText = "";
    recognition = new Engine();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      onInterim?.(finalText + interim);
    };
    recognition.onerror = (event) => {
      stop(event.error !== "no-speech");
      onError?.(event.error);
    };

    recognition.onend = () => {
      if (!listening) return;
      stop(true);
    };

    try {
      recognition.start();
    } catch {
      onError?.("busy");
      return false;
    }
    listening = true;
    orb.setState("listening");
    hud.setStatus("LISTENING - RELEASE TO SEND");
    if (await ensureMic()) pumpLevel();
    return true;
  }

  /** Release sends what was heard. A failed session drops the transcript. */
  function stop(deliver = true) {
    if (!listening && !recognition) return;
    const text = finalText.trim();
    listening = false;
    releaseMic();
    const engine = recognition;
    recognition = null;
    try {
      engine?.stop();
    } catch {
      /* already stopped */
    }
    if (deliver && text) onResult?.(text);
  }

  return {
    start,
    stop,
    isAvailable: Boolean(Engine),
    isListening: () => listening,
  };
}
