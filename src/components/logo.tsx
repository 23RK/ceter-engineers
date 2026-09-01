import Image from "next/image";

// Source files are the full horizontal lockup (wordmark + tagline + mark),
// 5870x1439px. White for dark surfaces (the sidebar, mobile top bar - both
// bg-brand-950), black for light ones (the login/choose-user card, which
// is a light bg-white/95 card even though it floats on a dark page bg).
const LOGO_WIDTH = 5870;
const LOGO_HEIGHT = 1439;

const SIZE_CLASSES = {
  sm: "h-7", // mobile top bar
  md: "h-9", // desktop sidebar header
  lg: "h-16", // login / choose-user
} as const;

export function Logo({
  size = "md",
  variant = "white",
}: {
  size?: keyof typeof SIZE_CLASSES;
  variant?: "white" | "black";
}) {
  return (
    <Image
      src={variant === "white" ? "/logo-white.png" : "/logo-black.png"}
      alt="כתר הנדסה"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority
      className={`w-auto ${SIZE_CLASSES[size]}`}
    />
  );
}
