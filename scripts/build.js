import { spawn } from 'child_process';
import fs from 'fs';

const mode = process.argv[2];
const overlayName = process.argv[3];
let needTsc = mode === 'build';

const overlays = fs.readdirSync('overlays', { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

if (mode === 'dev' && !overlayName) {
  console.error('Please provide overlay name');
  console.error('Available overlays:');
  overlays.forEach(name => console.error(`  - ${name}`));
  process.exit(1);
}

const selectedOverlays = mode === 'build' && !overlayName ? overlays : [overlayName];

function buildOverlay(name) {
  return new Promise((resolve, reject) => {
    let command = 'vite build';
    if (needTsc) {
      command = 'tsc && ' + command;
      console.log('First build may take a while due to tsc');
      needTsc = false;
    }
    if (mode === 'dev') command += ' --watch';

    const child = spawn(command, [], {
      env: { ...process.env, VITE_OVERLAY_NAME: name },
      stdio: 'inherit',
      shell: true
    });
    
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Build failed for ${name} with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

(async () => {
  for (const name of selectedOverlays) {
    try {
      console.log(`Building ${name}...`);
      await buildOverlay(name);
      console.log(`${name} built successfully`);
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  }
})();
