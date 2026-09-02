import { useState, useEffect, useCallback } from 'react';

export type ControlMode = 'auto' | 'pc' | 'mobile';

export interface ResponsiveInfo {
  width: number;
  height: number;
  dpr: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  hasTouch: boolean;
  isTouch: boolean;
  activeInputMode: 'pc' | 'mobile';
  isFullscreen: boolean;
  toggleFullscreen: () => Promise<void>;
  requestLandscape: () => Promise<boolean>;
  setControlModeOverride: (mode: ControlMode) => void;
  controlModeOverride: ControlMode;
}

export function useResponsive(): ResponsiveInfo {
  const [controlModeOverride, setControlModeOverride] = useState<ControlMode>('auto');
  const [detectedInput, setDetectedInput] = useState<'pc' | 'mobile'>(() => {
    if (typeof window === 'undefined') return 'pc';
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmall = window.innerWidth < 1024;
    return (hasTouch && isSmall) ? 'mobile' : 'pc';
  });

  const [state, setState] = useState(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const h = typeof window !== 'undefined' ? window.innerHeight : 720;
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const isPortrait = h > w;
    const isLandscape = w >= h;
    const hasTouch =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0 || (navigator as { msMaxTouchPoints?: number }).msMaxTouchPoints! > 0);
    const isMobile = w < 640 || (w < 920 && h < 520);
    const isTablet = (w >= 640 && w < 1024) && !(w < 920 && h < 520);
    const isDesktop = w >= 1024 && !isMobile;
    const isFullscreen =
      typeof document !== 'undefined' &&
      !!(document.fullscreenElement || (document as { webkitFullscreenElement?: Element }).webkitFullscreenElement);

    return {
      width: w,
      height: h,
      dpr,
      isMobile,
      isTablet,
      isDesktop,
      isPortrait,
      isLandscape,
      hasTouch,
      isTouch: hasTouch,
      isFullscreen
    };
  });

  const updateDimensions = useCallback(() => {
    if (typeof window === 'undefined') return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const isPortrait = h > w;
    const isLandscape = w >= h;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobile = w < 640 || (w < 920 && h < 520);
    const isTablet = (w >= 640 && w < 1024) && !(w < 920 && h < 520);
    const isDesktop = w >= 1024 && !isMobile;
    const isFullscreen = !!(document.fullscreenElement || (document as { webkitFullscreenElement?: Element }).webkitFullscreenElement);

    setState({
      width: w,
      height: h,
      dpr,
      isMobile,
      isTablet,
      isDesktop,
      isPortrait,
      isLandscape,
      hasTouch,
      isTouch: hasTouch,
      isFullscreen
    });
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement && !(document as { webkitFullscreenElement?: Element }).webkitFullscreenElement) {
        const root = document.documentElement;
        if (root.requestFullscreen) {
          await root.requestFullscreen();
        } else if ((root as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
          await (root as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen!();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen) {
          await (document as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen!();
        }
      }
    } catch {
      // Fullscreen not permitted or cancelled
    }
  }, []);

  const requestLandscape = useCallback(async (): Promise<boolean> => {
    try {
      // First attempt fullscreen
      await toggleFullscreen();
      // Try to lock screen orientation if supported by browser/device
      const orientation = (screen as { orientation?: { lock?: (orient: string) => Promise<void> } }).orientation;
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('landscape');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [toggleFullscreen]);

  useEffect(() => {
    updateDimensions();

    const handleTouch = () => {
      setDetectedInput('mobile');
    };

    const handleKeyOrMouseMove = (e: MouseEvent | KeyboardEvent) => {
      // If genuine mouse movement or keypress occurs without touch, switch to PC
      if (e instanceof MouseEvent && (e.movementX !== 0 || e.movementY !== 0)) {
        if (window.innerWidth >= 900) {
          setDetectedInput('pc');
        }
      }
      if (e instanceof KeyboardEvent) {
        setDetectedInput('pc');
      }
    };

    window.addEventListener('touchstart', handleTouch, { passive: true });
    window.addEventListener('mousemove', handleKeyOrMouseMove, { passive: true });
    window.addEventListener('keydown', handleKeyOrMouseMove, { passive: true });
    window.addEventListener('resize', updateDimensions, { passive: true });
    window.addEventListener('orientationchange', updateDimensions, { passive: true });
    document.addEventListener('fullscreenchange', updateDimensions, { passive: true });
    document.addEventListener('webkitfullscreenchange', updateDimensions, { passive: true });

    const handleOrientation = () => {
      setTimeout(updateDimensions, 100);
      setTimeout(updateDimensions, 300);
    };
    window.addEventListener('orientationchange', handleOrientation);

    return () => {
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('mousemove', handleKeyOrMouseMove);
      window.removeEventListener('keydown', handleKeyOrMouseMove);
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
      window.removeEventListener('orientationchange', handleOrientation);
      document.removeEventListener('fullscreenchange', updateDimensions);
      document.removeEventListener('webkitfullscreenchange', updateDimensions);
    };
  }, [updateDimensions]);

  // Determine active input mode
  let activeInputMode: 'pc' | 'mobile' = 'pc';
  if (controlModeOverride === 'pc') {
    activeInputMode = 'pc';
  } else if (controlModeOverride === 'mobile') {
    activeInputMode = 'mobile';
  } else {
    activeInputMode = (state.hasTouch || state.isMobile || detectedInput === 'mobile') ? 'mobile' : 'pc';
  }

  return {
    ...state,
    activeInputMode,
    toggleFullscreen,
    requestLandscape,
    setControlModeOverride,
    controlModeOverride
  };
}
