import { useState, useRef, useEffect, useCallback } from 'react';
import { SpeechRecognitionOptions, SpeechSynthesisOptions } from '../types';

/**
 * Checks if browser supports Speech Recognition.
 */
export const isSpeechRecognitionSupported = (): boolean =>
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

/**
 * Checks if browser supports Speech Synthesis (Text to Speech).
 */
export const isSpeechSynthesisSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Hook for speech-to-text audio input using Web Speech API.
 */
export function useSpeechRecognition(options: SpeechRecognitionOptions = {}) {
  const { onResult, onError, continuous = false, lang = 'en-US' } = options;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      onError?.(new Error('Speech recognition not supported in this browser.'));
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = continuous;
      recognition.interimResults = false;
      recognition.lang = lang;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: any) => {
        setIsListening(false);
        onError?.(event.error);
      };
      recognition.onresult = (event: any) => {
        const text = event.results?.[0]?.[0]?.transcript || '';
        setTranscript(text);
        onResult?.(text);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
      onError?.(err);
    }
  }, [continuous, lang, onError, onResult]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcript,
    isSupported: isSpeechRecognitionSupported(),
    startListening,
    stopListening,
    toggleListening,
  };
}

/**
 * Hook for text-to-speech voice playback using Web Speech API.
 */
export function useSpeechSynthesis(defaultOptions: SpeechSynthesisOptions = {}) {
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (isSpeechSynthesisSupported()) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    if (isSpeechSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (id: string, text: string, options: SpeechSynthesisOptions = {}) => {
      if (!isSpeechSynthesisSupported()) return;

      if (speakingId === id) {
        stopSpeaking();
        return;
      }

      window.speechSynthesis.cancel();

      // Clean markdown tables & codeblocks for natural reading
      const cleanText = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`.*?`/g, '')
        .replace(/\|.*?\|/g, '')
        .replace(/[*#_~]/g, '')
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = options.rate ?? defaultOptions.rate ?? 1.0;
      utterance.pitch = options.pitch ?? defaultOptions.pitch ?? 1.0;
      utterance.lang = options.lang ?? defaultOptions.lang ?? 'en-US';

      utterance.onend = () => {
        setSpeakingId(null);
        options.onEnd?.();
        defaultOptions.onEnd?.();
      };
      utterance.onerror = () => {
        setSpeakingId(null);
      };

      setSpeakingId(id);
      window.speechSynthesis.speak(utterance);
    },
    [defaultOptions, speakingId, stopSpeaking]
  );

  return {
    speakingId,
    isSpeaking: speakingId !== null,
    isSupported: isSpeechSynthesisSupported(),
    speak,
    stopSpeaking,
  };
}
