import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Blindcap",
  description:
    "Two to sixteen bottles. One Yorktown Tumbler. A blind tasting among friends.",
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
            <span>
              BLINDCAP<small>TRUST YOUR TASTE</small>
            </span>
          </a>
          <span className="header-note">GOOD COMPANY. GREAT SPIRITS.</span>
        </header>
        {children}
        <footer>
          BLINDCAP <span>Enjoy the evening. Sip responsibly.</span>
        </footer>
      </body>
    </html>
  );
}
