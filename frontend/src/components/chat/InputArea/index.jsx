import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, Square, Loader2, Smile, Paperclip, Image, Sparkles } from 'lucide-react';

export default function InputArea({
  onSend,
  isLoading = false,
  placeholder = '输入您的问题，探索非遗文化...',
  disabled = false,
}) {
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
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
      recognitionRef.current.start();
      setIsRecording(true);
    }
  }, [isRecording]);

  const handleSubmit = useCallback(() => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue || isLoading || disabled) return;

    onSend(trimmedValue);
    setInputValue('');

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
    { text: '武汉木雕有哪些代表性技法？', icon: '🎨' },
    { text: '汉绣的基本针法有哪些？', icon: '🧵' },
    { text: '黄鹤楼的历史传说有哪些？', icon: '🏯' },
  ];

  return (
    <div className="relative bg-gradient-to-t from-white via-white to-gray-50/50 backdrop-blur-xl border-t border-gray-200/50 p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

      <div className="max-w-4xl mx-auto">
        <AnimatePresence>
          {!inputValue && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex flex-wrap gap-2 mb-4"
            >
              {exampleQuestions.map((item, index) => (
                <motion.button
                  key={index}
                  onClick={() => setInputValue(item.text)}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="group flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 rounded-2xl cursor-pointer transition-all duration-300 border border-amber-200/50 hover:border-amber-300 hover:shadow-lg text-sm font-medium"
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.text}</span>
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    whileHover={{ opacity: 1, scale: 1 }}
                    className="ml-1"
                  >
                    <Sparkles size={14} className="text-amber-500" />
                  </motion.div>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative">
          <motion.div
            animate={{
              boxShadow: isFocused
                ? '0 0 0 3px rgba(59, 130, 246, 0.1), 0 8px 24px rgba(59, 130, 246, 0.15)'
                : '0 2px 8px rgba(0, 0, 0, 0.05)',
            }}
            className="relative rounded-2xl overflow-hidden bg-white border-2 border-gray-200 transition-all"
            style={{
              borderColor: isFocused ? '#3B82F6' : undefined,
            }}
          >
            <div className="flex items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder={placeholder}
                  disabled={disabled || isLoading}
                  rows={1}
                  className="w-full px-5 py-4 bg-transparent resize-none text-base text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                  style={{ minHeight: '56px', maxHeight: '200px' }}
                />
              </div>

              <div className="flex items-center gap-1 px-3 py-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 bg-transparent hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                  title="添加附件"
                >
                  <Paperclip size={18} />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 bg-transparent hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                  title="添加图片"
                >
                  <Image size={18} />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 bg-transparent hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                  title="添加表情"
                >
                  <Smile size={18} />
                </motion.button>

                {voiceSupported && (
                  <motion.button
                    onClick={toggleRecording}
                    disabled={disabled}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      isRecording
                        ? 'bg-gradient-to-br from-red-500 to-pink-500 text-white shadow-lg'
                        : 'bg-transparent hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                    }`}
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
                          <Square size={18} />
                          <motion.span
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="absolute inset-0 rounded-lg bg-red-500"
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="mic"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Mic size={18} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                )}

                <div className="w-px h-6 bg-gray-200 mx-1" />

                <motion.button
                  onClick={handleSubmit}
                  disabled={!inputValue.trim() || isLoading || disabled}
                  whileHover={inputValue.trim() && !isLoading && !disabled ? { scale: 1.1 } : {}}
                  whileTap={inputValue.trim() && !isLoading && !disabled ? { scale: 0.9 } : {}}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    inputValue.trim() && !isLoading && !disabled
                      ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                  title="发送消息"
                  style={
                    inputValue.trim() && !isLoading && !disabled
                      ? {
                          boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)',
                        }
                      : {}
                  }
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </motion.button>
              </div>
            </div>
          </motion.div>

          <div className="flex items-center justify-between mt-3 px-2">
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-xs">
                  Enter
                </kbd>
                <span>发送</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-xs">
                  Shift + Enter
                </kbd>
                <span>换行</span>
              </span>
            </div>
            {isRecording && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-red-500 text-xs font-medium"
              >
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="w-2 h-2 bg-red-500 rounded-full"
                />
                正在录音...
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
