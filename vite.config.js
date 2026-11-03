import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base: works on GitHub Pages under any repo name.
export default defineConfig({ plugins: [react()], base: './' });
