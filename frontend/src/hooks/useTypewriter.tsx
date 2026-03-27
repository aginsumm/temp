import { useState, useEffect } from 'react';

interface TypewriterOptions {
  text: string;
  speed?: number;
  delay?: number;
  onComplete?: () => void;
}

export function useTypewriter({ 
  text, 
  speed = 20, 
  delay = 0,
  onComplete 
}: TypewriterOptions) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let index = 0;

    const startTyping = () => {
      setIsTyping(true);
      setDisplayedText('');

      const typeNextChar = () => {
        if (index < text.length) {
          setDisplayedText(text.slice(0, index + 1));
          index++;
          timeoutId = setTimeout(typeNextChar, speed);
        } else {
          setIsTyping(false);
          onComplete?.();
        }
      };

      typeNextChar();
    };

    if (delay > 0) {
      timeoutId = setTimeout(startTyping, delay);
    } else {
      startTyping();
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [text, speed, delay, onComplete]);

  return { displayedText, isTyping };
}
