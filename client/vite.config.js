import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'LM Ladies Tailor',
        short_name: 'LM Tailor',
        description: 'Billing & Customer Management System for LM Ladies Tailor',
        theme_color: '#1A0A10',
        background_color: '#F5F0E8',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Background Sync for POST requests (e.g. creating orders)
          {
            urlPattern: ({ url }) => url.pathname.includes('/api/'),
            handler: 'NetworkOnly',
            method: 'POST',
            options: {
              backgroundSync: {
                name: 'api-post-syncQueue',
                options: {
                  maxRetentionTime: 24 * 60 // Retry for up to 24 hours
                }
              }
            }
          },
          // Background Sync for PUT requests (e.g. status updates, payments)
          {
            urlPattern: ({ url }) => url.pathname.includes('/api/'),
            handler: 'NetworkOnly',
            method: 'PUT',
            options: {
              backgroundSync: {
                name: 'api-put-syncQueue',
                options: {
                  maxRetentionTime: 24 * 60 // Retry for up to 24 hours
                }
              }
            }
          }
        ]
      }
    })

  ],
});

