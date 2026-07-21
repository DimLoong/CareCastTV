/* eslint-disable no-console */
/**
 * 共享提示/确认弹窗（基于 TDesign Dialog）
 *
 * 原来 admin/page.tsx 与 DataMigration.tsx 各自内联了一份几乎相同的
 * AlertModal + useAlertModal 实现（自绘遮罩层）。此处合并为唯一实现，
 * 用 TDesign Dialog 承载，两处调用方式（showAlert/showError/showSuccess）保持不变。
 *
 * 维护者：DimLoong
 */
'use client';

import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Dialog } from 'tdesign-react';

export interface AlertModalConfig {
  type: 'success' | 'error' | 'warning';
  title: string;
  message?: string;
  /** 富文本内容（DataMigration 的导入结果详情用到） */
  html?: string;
  /** 确认按钮文案，默认"确定" */
  confirmText?: string;
  /** 提供 onConfirm 时会同时展示"取消"按钮，构成确认/取消对话框 */
  onConfirm?: () => void;
  /** 无 onConfirm 时，仅展示一个"确定"按钮 */
  showConfirm?: boolean;
  /** 毫秒数，提供则到时自动关闭（用于成功提示的短暂展示） */
  timer?: number;
}

interface AlertModalProps extends AlertModalConfig {
  isOpen: boolean;
  onClose: () => void;
}

const ICONS = {
  success: <CheckCircle className='w-8 h-8 text-green-500' />,
  error: <AlertCircle className='w-8 h-8 text-red-500' />,
  warning: <AlertTriangle className='w-8 h-8 text-yellow-500' />,
};

export const AlertModal = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  html,
  confirmText = '确定',
  onConfirm,
  showConfirm = false,
  timer,
}: AlertModalProps) => {
  const hasFooter = Boolean(onConfirm || showConfirm);

  return (
    <Dialog
      visible={isOpen}
      header={title}
      onClose={onClose}
      destroyOnClose
      closeOnEscKeydown
      closeOnOverlayClick={!timer}
      cancelBtn={onConfirm ? '取消' : null}
      confirmBtn={hasFooter ? { content: confirmText, theme: 'primary' } : null}
      footer={hasFooter ? undefined : false}
      onConfirm={() => {
        onConfirm?.();
        onClose();
      }}
      onCancel={onClose}
    >
      <div className='text-center py-2'>
        <div className='flex justify-center mb-4'>{ICONS[type]}</div>
        {message && (
          <p className='text-gray-600 dark:text-gray-400 whitespace-pre-line'>
            {message}
          </p>
        )}
        {html && (
          <div
            className='text-left text-gray-600 dark:text-gray-400 mt-3'
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </Dialog>
  );
};

/** 弹窗状态管理：所有调用方共用同一套 API（alertModal / showAlert / hideAlert） */
export const useAlertModal = () => {
  const [alertModal, setAlertModal] = useState<
    AlertModalConfig & { isOpen: boolean }
  >({ isOpen: false, type: 'success', title: '' });

  const showAlert = (config: AlertModalConfig) => {
    setAlertModal({ ...config, isOpen: true });
  };

  const hideAlert = useCallback(() => {
    setAlertModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Dialog 组件本身不支持"到点自动关闭"，在此补上定时器
  useEffect(() => {
    if (alertModal.isOpen && alertModal.timer) {
      const id = setTimeout(hideAlert, alertModal.timer);
      return () => clearTimeout(id);
    }
  }, [alertModal.isOpen, alertModal.timer, hideAlert]);

  return { alertModal, showAlert, hideAlert };
};

/** 统一错误提示：传入 useAlertModal() 返回的 showAlert */
export const showError = (
  message: string,
  showAlert?: (config: AlertModalConfig) => void,
) => {
  if (showAlert) {
    showAlert({ type: 'error', title: '错误', message, showConfirm: true });
  } else {
    console.error(message);
  }
};

/** 统一成功提示：2 秒后自动关闭 */
export const showSuccess = (
  message: string,
  showAlert?: (config: AlertModalConfig) => void,
) => {
  if (showAlert) {
    showAlert({ type: 'success', title: '成功', message, timer: 2000 });
  } else {
    console.log(message);
  }
};
