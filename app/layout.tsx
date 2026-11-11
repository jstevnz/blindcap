import LoadingLink from "@/app/components/LoadingLink";
import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";
export const metadata: Metadata = {
  title: "Blindcap",
  description:
    "Build your own blind competition. Invite your group, compare anonymous entries and reveal the winner with Blindcap.",
  icons: { icon: { url: "/brand/blindcap-b.png?v=2", type: "image/png", sizes: "128x128" } },
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="masthead">
          <LoadingLink href="/" aria-label="Blindcap home">
            <Image
              src="/brand/blindcap-wordmark.png"
              alt="Blindcap"
              width={660}
              height={120}
              sizes="(max-width: 600px) 180px, 220px"
              className="brand-logo"
              preload
            />
          </LoadingLink>
          <nav className="public-header-nav" aria-label="Explore BlindCap">
            <a href="/#how-it-works">How it works</a>
            <a href="/#play-a-round">Play a round</a>
            <a href="/#questions">Questions</a>
            <a href="/#sign-in">Sign in</a>
          </nav>
        </header>
        {children}
        <footer>
          BLINDCAP
          <div className="public-footer-content">
            <p>Host blind tastings. Compare your picks. Share the reveal.</p>
            <nav aria-label="BlindCap footer">
              <a href="/#how-it-works">How it works</a>
              <a href="/#play-a-round">Round walkthrough</a>
              <a href="/#questions">Questions</a>
              <a href="/#sign-in">Sign in</a>
              <LoadingLink href="/register">Create a profile</LoadingLink>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
