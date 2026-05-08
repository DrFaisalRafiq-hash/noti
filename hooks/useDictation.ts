import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API types are a bit hidden — declare minimal shape
type AnyWindow = Window & {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
};

export interface DictationState {
  supported: boolean;
  listening: boolean;
  interim: string;
  finalText: string;
  error: string | null;
}

export function useDictation() {
  const recRef = useRef<any>(null);
  const finalRef = useRef<string>("");
  const [state, setState] = useState<DictationState>({
    supported: false,
    listening: false,
    interim: "",
    finalText: "",
    error: null,
  });

  useEffect(() => {
    const w = window as AnyWindow;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    setState((s) => ({ ...s, supported: !!Ctor }));
  }, []);

  const start = useCallback(() => {
    const w = window as AnyWindow;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setState((s) => ({ ...s, error: "Dictation isn't supported in this browser. Try Chrome or Safari." }));
      return;
    }
    finalRef.current = "";
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";

    rec.onresult = (e: any) => {
      let interim = "";
      let finalChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const transcript = res[0].transcript;
        if (res.isFinal) finalChunk += transcript;
        else interim += transcript;
      }
      if (finalChunk) {
        finalRef.current = (finalRef.current + " " + finalChunk).trim();
      }
      setState((s) => ({ ...s, interim, finalText: finalRef.current, error: null }));
    };
    rec.onerror = (e: any) => {
      setState((s) => ({ ...s, error: e.error || "Dictation error", listening: false }));
    };
    rec.onend = () => {
      setState((s) => ({ ...s, listening: false, interim: "" }));
    };

    try {
      rec.start();
      recRef.current = rec;
      setState((s) => ({ ...s, listening: true, error: null, interim: "", finalText: "" }));
    } catch (err: any) {
      setState((s) => ({ ...s, error: err?.message || "Could not start dictation" }));
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {}
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setState((s) => ({ ...s, interim: "", finalText: "", error: null }));
  }, []);

  return { ...state, start, stop, reset };
}
