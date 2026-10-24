import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'AI MCQ Solver - Smart Answer Assistant',
    description: 'Highlight any MCQ question on any webpage to instantly get the correct answer and explanation with AI',
    permissions: ['storage', 'activeTab', 'tabs', 'scripting'],
    host_permissions: [
      'https://generativelanguage.googleapis.com/*',
      '<all_urls>'
    ],
  },
});