import { createContext, useContext, useState, ReactNode } from 'react';

interface LoadingContextType {
  isPageLoading: boolean;
  showPageLoading: () => void;
  hidePageLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isPageLoading, setIsPageLoading] = useState(false);

  const showPageLoading = () => {
    setIsPageLoading(true);
  };

  const hidePageLoading = () => {
    // Add a small delay to ensure the page has loaded before hiding
    setTimeout(() => setIsPageLoading(false), 300);
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