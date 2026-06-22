import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  vite: () => ({
    build: {
      rollupOptions: {
        external: ['/pdf.mjs']
      }
    }
  }),
  manifest: {
    name: 'EtymoRead',
    version: '1.0.0',
    description: 'Read web pages and PDFs with instant offline etymology highlights and secure on-device Chrome AI word deconstructions.',
    permissions: ['storage', 'declarativeNetRequest', 'webNavigation'],
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      {
        resources: ['pdf.worker.min.mjs', 'pdf.mjs', 'pdf-viewer.html', 'affixes.json', 'wordRoots.json', 'etymo-dictionary.json', 'cmaps/*'],
        matches: ['<all_urls>']
      }
    ],
    action: {
      default_title: 'EtymoRead Settings',
      default_icon: 'icon-32.png'
    },
    icons: {
      '16': 'icon-16.png',
      '32': 'icon-32.png',
      '48': 'icon-48.png',
      '128': 'icon-128.png'
    }
  }
});
