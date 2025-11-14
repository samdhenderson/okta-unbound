/**
 * build.js - Build Script for Okta Unbound Extension
 *
 * Uses esbuild for fast bundling with minimal configuration.
 * Bundles all JS modules into files compatible with Chrome Extension Manifest V3.
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

// Build configuration
const buildOptions = {
  bundle: true,
  format: 'iife',
  target: 'es2020',
  sourcemap: isWatch ? 'inline' : false,
  minify: !isWatch,
  logLevel: 'info'
};

async function build() {
  try {
    console.log('🔨 Building Okta Unbound Extension...\n');

    // Ensure dist directory exists
    if (!fs.existsSync('dist')) {
      fs.mkdirSync('dist', { recursive: true });
    }

    // Build content script
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['src/content-script.js'],
      outfile: 'dist/content-script.js'
    });
    console.log('✅ Built content-script.js');

    // Build background worker
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['src/background-worker.js'],
      outfile: 'dist/background-worker.js'
    });
    console.log('✅ Built background-worker.js');

    // Build popup script
    await esbuild.build({
      ...buildOptions,
      entryPoints: ['src/ui/popup/popup.js'],
      outfile: 'dist/popup.js'
    });
    console.log('✅ Built popup.js');

    // Copy static files
    copyStatic();

    console.log('\n✨ Build complete!');

    if (isWatch) {
      console.log('👀 Watching for changes...');
    }

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

/**
 * Copy static files to dist/
 */
function copyStatic() {
  const staticFiles = [
    { src: 'manifest.json', dest: 'dist/manifest.json' },
    { src: 'src/ui/popup/popup.html', dest: 'dist/popup.html' },
    { src: 'src/ui/popup/popup.css', dest: 'dist/popup.css' },
    { src: 'assets/icons', dest: 'dist/icons', isDir: true }
  ];

  staticFiles.forEach(({ src, dest, isDir }) => {
    if (isDir) {
      if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true });
        console.log(`📁 Copied ${src}/ → ${dest}/`);
      }
    } else {
      if (fs.existsSync(src)) {
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(src, dest);
        console.log(`📄 Copied ${src} → ${dest}`);
      }
    }
  });
}

// Run build
if (isWatch) {
  // Watch mode - rebuild on file changes
  const chokidar = require('chokidar');

  build().then(() => {
    const watcher = chokidar.watch(['src/**/*', 'manifest.json'], {
      ignor ed: ['node_modules', 'dist']
    });

    watcher.on('change', (path) => {
      console.log(`\n📝 File changed: ${path}`);
      build();
    });
  });
} else {
  // Single build
  build();
}
