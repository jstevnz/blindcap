import type { Metadata } from "next";
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
            <span className="seal">
              B<span>CAP</span>
            </span>
            <span>BLINDCAP</span>
          </a>
        </header>
        {children}
        <footer>BLINDCAP</footer>
      </body>
    </html>
  );
}
