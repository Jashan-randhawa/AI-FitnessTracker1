import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'react/index': 'src/react/index.ts',
    'pdf/index': 'src/pdf/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: false,
  minify: false,
  splitting: false,
  treeshake: true,
  external: ['react', 'react-dom', 'jspdf', 'jspdf-autotable'],
});
