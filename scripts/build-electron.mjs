import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const raiz = process.cwd();
const paso = (msg) => console.log(`\n=== ${msg} ===`);
const run = (cmd, env = {}) => execSync(cmd, { stdio: 'inherit', shell: true, env: { ...process.env, ...env } });

paso('1/4 Compilando Next (standalone)');
fs.rmSync(path.join(raiz, '.next'), { recursive: true, force: true });
run('npx next build', { ELECTRON_BUILD: '1' });

paso('2/4 Completando carpeta standalone (static + public)');
const standalone = path.join(raiz, '.next', 'standalone');
fs.cpSync(path.join(raiz, '.next', 'static'), path.join(standalone, '.next', 'static'), { recursive: true });
fs.cpSync(path.join(raiz, 'public'), path.join(standalone, 'public'), { recursive: true });

paso('3/4 Generando base de datos plantilla (esquema + semilla)');
const plantilla = path.join(raiz, 'electron', 'plantilla');
const db = path.join(plantilla, 'casa-mama-emma.db');
fs.rmSync(db, { force: true });
const DATABASE_URL = 'file:' + db.replace(/\\/g, '/');
run('npx prisma db push --skip-generate', { DATABASE_URL });
run('npx tsx prisma/seed.ts', { DATABASE_URL });
fs.copyFileSync(path.join(raiz, '.env.example'), path.join(plantilla, 'env.plantilla'));

paso('4/4 Empaquetando ejecutable portable');
run('npx electron-builder --win portable');

console.log(`\nListo: ${path.join(raiz, 'dist-electron')}`);
