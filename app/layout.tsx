import "@/app/ui/global.css";
import { inter, lusitana } from "./ui/fonts";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="h-20 bg-green-950 text-white">Nav</div>
        {children}
      </body>
    </html>
  );
}
