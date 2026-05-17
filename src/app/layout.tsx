import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '馭浪物流 OMS',
  description: '馭浪物流營運管理系統',
}

const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('theme')  || 'dark';
    var a = localStorage.getItem('accent') || 'green';
    var f = localStorage.getItem('font')   || 'noto';
    var m = localStorage.getItem('mono')   || 'dm';
    var r = document.documentElement;
    r.setAttribute('data-theme', t);
    r.setAttribute('data-accent', a);
    r.setAttribute('data-font', f);
    r.setAttribute('data-mono', m);
  } catch (e) {
    var r = document.documentElement;
    r.setAttribute('data-theme', 'dark');
    r.setAttribute('data-accent', 'green');
    r.setAttribute('data-font', 'noto');
    r.setAttribute('data-mono', 'dm');
  }
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=Noto+Serif+TC:wght@400;500;700&family=LXGW+WenKai+TC:wght@400;700&family=DM+Mono:wght@400;500&family=JetBrains+Mono:wght@400;500;700&family=Fira+Code:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;700&family=Roboto+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
