import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.scss";
import styles from "./layout.module.scss";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Dossier Portal",
  description: "Dossier totaaloverzicht portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className={roboto.variable}>
      <body>
        <div className={styles.appShell}>
         
          <main className={styles.main}>{children}</main>
        </div>
      </body>
    </html>
  );
}
