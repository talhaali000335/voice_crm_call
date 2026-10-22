import "./globals.css";
import Nav from "../components/Nav.js";

export const metadata = {
  title: "Voice CRM Agent",
  description: "A small CRM with a voice agent powered by RAG, CAG and KAG.",
};

// The layout wraps every page: the navigation bar on top, the page content below.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
