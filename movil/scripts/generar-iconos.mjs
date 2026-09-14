// Genera los PNG que @capacitor/assets necesita (ícono y splash) a partir de assets/icono.svg.
import fs from 'node:fs';
import sharp from 'sharp';

const FONDO = '#0f766e';
const svg = fs.readFileSync('assets/icono.svg');

const logo = async (lado) => sharp(svg).resize(lado, lado).png().toBuffer();
const lienzo = (lado, fondo) => sharp({ create: { width: lado, height: lado, channels: 4, background: fondo } });

await lienzo(1024, FONDO).composite([{ input: await logo(720), gravity: 'center' }]).png().toFile('assets/icon-only.png');
await lienzo(1024, { r: 0, g: 0, b: 0, alpha: 0 }).composite([{ input: await logo(560), gravity: 'center' }]).png().toFile('assets/icon-foreground.png');
await lienzo(1024, FONDO).png().toFile('assets/icon-background.png');
await lienzo(2732, FONDO).composite([{ input: await logo(900), gravity: 'center' }]).png().toFile('assets/splash.png');
await lienzo(2732, '#134e4a').composite([{ input: await logo(900), gravity: 'center' }]).png().toFile('assets/splash-dark.png');
console.log('Íconos generados en assets/');
