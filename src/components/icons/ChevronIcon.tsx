import React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: 16 | 20;
}

export function ChevronIcon({ size = 16, className, ...props }: IconProps) {
  const ariaHidden = props["aria-label"] ? undefined : "true";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
      {...props}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}