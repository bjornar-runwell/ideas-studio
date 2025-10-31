
export const metadata = {
  title: "Runwell Ideas Studio",
  description: "Generate social media ideas based on Runwell templates.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
