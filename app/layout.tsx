import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Urovo Projects",
  description: "Local technical support project ticket management.",
  icons: {
    icon: "/patrick.png",
    apple: "/patrick.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
