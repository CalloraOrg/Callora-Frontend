import type { Shortcut } from "../hooks/useGlobalShortcuts";

type KbdHintProps = {
  shortcuts: readonly Shortcut[];
  label?: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function KbdHint({
  shortcuts,
  label = "Keyboard shortcuts",
  className = "",
  style,
}: KbdHintProps) {
  if (shortcuts.length === 0) return null;

  return (
    <aside className={`kbd-hint ${className}`.trim()} aria-label={label} style={style}>
      {shortcuts.map((shortcut) => (
        <span className="kbd-hint__item" key={`${shortcut.key}-${shortcut.description}`}>
          <kbd className="kbd-hint__key">{shortcut.key}</kbd>
          <span>{shortcut.description}</span>
        </span>
      ))}
    </aside>
  );
}

