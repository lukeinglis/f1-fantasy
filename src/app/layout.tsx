import type { Metadata } from "next";
import { Geist, Geist_Mono, Permanent_Marker, Russo_One } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/auth";
import NavBar from "@/components/NavBar";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const permanentMarker = Permanent_Marker({
  variable: "--font-permanent-marker",
  weight: "400",
  subsets: ["latin"],
});

const russoOne = Russo_One({
  variable: "--font-russo-one",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "F1 Fantasy League",
  description: "A use-it-or-lose-it F1 fantasy league with friends",
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
        className={`${geistSans.variable} ${geistMono.variable} ${permanentMarker.variable} ${russoOne.variable} antialiased min-h-screen`}
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
          <main id="main-content" className="max-w-5xl mx-auto px-4 py-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
