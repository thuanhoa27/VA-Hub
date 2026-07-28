import './globals.css';
import './engine.css'; // CSS goc cua dashboard (sinh tu shell.html)

export const metadata = {
  title: 'OnPoint · Brand Hunt & Tier Analyzer',
  description: 'Brand qualification & tier analysis cho nganh Health tai Viet Nam',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
