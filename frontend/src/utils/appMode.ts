export const isWebMode = (): boolean => {
  return import.meta.env.VITE_APP_MODE === 'web' || !('__TAURI_INTERNALS__' in window);
};

export const isDesktopMode = (): boolean => {
  return !isWebMode();
};
