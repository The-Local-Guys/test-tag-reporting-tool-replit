import { createContext, useContext, useState, useRef, ReactNode } from 'react';

interface LoadingContextType {
  isPageLoading: boolean;
  showPageLoading: () => void;
  hidePageLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isPageLoading, setIsPageLoading] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showPageLoading = () => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsPageLoading(true);
  };

  const hidePageLoading = () => {
    // Delay hiding to ensure content has loaded
    hideTimeoutRef.current = setTimeout(() => {
      setIsPageLoading(false);
    }, 300);
  };

  return (
    <LoadingContext.Provider value={{ isPageLoading, showPageLoading, hidePageLoading }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}