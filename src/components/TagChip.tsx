type TagChipProps = {
  tag: string;
  active?: boolean;
  onClick?: (tag: string) => void;
};

export default function TagChip({
  tag,
  active = false,
  onClick,
}: TagChipProps): JSX.Element {
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClick?.(tag);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.stopPropagation();
    }
  };

  return (
    <button
      type="button"
      className={`tag-chip${active ? " tag-chip--active" : ""}`}
      aria-pressed={active}
      aria-label={`Filter marketplace by tag ${tag}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span aria-hidden="true">#</span>
      <span>{tag}</span>
    </button>
  );
}
