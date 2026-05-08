import { useCallback, useEffect, useRef, useState } from "react";
import { pickRecorderMime } from "@/lib/voice-memos";

export type StudioMode = "raw" | "cleaned";

export interface StudioOptions {
  mode: StudioMode;
  /** Hard cap on a single take, in seconds. Default 60 minutes. */
  maxSeconds?: number;
}

export interface StudioState {
  supported: boolean;
  recording: boolean;
  paused: boolean;
  seconds: number;
  level: number;
  /** Peak-hold level over the last second, useful for VU-meter style display. */
  peak: number;
  waveform: number[];
  error: string | null;
  result: { blob: Blob; mime: string; seconds: number } | null;
}

const WAVEFORM_LEN = 96;

/**
 * Studio-grade browser recorder.
 *
 * Differences from {@link useAudioRecorder}:
 *   - per-take mode: "raw" (no DSP, mono 48kHz) or "cleaned" (browser DSP on)
 *   - exposes a peak-hold level for a real VU-meter display
 *   - longer waveform history for the studio scope
 */
export function useStudioRecorder(opts: StudioOptions) {
  const { mode, maxSeconds = 60 * 60 } = opts;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const [state, setState] = useState<StudioState>({
    supported: typeof window !== "undefined" && "MediaRecorder" in window,
    recording: false,
    paused: false,
    seconds: 0,
    level: 0,
    peak: 0,
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
  const peakRef = useRef(0);
  const peakDecayRef = useRef(0);

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

  const sampleAccumRef = useRef(0);
  const sampleCountRef = useRef(0);
  const lastPushRef = useRef(0);

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
    const level = Math.min(1, rms * 2.8);

    if (level > peakRef.current) {
      peakRef.current = level;
      peakDecayRef.current = performance.now();
    } else if (performance.now() - peakDecayRef.current > 800) {
      peakRef.current = Math.max(level, peakRef.current * 0.94);
    }

    sampleAccumRef.current += level;
    sampleCountRef.current += 1;
    const now = performance.now();
    let pushVal: number | null = null;
    if (now - lastPushRef.current >= 50) {
      pushVal = sampleAccumRef.current / Math.max(1, sampleCountRef.current);
      sampleAccumRef.current = 0;
      sampleCountRef.current = 0;
      lastPushRef.current = now;
    }

    setState((s) => {
      const wf =
        pushVal != null
          ? [...s.waveform.slice(1), Math.max(0.02, pushVal)]
          : s.waveform;
      return { ...s, level, peak: peakRef.current, waveform: wf };
    });
    rafRef.current = requestAnimationFrame(tickMeter);
  }, []);

  const start = useCallback(async () => {
    if (!state.supported) {
      setState((s) => ({ ...s, error: "Recording isn't supported in this browser." }));
      return;
    }
    setState((s) => ({
      ...s,
      error: null,
      result: null,
      seconds: 0,
      level: 0,
      peak: 0,
      waveform: new Array(WAVEFORM_LEN).fill(0),
    }));
    try {
      const dsp = modeRef.current === "cleaned";
      const constraints: MediaStreamConstraints = {
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: dsp,
          noiseSuppression: dsp,
          autoGainControl: dsp,
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

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
      const rec = new MediaRecorder(stream, {
        mimeType: mime,
        audioBitsPerSecond: 128_000,
      });
      chunksRef.current = [];
      const startedAt = Date.now();
      let pausedTotalMs = 0;
      let pausedAt: number | null = null;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        const seconds = Math.max(
          1,
          Math.round((Date.now() - startedAt - pausedTotalMs) / 1000),
        );
        setState((s) => ({
          ...s,
          recording: false,
          paused: false,
          result: { blob, mime, seconds },
        }));
        cleanup();
      };
      rec.onerror = (e: any) => {
        setState((s) => ({ ...s, error: e?.error?.message || "Recorder error" }));
      };

      rec.start(250);
      recRef.current = rec;

      timerRef.current = window.setInterval(() => {
        if (recRef.current?.state !== "recording") return;
        const elapsed = Math.floor((Date.now() - startedAt - pausedTotalMs) / 1000);
        setState((s) => ({ ...s, seconds: elapsed }));
        if (elapsed >= maxSeconds) stop();
      }, 250);

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
  }, [state.supported, tickMeter, cleanup, maxSeconds]);

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
      peak: 0,
      waveform: new Array(WAVEFORM_LEN).fill(0),
      error: null,
      result: null,
    });
  }, [cleanup]);

  return { ...state, start, pause, resume, stop, reset };
}
