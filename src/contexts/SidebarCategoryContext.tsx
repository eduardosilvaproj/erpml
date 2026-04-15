import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface SidebarCategoryContextType {
  activeCategory: string | null;
  setActiveCategory: (category: string | null) => void;
  toggleCategory: (category: string) => void;
}

const SidebarCategoryContext = createContext<SidebarCategoryContextType>({
  activeCategory: null,
  setActiveCategory: () => {},
  toggleCategory: () => {},
});

export function SidebarCategoryProvider({ children }: { children: ReactNode }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const toggleCategory = useCallback((category: string) => {
    setActiveCategory((prev) => (prev === category ? null : category));
  }, []);

  return (
    <SidebarCategoryContext.Provider value={{ activeCategory, setActiveCategory, toggleCategory }}>
      {children}
    </SidebarCategoryContext.Provider>
  );
}

export const useSidebarCategory = () => useContext(SidebarCategoryContext);
