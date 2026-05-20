'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

interface ModalConfig {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  type: 'confirm' | 'alert';
}

interface ModalContextValue {
  confirm: (message: string, opts?: { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }) => Promise<boolean>;
  alert: (message: string, opts?: { title?: string; confirmLabel?: string }) => Promise<void>;
}

const ModalContext = createContext<ModalContextValue>({
  confirm: async () => false,
  alert: async () => {},
});

export function useModal() {
  return useContext(ModalContext);
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalConfig | null>(null);
  const resolverRef = useRef<((val: boolean) => void) | null>(null);

  const confirm = useCallback((
    message: string,
    opts?: { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
  ): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setModal({ message, type: 'confirm', ...opts });
      resolverRef.current = resolve;
    });
  }, []);

  const alert = useCallback((
    message: string,
    opts?: { title?: string; confirmLabel?: string }
  ): Promise<void> => {
    return new Promise<void>((resolve) => {
      setModal({ message, type: 'alert', ...opts });
      resolverRef.current = () => resolve();
    });
  }, []);

  function handleConfirm() {
    resolverRef.current?.(true);
    resolverRef.current = null;
    setModal(null);
  }

  function handleCancel() {
    resolverRef.current?.(false);
    resolverRef.current = null;
    setModal(null);
  }

  return (
    <ModalContext.Provider value={{ confirm, alert }}>
      {children}
      {modal && (
        <>
          <div
            className="dialog-overlay"
            onClick={modal.type === 'alert' ? handleConfirm : handleCancel}
          />
          <div className="dialog-modal" role="dialog" aria-modal="true">
            {modal.title && <div className="dialog-title">{modal.title}</div>}
            <p className="dialog-message">{modal.message}</p>
            <div className="dialog-actions">
              {modal.type === 'confirm' && (
                <button className="btn-dialog-cancel" onClick={handleCancel}>
                  {modal.cancelLabel ?? 'Cancelar'}
                </button>
              )}
              <button
                className={modal.danger ? 'btn-dialog-danger' : 'btn-dialog-ok'}
                onClick={handleConfirm}
                autoFocus
              >
                {modal.confirmLabel ?? (modal.type === 'confirm' ? 'Aceptar' : 'OK')}
              </button>
            </div>
          </div>
        </>
      )}
    </ModalContext.Provider>
  );
}
