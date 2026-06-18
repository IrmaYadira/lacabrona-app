import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  className?: string;
}

export default function ScrollReveal({
  children,
  delay = 0,
  direction = "up",
  className = "",
}: Props) {
  const { ref, isVisible } = useScrollAnimation();

  const directionClasses = {
    up: "translate-y-4 md:translate-y-6",
    down: "-translate-y-4 md:-translate-y-6",
    left: "md:translate-x-8",
    right: "md:-translate-x-8",
  };

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out overflow-hidden ${directionClasses[direction]} ${className} ${
        isVisible
          ? "opacity-100 translate-x-0 translate-y-0"
          : "opacity-0"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}