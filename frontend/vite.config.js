import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icons/icon-192x192.png', 'icons/icon-512x512.png'],
            manifest: {
                name: 'FACKIN在庫管理',
                short_name: 'FACKIN在庫',
                description: 'スマホで簡単に在庫・資材管理ができるPWA',
                theme_color: '#1E293B',
                background_color: '#0F172A',
                display: 'standalone',
                icons: [
                    {
                        src: 'icons/icon-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'icons/icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            }
        })
    ]
});
