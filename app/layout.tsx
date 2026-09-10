import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VocalVerify | Voice intelligence",
  description: "Client-side voice analysis demonstration"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
