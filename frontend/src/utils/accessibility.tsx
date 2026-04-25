import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

interface AccessibilityContextType {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  focusFirstFocusable: (container: HTMLElement) => void;
  trapFocus: (container: HTMLElement) => () => void;
  isHighContrast: boolean;
  isReducedMotion: boolean;
  fontSize: 'normal' | 'large' | 'extra-large';
  setFontSize: (size: 'normal' | 'large' | 'extra-large') => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'extra-large'>('normal');
  const announcerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsHighContrast(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-normal', 'font-large', 'font-extra-large');
    root.classList.add(`font-${fontSize}`);

    const fontSizes = {
      normal: '16px',
      large: '18px',
      'extra-large': '20px',
    };
    root.style.fontSize = fontSizes[fontSize];
  }, [fontSize]);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcerRef.current) {
      announcerRef.current.setAttribute('aria-live', priority);
      announcerRef.current.textContent = message;

      setTimeout(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  const focusFirstFocusable = useCallback((container: HTMLElement) => {
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, []);

  const trapFocus = useCallback((container: HTMLElement) => {
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <AccessibilityContext.Provider
      value={{
        announce,
        focusFirstFocusable,
        trapFocus,
        isHighContrast,
        isReducedMotion,
        fontSize,
        setFontSize,
      }}
    >
      {children}
      <div
        ref={announcerRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
    </AccessibilityContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options?: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean }
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrlMatch = options?.ctrl ? e.ctrlKey : !e.ctrlKey;
      const altMatch = options?.alt ? e.altKey : !e.altKey;
      const shiftMatch = options?.shift ? e.shiftKey : !e.shiftKey;
      const metaMatch = options?.meta ? e.metaKey : !e.metaKey;

      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        ctrlMatch &&
        altMatch &&
        shiftMatch &&
        metaMatch
      ) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, options]);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFocusTrap(active: boolean = true) {
  const containerRef = useRef<HTMLElement>(null);
  const { trapFocus } = useAccessibility();

  useEffect(() => {
    if (active && containerRef.current) {
      const cleanup = trapFocus(containerRef.current);
      return cleanup;
    }
  }, [active, trapFocus]);

  return containerRef;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAnnouncement() {
  const { announce } = useAccessibility();
  return announce;
}

export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only" aria-hidden="false">
      {children}
    </span>
  );
}

export function SkipLink({ targetId, label = '跳转到主内容' }: { targetId: string; label?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-500 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-white"
    >
      {label}
    </a>
  );
}

export function AccessibleButton({
  children,
  onClick,
  disabled,
  loading,
  ariaLabel,
  ariaDescribedBy,
  ariaExpanded,
  ariaHaspopup,
  className = '',
  ...props
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaExpanded?: boolean;
  ariaHaspopup?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { announce } = useAccessibility();

  const handleClick = () => {
    if (!disabled && !loading && onClick) {
      onClick();
    }
  };

  useEffect(() => {
    if (loading) {
      announce('加载中，请稍候');
    }
  }, [loading, announce]);

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHaspopup}
      aria-busy={loading}
      aria-disabled={disabled}
      className={`focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${className}`}
      {...props}
    >
      {loading && (
        <span className="sr-only" aria-live="polite">
          加载中...
        </span>
      )}
      {children}
    </button>
  );
}

export function AccessibleModal({
  isOpen,
  onClose,
  title,
  description,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const modalRef = useFocusTrap(isOpen);
  const { announce } = useAccessibility();

  useEffect(() => {
    if (isOpen) {
      announce(`对话框已打开: ${title}`);
    }
  }, [isOpen, title, announce]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-description' : undefined}
      ref={modalRef as React.RefObject<HTMLDivElement>}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-slate-800 rounded-xl p-6 max-w-lg w-full mx-4">
        <h2 id="modal-title" className="text-xl font-semibold text-white mb-4">
          {title}
        </h2>
        {description && (
          <p id="modal-description" className="text-gray-300 mb-4">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

export function AccessibleTooltip({
  content,
  children,
  position = 'top',
}: {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [isVisible, setIsVisible] = useState(false);
  const id = useRef(`tooltip-${Math.random().toString(36).substr(2, 9)}`);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-describedby={isVisible ? id.current : undefined}
      >
        {children}
      </div>
      {isVisible && (
        <div
          id={id.current}
          role="tooltip"
          className={`absolute z-50 px-2 py-1 text-sm bg-slate-700 text-white rounded whitespace-nowrap
            ${position === 'top' ? 'bottom-full mb-2' : ''}
            ${position === 'bottom' ? 'top-full mt-2' : ''}
            ${position === 'left' ? 'right-full mr-2' : ''}
            ${position === 'right' ? 'left-full ml-2' : ''}
          `}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export function AccessibleSelect({
  label,
  options,
  value,
  onChange,
  disabled,
  error,
  hint,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  hint?: string;
}) {
  const id = useRef(`select-${Math.random().toString(36).substr(2, 9)}`);
  const errorId = useRef(`error-${Math.random().toString(36).substr(2, 9)}`);
  const hintId = useRef(`hint-${Math.random().toString(36).substr(2, 9)}`);

  return (
    <div className="space-y-1">
      <label htmlFor={id.current} className="block text-sm font-medium text-gray-300">
        {label}
      </label>
      <select
        id={id.current}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={`${error ? errorId.current : ''} ${hint ? hintId.current : ''}`.trim() || undefined}
        aria-required
        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={hintId.current} className="text-sm text-gray-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId.current} role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function LiveRegion({
  children,
  priority = 'polite',
}: {
  children: React.ReactNode;
  priority?: 'polite' | 'assertive' | 'off';
}) {
  return (
    <div
      aria-live={priority === 'off' ? 'off' : priority}
      aria-atomic="true"
      className="sr-only"
    >
      {children}
    </div>
  );
}
