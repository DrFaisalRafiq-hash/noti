import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_RECORD_SECONDS, pickRecorderMime } from "@/lib/voice-memos";

export interface RecorderState {
  supported: boolean;
  recording: boolean;
  paused: boolean;
  seconds: number; // elapsed actively-recording seconds
  level: number;   // 0–1 input level for the meter
  /** Rolling history of recent input levels for the scrolling waveform. */
  waveform: number[];
  error: string | null;
  /** Last finished recording, ready to upload/download. */
  result: { blob: Blob; mime: string; seconds: number } | null;
}

const WAVEFORM_LEN = 64;

/**
 * MediaRecorder-backed audio capture with a 1-hour hard cap, pause/resume,
 * and an input-level meter for live waveform feedback. Returns the recorded
 * blob via `state.result` when stopped.
 */
export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>({
    supported: typeof window !== "undefined" && "MediaRecorder" in window,
    recording: false,
    paused: false,
    seconds: 0,
    level: 0,
    waveform: new Array(WAVEFORM_LEN).fill(0),
    error: null,
    result: null,
  });

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const mimeRef = useRef<string>("audio/webm");

  const cleanup = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const sampleAccumRef = useRef<number>(0);
  const sampleCountRef = useRef<number>(0);
  const lastPushRef = useRef<number>(0);

  const tickMeter = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    const level = Math.min(1, rms * 2.5);

    // Aggregate samples and push to waveform history every ~60ms so the
    // scrolling waveform reads as a smooth ribbon, not a strobe.
    sampleAccumRef.current += level;
    sampleCountRef.current += 1;
    const now = performance.now();
    let nextWaveform: number[] | null = null;
    if (now - lastPushRef.current >= 60) {
      const avg = sampleAccumRef.current / Math.max(1, sampleCountRef.current);
      sampleAccumRef.current = 0;
      sampleCountRef.current = 0;
      lastPushRef.current = now;
      nextWaveform = avg as unknown as number[]; // sentinel; built in setState below
    }

    setState((s) => {
      const wf = nextWaveform != null
        ? [...s.waveform.slice(1), Math.max(0.02, (nextWaveform as unknown as number))]
        : s.waveform;
      return { ...s, level, waveform: wf };
    });
    rafRef.current = requestAnimationFrame(tickMeter);
  }, []);

  const start = useCallback(async () => {
    if (!state.supported) {
      setState((s) => ({ ...s, error: "Recording isn't supported in this browser." }));
      return;
    }
    setState((s) => ({ ...s, error: null, result: null, seconds: 0, level: 0, waveform: new Array(WAVEFORM_LEN).fill(0) }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio analysis for the live meter
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      tickMeter();

      const mime = pickRecorderMime();
      mimeRef.current = mime;
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        const seconds = Math.round((Date.now() - startedAt) / 1000) - pausedTotalMs / 1000;
        setState((s) => ({
          ...s,
          recording: false,
          paused: false,
          result: { blob, mime, seconds: Math.max(1, Math.round(seconds)) },
        }));
        cleanup();
      };
      rec.onerror = (e: any) => {
        setState((s) => ({ ...s, error: e?.error?.message || "Recorder error" }));
      };

      let startedAt = Date.now();
      let pausedTotalMs = 0;
      let pausedAt: number | null = null;

      rec.start(250);
      recRef.current = rec;

      timerRef.current = window.setInterval(() => {
        if (recRef.current?.state !== "recording") return;
        const elapsed = Math.floor((Date.now() - startedAt - pausedTotalMs) / 1000);
        setState((s) => ({ ...s, seconds: elapsed }));
        if (elapsed >= MAX_RECORD_SECONDS) stop();
      }, 250);

      // expose pause bookkeeping via closure on the rec instance
      (rec as any).__markPaused = () => (pausedAt = Date.now());
      (rec as any).__markResumed = () => {
        if (pausedAt != null) {
          pausedTotalMs += Date.now() - pausedAt;
          pausedAt = null;
        }
      };

      setState((s) => ({ ...s, recording: true, paused: false }));
    } catch (e: any) {
      setState((s) => ({
        ...s,
        error: e?.message || "Microphone permission denied",
      }));
      cleanup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.supported, tickMeter, cleanup]);

  const pause = useCallback(() => {
    const rec = recRef.current;
    if (!rec || rec.state !== "recording") return;
    rec.pause();
    (rec as any).__markPaused?.();
    setState((s) => ({ ...s, paused: true }));
  }, []);

  const resume = useCallback(() => {
    const rec = recRef.current;
    if (!rec || rec.state !== "paused") return;
    (rec as any).__markResumed?.();
    rec.resume();
    setState((s) => ({ ...s, paused: false }));
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    if (rec.state !== "inactive") rec.stop();
  }, []);

  const reset = useCallback(() => {
    cleanup();
    chunksRef.current = [];
    recRef.current = null;
    setState({
      supported: typeof window !== "undefined" && "MediaRecorder" in window,
      recording: false,
      paused: false,
      seconds: 0,
      level: 0,
      waveform: new Array(WAVEFORM_LEN).fill(0),
      error: null,
      result: null,
    });
  }, [cleanup]);

  /** Seed a result blob (e.g. from a saved draft) so the take-ready UI shows. */
  const loadResult = useCallback((result: { blob: Blob; mime: string; seconds: number }) => {
    setState((s) => ({ ...s, recording: false, paused: false, result, seconds: result.seconds }));
  }, []);

  return { ...state, start, pause, resume, stop, reset, loadResult, mime: mimeRef.current };
}
