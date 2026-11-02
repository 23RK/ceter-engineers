import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "כתר הנדסה | ניהול פרויקטים",
  description: "מערכת ניהול משימות, פרויקטים ולוחות זמנים - כתר הנדסה",
  applicationName: "כתר הנדסה",
  // Home-screen name on iPhone (the icon itself is app/apple-icon.png).
  appleWebApp: { title: "כתר הנדסה", statusBarStyle: "black-translucent" },
};

// "cover" so the mobile bottom bar can pad itself for the iPhone home
// indicator with env(safe-area-inset-bottom).
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#0b0b10",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
