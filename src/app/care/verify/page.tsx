/**
 * 退出关怀模式 —— 算术验证页
 *
 * 防误触设计（非防蓄意）：
 * - 随机生成 0-20 范围内的加减法题，答对才能退出关怀模式
 * - 答错刷新题目重来
 * - 30 秒（可配置）无操作自动回退关怀主页
 *
 * 维护者：DimLoong
 */
'use client';

import { ArrowLeft, Delete } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getCareConfig, setCareUnlocked } from '@/lib/carecast.client';

interface Question {
  text: string;
  answer: number;
}

/** 生成一道结果在 0-20 内的加减法题 */
function generateQuestion(): Question {
  const isAdd = Math.random() < 0.5;
  if (isAdd) {
    const answer = Math.floor(Math.random() * 21); // 0-20
    const a = Math.floor(Math.random() * (answer + 1));
    return { text: `${a} + ${answer - a} = ?`, answer };
  }
  const a = Math.floor(Math.random() * 21);
  const b = Math.floor(Math.random() * (a + 1)); // 保证结果非负
  return { text: `${a} - ${b} = ?`, answer: a - b };
}

export default function CareVerifyPage() {
  const router = useRouter();
  const [question, setQuestion] = useState<Question | null>(null);
  const [input, setInput] = useState('');
  const [wrong, setWrong] = useState(false);
  const [remaining, setRemaining] = useState(30);
  const timeoutSecondsRef = useRef(30);

  // 题目在客户端生成，避免 SSR/CSR 随机数不一致
  useEffect(() => {
    timeoutSecondsRef.current = getCareConfig().verifyTimeoutSeconds;
    setRemaining(timeoutSecondsRef.current);
    setQuestion(generateQuestion());
  }, []);

  // 无操作倒计时：任何输入都会重置；归零回退关怀主页
  useEffect(() => {
    if (remaining <= 0) {
      router.replace('/care');
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, router]);

  const resetIdleTimer = useCallback(() => {
    setRemaining(timeoutSecondsRef.current);
  }, []);

  const submit = useCallback(
    (value: string) => {
      if (!question || value === '') return;
      if (parseInt(value, 10) === question.answer) {
        // 验证通过：本次会话解锁，进入管理员视图
        setCareUnlocked(true);
        router.replace('/care-admin');
      } else {
        // 答错：刷新题目并给出视觉反馈
        setWrong(true);
        setInput('');
        setQuestion(generateQuestion());
        setTimeout(() => setWrong(false), 600);
      }
    },
    [question, router],
  );

  const pressDigit = (d: string) => {
    resetIdleTimer();
    // 答案最大 20，两位数足够
    setInput((prev) => (prev.length >= 2 ? prev : prev + d));
  };

  const pressDelete = () => {
    resetIdleTimer();
    setInput((prev) => prev.slice(0, -1));
  };

  // 支持物理键盘/遥控器数字键
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      resetIdleTimer();
      if (/^[0-9]$/.test(e.key)) {
        setInput((prev) => (prev.length >= 2 ? prev : prev + e.key));
      } else if (e.key === 'Backspace') {
        setInput((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        setInput((prev) => {
          submit(prev);
          return prev;
        });
      } else if (e.key === 'Escape') {
        router.replace('/care');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resetIdleTimer, submit, router]);

  return (
    <div className='fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950 text-white select-none px-6'>
      <div className='w-full max-w-md flex flex-col items-center gap-8'>
        <div className='text-center'>
          <h1 className='text-3xl font-bold'>退出关怀模式</h1>
          <p className='mt-2 text-lg text-gray-400'>请回答下面的算术题</p>
        </div>

        {/* 题目与当前输入 */}
        <div
          className={`text-6xl font-bold tabular-nums transition-colors ${
            wrong ? 'text-red-400 animate-pulse' : ''
          }`}
        >
          {question ? question.text.replace('?', input || '__') : '…'}
        </div>
        {wrong && <p className='text-xl text-red-400 -mt-4'>答错了，再试一次</p>}

        {/* 数字键盘：为触屏/遥控器设计的大按钮 */}
        <div className='grid grid-cols-3 gap-3 w-full'>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => pressDigit(d)}
              className='py-5 rounded-2xl bg-white/10 hover:bg-white/20 focus:bg-white/25 focus:outline-none focus:ring-4 focus:ring-white/30 text-3xl font-semibold transition-colors'
            >
              {d}
            </button>
          ))}
          <button
            onClick={pressDelete}
            className='py-5 rounded-2xl bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/30 flex items-center justify-center transition-colors'
            aria-label='删除'
          >
            <Delete className='w-8 h-8' />
          </button>
          <button
            onClick={() => pressDigit('0')}
            className='py-5 rounded-2xl bg-white/10 hover:bg-white/20 focus:bg-white/25 focus:outline-none focus:ring-4 focus:ring-white/30 text-3xl font-semibold transition-colors'
          >
            0
          </button>
          <button
            onClick={() => submit(input)}
            className='py-5 rounded-2xl bg-green-600 hover:bg-green-500 focus:outline-none focus:ring-4 focus:ring-green-300/50 text-2xl font-bold transition-colors'
          >
            确定
          </button>
        </div>

        {/* 回退提示 */}
        <div className='flex items-center justify-between w-full text-gray-400'>
          <button
            onClick={() => router.replace('/care')}
            className='flex items-center gap-1 px-4 py-2 rounded-full bg-white/5 hover:bg-white/15 text-lg transition-colors'
          >
            <ArrowLeft className='w-5 h-5' />
            返回
          </button>
          <span className='text-lg tabular-nums'>{remaining} 秒后自动返回</span>
        </div>
      </div>
    </div>
  );
}
