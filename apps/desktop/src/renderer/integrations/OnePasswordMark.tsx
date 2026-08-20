interface OnePasswordMarkProps {
  size?: number;
  className?: string;
}

/** 1Password product mark — blue tile + monogram, as used on the Mac app. */
export function OnePasswordMark({ size = 28, className }: OnePasswordMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#0572EC" />
      <path
        fill="#fff"
        d="M16.15 6.6c-2.62 0-4.28 1.58-4.28 3.86 0 1.12.4 2.04 1.14 2.72L8.3 25.4h3.02l1.48-3.86h6.4L20.7 25.4h3.12l-4.78-12.16c.7-.7 1.08-1.6 1.08-2.7 0-2.36-1.66-3.94-4.97-3.94Zm0 2.42c1.18 0 1.9.66 1.9 1.64s-.72 1.64-1.9 1.64-1.9-.66-1.9-1.64.72-1.64 1.9-1.64Zm-2.7 9.5 1.72-4.5h1.96l1.72 4.5h-5.4Z"
      />
    </svg>
  );
}
