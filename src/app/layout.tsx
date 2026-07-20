import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Russo_One } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { auth } from "@/lib/auth";
import NavBar from "@/components/NavBar";
import BottomNav from "@/components/BottomNav";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const f1Bold = localFont({
  src: "../../public/fonts/Formula1-Bold.ttf",
  variable: "--font-f1-bold",
  display: "swap",
});

const f1Regular = localFont({
  src: "../../public/fonts/Formula1-Regular.ttf",
  variable: "--font-f1-regular",
  display: "swap",
});

const f1Wide = localFont({
  src: "../../public/fonts/Formula1-Wide.ttf",
  variable: "--font-f1-wide",
  display: "swap",
});

const russoOne = Russo_One({
  variable: "--font-russo-one",
  weight: "400",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#1a1a2e",
};

export const metadata: Metadata = {
  title: "F1 Fantasy League",
  description: "A use-it-or-lose-it F1 fantasy league with friends",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "F1 Fantasy",
  },
  icons: {
    apple: "/icon-192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${f1Bold.variable} ${f1Regular.variable} ${f1Wide.variable} ${russoOne.variable} antialiased min-h-screen`}
      >
        <Providers>
          <a
            href="#main-content"
            className="skip-to-content"
          >
            Skip to content
          </a>
          <NavBar
            user={
              session?.user
                ? {
                    name: session.user.name ?? "",
                    email: session.user.email ?? "",
                    role: (session.user as { role?: string }).role ?? "player",
                  }
                : null
            }
          />
          <main id="main-content" className="max-w-5xl mx-auto px-4 py-6 pb-20 md:pb-6">
            {children}
          </main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
