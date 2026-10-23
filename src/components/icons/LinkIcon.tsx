import React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: 16 | 20;
}

export function LinkIcon({ size = 16, className, ...props }: IconProps) {
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
      <path d="M10 13a5 5 0 0 0 7.07 0l3.14-3.14a5 5 0 0 0-7.07-7.07L10 5.93" />
      <path d="M14 11a5 5 0 0 0-7.07 0L3.79 14.14a5 5 0 0 0 7.07 7.07L14 18.07" />
    </svg>
  );
}