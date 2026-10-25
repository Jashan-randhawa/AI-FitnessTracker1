import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import axios from 'axios';
import api from '../../configs/api';

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
}

interface SpeechRecognitionErrorLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((err: SpeechRecognitionErrorLike) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export interface ParsedVoiceSet {
  exerciseName: string;
  weightKg: number;
  reps: number;
  rpe?: number;
  startRestTimer: boolean;
}

interface VoiceSetLoggerProps {
  onSetParsed: (set: ParsedVoiceSet) => void;
  className?: string;
}

export const VoiceSetLogger = ({ onSetParsed, className = '' }: VoiceSetLoggerProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Initialize SpeechRecognition if available
  useEffect(() => {
    const win = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRec) {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let current = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          current += event.results[i][0].transcript;
        }
        setInterimText(current);
      };

      recognition.onend = async () => {
        setIsListening(false);
      };

      recognition.onerror = (err: SpeechRecognitionErrorLike) => {
        setIsListening(false);
        if (err.error !== 'no-speech' && err.error !== 'aborted') {
          toast.error(`Speech error: ${err.error}`);
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const sendSpeechForParsing = async (text: string) => {
    if (!text || text.trim().length === 0) return;
    setIsProcessing(true);
    try {
      const res = await api.post('/api/workouts/parse-voice-set', {
        speechText: text.trim(),
      });

      if (res.data?.success && res.data.parsed) {
        const parsed: ParsedVoiceSet = res.data.parsed;
        toast.success(
          `Logged: ${parsed.exerciseName} · ${parsed.weightKg}kg x ${parsed.reps} ${
            parsed.rpe ? `(RPE ${parsed.rpe})` : ''
          }`
        );
        onSetParsed(parsed);
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
      toast.error(msg || 'Failed to parse voice set');
    } finally {
      setIsProcessing(false);
      setInterimText('');
    }
  };

  const startListening = async () => {
    setInterimText('');

    if (recognitionRef.current) {
      try {
        setIsListening(true);
        recognitionRef.current.start();
      } catch {
        // Recognition already active
      }
      return;
    }

    // MediaRecorder fallback for browsers without SpeechRecognition
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        setIsProcessing(true);
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'voice-set.webm');

          const res = await api.post('/api/workouts/parse-voice-set', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          if (res.data?.success && res.data.parsed) {
            const parsed: ParsedVoiceSet = res.data.parsed;
            toast.success(
              `Logged: ${parsed.exerciseName} · ${parsed.weightKg}kg x ${parsed.reps}`
            );
            onSetParsed(parsed);
          }
        } catch (err: unknown) {
          const msg = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
          toast.error(msg || 'Failed to parse audio set');
        } finally {
          setIsProcessing(false);
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch {
      toast.error('Microphone permission required for voice set logging');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      if (interimText) {
        sendSpeechForParsing(interimText);
      }
    } else if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* Floating Push-to-Talk Mic Button */}
      <motion.button
        type="button"
        onClick={handleToggle}
        disabled={isProcessing}
        whileTap={{ scale: 0.92 }}
        className={`relative flex items-center justify-center rounded-full transition-all duration-300 shadow-lg cursor-pointer ${
          isListening
            ? 'w-12 h-12 bg-rose-500 text-white shadow-rose-500/40 ring-4 ring-rose-500/30 animate-pulse'
            : isProcessing
            ? 'w-12 h-12 bg-amber-500 text-white shadow-amber-500/40'
            : 'w-11 h-11 bg-emerald-500 text-white shadow-emerald-500/30 hover:bg-emerald-600'
        }`}
        title={isListening ? 'Tap to stop & log' : 'Tap to speak workout set'}
        aria-label="Voice Set Logger"
      >
        {isProcessing ? (
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : isListening ? (
          <span className="relative flex h-5 w-5 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <svg
              className="relative w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
            </svg>
          </span>
        ) : (
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        )}
      </motion.button>

      {/* Live Speech Recognition Tooltip / Banner */}
      <AnimatePresence>
        {(isListening || isProcessing) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 top-14 z-50 min-w-[240px] max-w-[320px] p-3 rounded-2xl bg-slate-900/95 text-white shadow-2xl border border-slate-700/80 backdrop-blur-md text-xs pointer-events-none"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  isListening ? 'bg-rose-500 animate-ping' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="font-bold uppercase tracking-wider text-[10px] text-slate-300">
                {isListening ? 'Listening...' : 'AI Processing...'}
              </span>
            </div>
            <p className="font-medium text-slate-100 italic">
              {interimText
                ? `"${interimText}"`
                : 'Say e.g.: "Bench press 80 kilos for 8 reps, felt like RPE 8.5"'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
