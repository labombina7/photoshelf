'use client';

/**
 * HeaderSlot — mecanismo para que cualquier página inyecte contenido
 * en la zona derecha del AppHeader global.
 *
 * Uso en una página Client Component:
 *   useHeaderSlot(<><span>2023</span><ViewToggle /></>)
 *
 * AppHeader lee el slot con useContext(HeaderSlotCtx).
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

interface HeaderSlotCtxValue {
  slot: ReactNode;
  setSlot: (node: ReactNode) => void;
  slotLeft: ReactNode;
  setSlotLeft: (node: ReactNode) => void;
}

export const HeaderSlotCtx = createContext<HeaderSlotCtxValue>({
  slot: null,
  setSlot: () => {},
  slotLeft: null,
  setSlotLeft: () => {},
});

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlotState] = useState<ReactNode>(null);
  const [slotLeft, setSlotLeftState] = useState<ReactNode>(null);
  const setSlot = useCallback((node: ReactNode) => setSlotState(node), []);
  const setSlotLeft = useCallback((node: ReactNode) => setSlotLeftState(node), []);

  return (
    <HeaderSlotCtx.Provider value={{ slot, setSlot, slotLeft, setSlotLeft }}>
      {children}
    </HeaderSlotCtx.Provider>
  );
}

/**
 * Hook que inyecta `content` en la zona derecha del header mientras
 * el componente está montado. Limpia el slot al desmontar.
 */
export function useHeaderSlot(content: ReactNode) {
  const { setSlot } = useContext(HeaderSlotCtx);

  useEffect(() => {
    setSlot(content);
    return () => setSlot(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);
}

export function useHeaderSlotLeft(content: ReactNode) {
  const { setSlotLeft } = useContext(HeaderSlotCtx);

  useEffect(() => {
    setSlotLeft(content);
    return () => setSlotLeft(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);
}
