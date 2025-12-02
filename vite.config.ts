import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  // 👇 这一段是修复国内版白屏的关键！
  define: {
    // OpenAI 库在浏览器里会找 process.env，找不到就报错。
    // 这里我们给它一个空对象，骗过它，让它以为自己在服务器上。
    'process.env': {},
  },
});