import { spawn } from 'node:child_process';

const commands = [
  { name: 'backend', args: ['run', 'dev', '-w', 'backend'] },
  { name: 'frontend', args: ['run', 'dev', '-w', 'frontend'] }
];

const children = commands.map(({ name, args }) => {
  const child = spawn('npm', args, { stdio: 'pipe', shell: process.platform === 'win32' });
  child.stdout.on('data', (data) => process.stdout.write(`[${name}] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[${name}] ${data}`));
  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown(code);
    }
  });
  return child;
});

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
