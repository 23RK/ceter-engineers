import type { MetadataRoute } from "next";

/** PWA: install "כתר הנדסה" to the home screen (SPEC §1.2). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "כתר הנדסה",
    short_name: "כתר הנדסה",
    description: "ניהול ופיקוח פרויקטים בבנייה",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    dir: "rtl",
    lang: "he",
    background_color: "#0b0b10",
    theme_color: "#0b0b10",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
