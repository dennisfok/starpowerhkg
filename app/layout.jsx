export const metadata = {
  title: 'StarPower HKG',
  description: '截圖入單系統',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-HK">
      <body>{children}</body>
    </html>
  );
}
