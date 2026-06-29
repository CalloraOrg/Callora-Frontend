import React, { useEffect, useRef } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  actions: { label: string; action: () => void; isCritical?: boolean }[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, actions }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus trap & dismiss on Escape or clicking outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    
    // Auto-focus first interactive element for keyboard screen-reader accessibility
    const firstButton = menuRef.current?.querySelector("button");
    if (firstButton) firstButton.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="API Card Options"
      className="fixed z-50 min-w-[160px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
      style={{ top: `${y}px`, left: `${x}px` }}
    >
      {actions.map((item, index) => (
        <button
          key={index}
          role="menuitem"
          onClick={() => {
            item.action();
            onClose();
          }}
          className={`w-full text-left px-4 py-2 text-sm transition-colors duration-150 outline-none focus:bg-zinc-100 dark:focus:bg-zinc-800 ${
            item.isCritical 
              ? "text-red-600 focus:text-red-700" 
              : "text-zinc-700 dark:text-zinc-300"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};