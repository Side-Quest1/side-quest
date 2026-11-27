import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const manrope = localFont({
  src:"../../../../packages/ui/assets/Manrope-latin.woff",
  weight:"200 800",
  variable: "--font-manrope",
});

const inter = localFont({
  src:"../../../../packages/ui/assets/Inter-latin.woff",
  weight:"100 900",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "SideQuest — Find Your Next Adventure",
    template: "%s | SideQuest",
  },
  description:
    "Discover nearby activities, meet people with shared interests, and make plans worth leaving home for.",
  applicationName: "SideQuest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var m=localStorage.getItem("sidequest-theme");var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
