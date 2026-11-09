import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// PR 미리보기 빌드에서는 서비스워커를 끈다 (캐시 때문에 최신 변경이 안 보이는 문제 방지)
const isPreview = process.env.PREVIEW === '1';

export default defineConfig({
  // 상대 경로: 정식 주소(/make_family_island/)와 미리보기(/make_family_island/pr-preview/pr-N/) 모두 동작
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  define: {
    __BUILD_LABEL__: JSON.stringify(process.env.BUILD_LABEL ?? 'local'),
  },
  plugins: [
    VitePWA({
      disable: isPreview,
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: '가족 섬 만들기',
        short_name: '가족 섬',
        description: '가족이 함께 만드는 우리 섬',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'portrait',
        background_color: '#7ec8e3',
        theme_color: '#7ec8e3',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // 정식 서비스워커가 PR 미리보기 경로를 가로채지 않도록
        navigateFallbackDenylist: [/\/pr-preview\//],
      },
    }),
  ],
});
