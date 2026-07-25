import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono, Cinzel, Poppins } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

// Utilisée uniquement dans /mon-espace (portail bénéficiaire) via la classe .font-cinzel,
// n'affecte aucune autre partie de l'app.
const cinzel = Cinzel({
  variable: "--font-cinzel-google",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Thème "Sombre doré" (dashboard bénéficiaire v3) uniquement — remplace Cinzel dans
// .font-cinzel quand ce thème est actif (data-theme="sombre_dore"), cf. globals.css.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "PsychoÉduc Manager",
  description: "Chaque parcours d'autonomie mérite d'être vu dans son entier — logiciel de suivi socio-éducatif.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${fraunces.variable} ${inter.variable} ${plexMono.variable} ${cinzel.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-base">{children}</body>
    </html>
  );
}
