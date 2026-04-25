import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, AlertCircle, Loader2 } from 'lucide-react';
import {
  speechRecognitionService,
  type RecognitionState,
  type RecognitionResult,
} from '../../../services/speechRecognitionService';

interface VoiceInputProps {
  onResult: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onResult, disabled = false }: VoiceInputProps) {
  const [state, setState] = useState<RecognitionState>('idle');
  const [result, setResult] = useState<RecognitionResult>({
    final: '',
    interim: '',
    confidence: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    setIsSupported(speechRecognitionService.getIsSupported());
  }, []);

  const handleResult = useCallback(
    (res: RecognitionResult) => {
      setResult(res);
      if (res.final) {
        onResult(res.final);
      }
    },
    [onResult]
  );

  const handleError = useCallback((err: { error: string; message: string }) => {
    setError(err.message);
    setState('error');
    setTimeout(() => setError(null), 3000);
  }, []);

  const handleStart = useCallback(() => {
    setState('listening');
    setError(null);
  }, []);

  const handleEnd = useCallback(() => {
    setState('idle');
    setResult({ final: '', interim: '', confidence: 0 });
  }, []);

  useEffect(() => {
    speechRecognitionService.on('result', handleResult);
    speechRecognitionService.on('error', handleError);
    speechRecognitionService.on('start', handleStart);
    speechRecognitionService.on('end', handleEnd);

    return () => {
      speechRecognitionService.off('result', handleResult);
      speechRecognitionService.off('error', handleError);
      speechRecognitionService.off('start', handleStart);
      speechRecognitionService.off('end', handleEnd);
    };
  }, [handleResult, handleError, handleStart, handleEnd]);

  const toggleListening = () => {
    if (state === 'listening') {
      speechRecognitionService.stop();
    } else {
      speechRecognitionService.start();
    }
  };

  if (!isSupported) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{ background: 'var(--color-error-alpha)', color: 'var(--color-error)' }}
      >
        <AlertCircle size={16} />
        <span className="text-xs">浏览器不支持语音输入</span>
      </div>
    );
  }

  const getStateColor = () => {
    switch (state) {
      case 'listening':
        return 'var(--color-primary)';
      case 'processing':
        return 'var(--color-warning)';
      case 'error':
        return 'var(--color-error)';
      default:
        return 'var(--color-text-muted)';
    }
  };

  const getStateText = () => {
    switch (state) {
      case 'listening':
        return '正在聆听...';
      case 'processing':
        return '准备中...';
      case 'error':
        return error || '识别失败';
      default:
        return '语音输入';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <motion.button
        onClick={toggleListening}
        disabled={disabled || state === 'processing'}
        whileHover={{ scale: disabled ? 1 : 1.05 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background:
            state === 'listening'
              ? 'var(--color-primary-alpha)'
              : 'var(--color-background-secondary)',
          border: `1px solid ${state === 'listening' ? 'var(--color-primary)' : 'var(--color-border)'}`,
          color: getStateColor(),
        }}
      >
        <AnimatePresence mode="wait">
          {state === 'listening' ? (
            <motion.div
              key="listening"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Mic size={16} />
            </motion.div>
          ) : state === 'processing' ? (
            <motion.div
              key="processing"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Loader2 size={16} className="animate-spin" />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <MicOff size={16} />
            </motion.div>
          )}
        </AnimatePresence>
        <span className="text-xs font-medium">{getStateText()}</span>
      </motion.button>

      <AnimatePresence>
        {state === 'listening' && (result.interim || result.final) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-light)',
              color: 'var(--color-text-primary)',
            }}
          >
            {result.final && <span>{result.final}</span>}
            {result.interim && <span style={{ opacity: 0.6 }}>{result.interim}</span>}
            {result.confidence > 0 && (
              <div className="mt-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                置信度: {Math.round(result.confidence * 100)}%
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {state === 'listening' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-1 py-1"
          >
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1 h-1 rounded-full"
                style={{ background: 'var(--color-primary)' }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
