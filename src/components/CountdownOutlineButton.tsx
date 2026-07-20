'use client';

import React, { useEffect, useRef, useState } from 'react';

type CountdownSource = 'manual' | 'auto';

type CountdownOutlineButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> & {
  durationMs?: number;
  delayMs?: number;
  autoStart?: boolean;
  resetKey?: string | number;
  strokeWidth?: number;
  radius?: number;
  ringColor?: string;
  feedbackMs?: number;
  onPress?: (source: CountdownSource) => void;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
};

export function CountdownOutlineButton({
  durationMs = 5000,
  delayMs = 0,
  autoStart = true,
  resetKey,
  strokeWidth = 3,
  radius = 24,
  ringColor = '#3b82f6',
  feedbackMs = 420,
  disabled,
  className = '',
  style,
  onPress,
  onClick,
  children,
  type = 'button',
  ...rest
}: CountdownOutlineButtonProps) {
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const firedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const onPressRef = useRef(onPress);

  useEffect(() => {
    onPressRef.current = onPress;
  }, [onPress]);

  const clearTimers = () => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => {
    clearTimers();
    firedRef.current = false;
    setRunning(false);
    setCompleted(false);

    if (!autoStart || disabled) return;

    const startTimer = window.setTimeout(() => {
      setRunning(true);
    }, delayMs);

    const finishTimer = window.setTimeout(() => {
      if (firedRef.current) return;

      firedRef.current = true;
      setRunning(false);
      setCompleted(true);

      onPressRef.current?.('auto');

      const feedbackTimer = window.setTimeout(() => {
        setCompleted(false);
      }, feedbackMs);

      timersRef.current.push(feedbackTimer);
    }, delayMs + durationMs);

    timersRef.current = [startTimer, finishTimer];

    return clearTimers;
  }, [autoStart, disabled, delayMs, durationMs, feedbackMs, resetKey]);

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    if (disabled) return;

    if (!firedRef.current) {
      firedRef.current = true;
      clearTimers();
      setRunning(false);
      setCompleted(true);

      onPress?.('manual');

      window.setTimeout(() => {
        setCompleted(false);
      }, feedbackMs);
    }

    onClick?.(event);
  };

  const cssVars = {
    '--duration': `${durationMs}ms`,
    '--stroke-width': `${strokeWidth}px`,
    '--radius': `${radius}px`,
    '--ring-color': ringColor,
    '--feedback-ms': `${feedbackMs}ms`,
    ...style,
  } as React.CSSProperties & Record<string, string | number>;

  return (
    <>
      <button
        {...rest}
        type={type}
        disabled={disabled}
        data-running={running}
        data-completed={completed}
        className={`countdown-outline-button ${className}`}
        style={cssVars}
        onClick={handleClick}
      >
        <span className='countdown-outline-button__content'>{children}</span>
      </button>

      <style jsx>{`
        @property --countdown-angle {
          syntax: '<angle>';
          inherits: false;
          initial-value: 0deg;
        }

        .countdown-outline-button {
          position: relative;
          isolation: isolate;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;

          min-width: 56px;
          min-height: 56px;
          padding: 14px 22px;

          border: none;
          border-radius: var(--radius);
          corner-shape: squircle;

          color: inherit;

          cursor: pointer;
          user-select: none;
          overflow: hidden;

          transform: translateZ(0);
          transition:
            transform 180ms ease,
            opacity 180ms ease;
        }

        .countdown-outline-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .countdown-outline-button:active:not(:disabled) {
          transform: translateY(0) scale(0.985);
        }

        .countdown-outline-button:disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }

        .countdown-outline-button::before,
        .countdown-outline-button::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          corner-shape: squircle;
          padding: var(--stroke-width);
          pointer-events: none;

          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;

          mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          mask-composite: exclude;
        }

        /* 倒计时描边：从顶部中心开始，顺时针 */
        .countdown-outline-button::before {
          --countdown-angle: 0deg;

          background: conic-gradient(
            from 0deg,
            var(--ring-color) 0deg,
            var(--ring-color) var(--countdown-angle),
            transparent var(--countdown-angle),
            transparent 360deg
          );

          opacity: 0;
        }

        .countdown-outline-button[data-running='true']::before {
          opacity: 1;
          animation: countdown-outline-sweep var(--duration)
            cubic-bezier(0.42, 0, 1, 1) forwards;
        }

        /* 完成反馈：不填充，只做描边闪烁 + 轻微弹性 */
        .countdown-outline-button::after {
          opacity: 0;
          background: var(--ring-color);
          transform: scale(1);
        }

        .countdown-outline-button[data-completed='true'] {
          animation: countdown-complete-pop var(--feedback-ms) ease-out;
        }

        .countdown-outline-button[data-completed='true']::after {
          animation: countdown-complete-ring var(--feedback-ms) ease-out;
        }

        .countdown-outline-button__content {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        @keyframes countdown-outline-sweep {
          from {
            --countdown-angle: 0deg;
          }
          to {
            --countdown-angle: 360deg;
          }
        }

        @keyframes countdown-complete-pop {
          0% {
            transform: scale(1);
          }
          38% {
            transform: scale(1.035);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes countdown-complete-ring {
          0% {
            opacity: 0.95;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(1.08);
          }
        }
      `}</style>
    </>
  );
}
