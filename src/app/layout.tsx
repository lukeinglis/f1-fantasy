import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Russo_One } from "next/font/google";
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
        className={`${geistSans.variable} ${geistMono.variable} ${russoOne.variable} antialiased text-stone-50 min-h-screen`}
      >
        <Providers>
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
          <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
