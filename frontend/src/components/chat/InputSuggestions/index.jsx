import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb } from 'lucide-react';

export default function InputSuggestions({ 
  inputText, 
  onSelectSuggestion,
  isVisible 
}) {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (inputText.length > 2) {
      const matchedSuggestions = generateSuggestions(inputText);
      setSuggestions(matchedSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [inputText]);

  const generateSuggestions = (text) => {
    const allSuggestions = [
      '武汉木雕的浮雕技法有什么特点？',
      '汉绣的垫绣针法如何操作？',
      '黄鹤楼有哪些著名的传说故事？',
      '楚文化的浪漫主义体现在哪些方面？',
      '如何保护传统技艺？',
      '武汉有哪些非物质文化遗产？',
      '曾侯乙编钟有什么特点？',
    ];

    return allSuggestions.filter(s => 
      s.toLowerCase().includes(text.toLowerCase())
    ).slice(0, 3);
  };

  return (
    <AnimatePresence>
      {isVisible && suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50"
        >
          <div className="p-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <Lightbulb size={14} className="text-amber-600" />
            <span className="text-xs text-amber-700 font-medium">智能建议</span>
          </div>
          {suggestions.map((suggestion, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelectSuggestion(suggestion)}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              {suggestion}
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
