//
// Copyright 2023 DXOS.org
//

import * as DialogPrimitive from '@radix-ui/react-dialog';
import React, {
  ComponentProps,
  createContext,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  useCallback,
  useContext,
  useState
} from 'react';

import { defaultOverlay, mx, useMediaQuery, useTranslation } from '@dxos/react-components';

export type PanelSidebarState = 'show' | 'hide';

export interface PanelSidebarContextValue {
  setDisplayState: Dispatch<SetStateAction<PanelSidebarState>>;
  displayState: PanelSidebarState;
}

export const PanelSidebarContext = createContext<PanelSidebarContextValue>({
  displayState: 'hide',
  setDisplayState: () => {}
});

export const useTogglePanelSidebar = () => {
  const { displayState, setDisplayState } = useContext(PanelSidebarContext);
  return useCallback(() => {
    setDisplayState(displayState === 'hide' ? 'show' : 'hide');
  }, [displayState]);
};

export interface PanelSidebarProviderSlots {
  content?: ComponentProps<typeof DialogPrimitive.Content>;
  fixedBlockStart?: ComponentProps<'div'>;
  fixedBlockEnd?: ComponentProps<'div'>;
  main?: ComponentProps<'div'>;
}

export interface PanelSidebarProviderProps {
  inlineStart?: boolean;
  slots?: PanelSidebarProviderSlots;
}

export const PanelSidebarProvider = ({
  children,
  inlineStart,
  slots
}: PropsWithChildren<PanelSidebarProviderProps>) => {
  const { t } = useTranslation('os');
  const [isLg] = useMediaQuery('lg', { ssr: false });
  const [displayState, setInternalDisplayState] = useState<PanelSidebarState>(isLg ? 'show' : 'hide');
  const isOpen = displayState === 'show';
  const [transitionShow, setTransitionShow] = useState(isOpen);
  const [domShow, setDomShow] = useState(isOpen);

  const internalHide = () => {
    setTransitionShow(false);
    setInternalDisplayState('hide');
    setTimeout(() => {
      setDomShow(false);
    }, 200);
  };

  const internalShow = () => {
    setDomShow(true);
    setInternalDisplayState('show');
    setTimeout(() => {
      setTransitionShow(true);
      // todo (thure): this may be a race condition in certain situations
    }, 0);
  };

  const setDisplayState = (displayState: SetStateAction<PanelSidebarState>) =>
    displayState === 'show' ? internalShow() : internalHide();

  return (
    <PanelSidebarContext.Provider value={{ setDisplayState, displayState }}>
      <DialogPrimitive.Root open={domShow} modal={!isLg}>
        <DialogPrimitive.Content
          {...slots?.content}
          className={mx(
            'fixed block-start-0 block-end-0 is-[272px] z-50 transition-[inset-inline-start,inset-inline-end] duration-200 ease-in-out overflow-x-hidden overflow-y-auto',
            transitionShow ? 'inline-start-0' : 'inline-start-[-272px]',
            slots?.content?.className
          )}
        >
          <DialogPrimitive.Title className='sr-only'>{t('sidebar label')}</DialogPrimitive.Title>
          {slots?.content?.children}
        </DialogPrimitive.Content>
        {slots?.fixedBlockStart && (
          <div
            role='none'
            {...slots?.fixedBlockStart}
            className={mx(
              'fixed inline-end-0 block-start-0 z-[49] transition-[inset-inline-start,inset-inline-end] duration-200 ease-in-out',
              transitionShow ? 'inline-start-[272px]' : 'inline-start-0',
              slots?.fixedBlockStart?.className
            )}
          >
            {slots?.fixedBlockStart?.children}
          </div>
        )}
        {!isLg && (
          <DialogPrimitive.Overlay
            className={mx(
              defaultOverlay,
              'transition-opacity duration-200 ease-in-out',
              transitionShow ? 'opacity-100' : 'opacity-0'
            )}
            onClick={internalHide}
          />
        )}
        <div
          role='none'
          {...slots?.main}
          className={mx(
            'transition-[padding-inline-start] duration-200 ease-in-out',
            isLg && isOpen ? 'pis-[272px]' : 'pis-0',
            slots?.main?.className
          )}
        >
          {children}
        </div>
      </DialogPrimitive.Root>
    </PanelSidebarContext.Provider>
  );
};