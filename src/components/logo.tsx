// Single place the כתר הנדסה mark is rendered. Falls back to a "כה"
// text badge until the real logo artwork (black + white/transparent
// variants) is provided - swap the fallback below for an <img>/inline
// SVG then; every call site already passes through here.

const SIZE_CLASSES = {
  sm: "h-9 w-9 rounded-lg text-xs",
  md: "h-10 w-10 rounded-lg text-sm",
  lg: "h-14 w-14 rounded-xl text-2xl shadow-lg",
} as const;

export function Logo({
  size = "md",
}: {
  size?: keyof typeof SIZE_CLASSES;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-brand-600 font-bold text-white ${SIZE_CLASSES[size]}`}
    >
      כה
    </div>
  );
}
