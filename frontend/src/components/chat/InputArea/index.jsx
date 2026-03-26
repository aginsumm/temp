import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Square, Loader2, Paperclip, Image, Smile, X } from 'lucide-react';

export default function InputArea({
  onSend,
  isLoading = false,
  placeholder = '输入您的问题，探索非遗文化...',
  disabled = false,
}) {
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onresult = (event) => {
        const results = Array.from(event.results);
        const transcriptText = results.map((result) => result[0].transcript).join('');
        setTranscript(transcriptText);
        setInputValue(transcriptText);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setTranscript('');
      recognitionRef.current.start();
      setIsRecording(true);
    }
  }, [isRecording]);

  const handleSubmit = useCallback(() => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue || isLoading || disabled) return;

    onSend(trimmedValue);
    setInputValue('');
    setTranscript('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputValue, isLoading, disabled, onSend]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const exampleQuestions = [
    '武汉木雕有哪些代表性技法？',
    '汉绣的基本针法有哪些？',
    '黄鹤楼的历史传说有哪些？',
  ];

  return (
    <div className="bg-white/80 backdrop-blur-sm border-t border-gray-200/50 p-4">
      <div className="max-w-4xl mx-auto">
        <AnimatePresence>
          {!inputValue && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex flex-wrap gap-2 mb-3"
            >
              {exampleQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => setInputValue(question)}
                  className="px-4 py-2 bg-amber-50 text-amber-700 rounded-2xl cursor-pointer transition-all duration-300 border-none text-sm hover:bg-amber-100 hover:-translate-y-0.5"
                >
                  {question}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              rows={1}
              className="w-full px-4 py-3 pr-12 bg-white border-2 border-gray-200 rounded-2xl resize-none text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-0 focus:outline-none transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />

            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 bg-transparent border-none hover:bg-gray-100 text-gray-500"
                title="添加表情"
              >
                <Smile size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {voiceSupported && (
              <motion.button
                onClick={toggleRecording}
                disabled={disabled}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  isRecording
                    ? 'bg-red-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={isRecording ? '停止录音' : '语音输入'}
              >
                <AnimatePresence mode="wait">
                  {isRecording ? (
                    <motion.div
                      key="recording"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="relative"
                    >
                      <Square size={20} />
                      <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-50" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="mic"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Mic size={20} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            )}

            <motion.button
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isLoading || disabled}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                inputValue.trim() && !isLoading && !disabled
                  ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              whileHover={inputValue.trim() && !isLoading && !disabled ? { scale: 1.05 } : {}}
              whileTap={inputValue.trim() && !isLoading && !disabled ? { scale: 0.95 } : {}}
              title="发送消息"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </motion.button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span>按 Enter 发送，Shift + Enter 换行</span>
          {isRecording && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-500 flex items-center gap-1"
            >
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              正在录音...
            </motion.span>
          )}
        </div>
      </div>
    </div>
  );
}
