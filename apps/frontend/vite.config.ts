import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  // Build mode: 'full' | 'provider' | 'recipient'
  const buildMode = env.VITE_BUILD_MODE || process.env.VITE_BUILD_MODE || 'full'
  
  console.log(`🔧 Building in "${buildMode}" mode`)

  return {
    plugins: [react()],
    define: {
      // Make build mode available at runtime
      'import.meta.env.VITE_BUILD_MODE': JSON.stringify(buildMode),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      // Output directory based on build mode
      outDir: buildMode === 'full' ? 'dist' : `dist-${buildMode}`,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Optimize chunking based on build mode
            if (id.includes('node_modules')) {
              if (id.includes('@tanstack/react-query')) {
                return 'vendor-query'
              }
              if (id.includes('react-router')) {
                return 'vendor-router'
              }
              if (id.includes('@radix-ui')) {
                return 'vendor-ui'
              }
              return 'vendor'
            }
          },
        },
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  }
})
