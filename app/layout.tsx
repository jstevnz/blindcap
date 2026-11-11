import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";
export const metadata: Metadata = {
  title: "Blindcap",
  description:
    "Build your own blind competition. Invite your group, compare anonymous entries and reveal the winner with Blindcap.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="masthead">
          <a href="/" aria-label="Blindcap home">
            <Image
              src="/brand/blindcap-wordmark.png"
              alt="Blindcap"
              width={660}
              height={120}
              sizes="(max-width: 600px) 180px, 220px"
              className="brand-logo"
              preload
            />
          </a>
        </header>
        {children}
        <footer>BLINDCAP</footer>
      </body>
    </html>
  );
}
