import { useEffect, useRef, useState } from "react";

/**
 * Hook para detectar quando um elemento entra na área visível da tela (viewport).
 * Comumente usado para implementar Infinite Scroll.
 * 
 * @param options - Opções nativas da IntersectionObserver API.
 * @returns {Object} Ref para o elemento alvo e booleano de visibilidade.
 */
export function useIntersectionObserver(options?: IntersectionObserverInit) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    const target = targetRef.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [options]);

  return { targetRef, isIntersecting };
}
