import React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: 16 | 20;
}

export function InfoIcon({ size = 16, className, ...props }: IconProps) {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
