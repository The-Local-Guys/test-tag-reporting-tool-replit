import { useConditionalNavigation } from "@/hooks/useConditionalNavigation";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";

type ConditionalNavContextType = {
  navigate: (target: string) => void;
  showConfirm: boolean;
  confirmNavigation: () => void;
  cancelNavigation: () => void;
};

const ConditionalNavContext = createContext<ConditionalNavContextType | undefined>(undefined);

export const ConditionalNavProvider = ({ children }: { children: ReactNode }) => {
  const context = useConditionalNavigation();
  return (
    <ConditionalNavContext.Provider value={context}>
      {children}
    </ConditionalNavContext.Provider>
  );
};

export const useConditionalNav = () => {
  const context = useContext(ConditionalNavContext);
  if (!context) {
    throw new Error("useConditionalNav must be used within a ConditionalNavProvider");
  }
  return context;
};
