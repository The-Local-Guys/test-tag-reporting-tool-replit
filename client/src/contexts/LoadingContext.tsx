import { createContext, useContext, useState, useRef, ReactNode } from 'react';

interface LoadingContextType {
  isPageLoading: boolean;
  startPageLoad: () => void;
  finishPageLoad: () => void;
}

const LoadingContext = createContext<LoadingContextType | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isPageLoading, setIsPageLoading] = useState(false);
  const loadingStartTimeRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startPageLoad = () => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    
    loadingStartTimeRef.current = Date.now();
    setIsPageLoading(true);
  };

  const finishPageLoad = () => {
    const now = Date.now();
    const loadingTime = loadingStartTimeRef.current ? now - loadingStartTimeRef.current : 0;
    const remainingTime = Math.max(0, 400 - loadingTime); // Minimum 400ms
    
    hideTimeoutRef.current = setTimeout(() => {
      setIsPageLoading(false);
      loadingStartTimeRef.current = null;
    }, remainingTime);
  };

  return (
    <LoadingContext.Provider value={{ isPageLoading, startPageLoad, finishPageLoad }}>
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

// Custom hook for navigation with loading
export function useNavigateWithLoading() {
  const { startPageLoad } = useLoading();
  
  return (href: string) => {
    startPageLoad();
    // Use setTimeout to ensure loading appears before navigation
    setTimeout(() => {
      window.location.href = href;
    }, 50);
  };
}