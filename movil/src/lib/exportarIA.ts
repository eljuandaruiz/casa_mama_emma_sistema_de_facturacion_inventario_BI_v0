import { db } from './db';
import { feriadosDelAnio, temporadaDe } from './feriados';
import { fmtUsd } from './dinero';
import { montoRegistro } from './modulos';

function tabla(cabecera: string[], filas: (string | number)[][]): string {
  if (!filas.length) return '_Sin datos._\n';
  const linea = (c: (string | number)[]) => `| ${c.join(' | ')} |`;
  return [linea(cabecera), linea(cabecera.map(() => '---')), ...filas.map(linea)].join('\n') + '\n';
}

/** Genera el Markdown para pegar en un chat de IA, leyendo solo de IndexedDB (sin servidor). */
export async function generarExportacionIA(): Promise<string> {
  const [gastos, ingresos, mantenimientos, registros] = await Promise.all([
    db.gastos.toArray(),
    db.ingresos.toArray(),
    db.mantenimientos.toArray(),
    db.registros.toArray(),
  ]);

  const porMes = new Map<string, { ingresos: number; gastos: number; mantenimiento: number; compras: number; mejoras: number; noches: number }>();
  const registrar = (mes: string) => {
    if (!porMes.has(mes)) porMes.set(mes, { ingresos: 0, gastos: 0, mantenimiento: 0, compras: 0, mejoras: 0, noches: 0 });
    return porMes.get(mes)!;
  };
  for (const r of registros) {
    const fecha = String(r.datos.fecha ?? '');
    if (fecha.length < 7) continue;
    if (r.modulo === 'compras') registrar(fecha.slice(0, 7)).compras += montoRegistro('compras', r.datos);
    if (r.modulo === 'mejoras') registrar(fecha.slice(0, 7)).mejoras += montoRegistro('mejoras', r.datos);
  }
  for (const i of ingresos) {
    const r = registrar(i.fecha.slice(0, 7));
    r.ingresos += i.monto;
    r.noches += i.noches;
  }
  for (const g of gastos) registrar(g.fecha.slice(0, 7)).gastos += g.monto;
  for (const m of mantenimientos) registrar(m.fecha.slice(0, 7)).mantenimiento += m.costoMateriales + m.costoManoObra;

  const porTemporada = new Map<string, { noches: number; ingreso: number }>();
  for (const i of ingresos) {
    const t = temporadaDe(i.fecha).etiqueta;
    const acc = porTemporada.get(t) ?? { noches: 0, ingreso: 0 };
    acc.noches += i.noches;
    acc.ingreso += i.monto;
    porTemporada.set(t, acc);
  }

  const hoy = new Date();
  const meses = [...porMes.keys()].sort();
  const s: string[] = [];
  s.push('# Casa Mamá Emma - Datos financieros para análisis con IA (registro rápido del teléfono)');
  s.push('');
  s.push(`Generado: ${hoy.toISOString().slice(0, 10)}. Moneda: USD.`);
  s.push('');
  s.push('> Actúa como analista financiero para un hospedaje pequeño en Baños de Agua Santa, Ecuador. Con los datos de abajo (registrados a mano desde el teléfono, sin facturación formal) entrega: 1) diagnóstico de ingresos vs gastos; 2) qué meses y temporadas rinden más; 3) gastos que se pueden recortar; 4) tres acciones concretas para esta semana. Si un dato falta, dilo en vez de suponerlo.');
  s.push('');
  s.push('## Nota importante');
  s.push('Estos datos son un registro manual y rápido (no incluyen las facturas electrónicas formales, que se manejan en el sistema principal de la PC). Úsalo como una vista complementaria, no como la contabilidad oficial.');
  s.push('');
  s.push('## Mes a mes');
  s.push('');
  s.push(tabla(
    ['Mes', 'Ingresos', 'Gastos', 'Mantenimiento', 'Compras', 'Resultado operativo', 'Mejoras (inversión)', 'Noches registradas'],
    meses.map((mes) => {
      const r = porMes.get(mes)!;
      return [mes, fmtUsd(r.ingresos), fmtUsd(r.gastos), fmtUsd(r.mantenimiento), fmtUsd(r.compras), fmtUsd(r.ingresos - r.gastos - r.mantenimiento - r.compras), fmtUsd(r.mejoras), r.noches];
    }),
  ));
  s.push('## Por temporada (según fecha del ingreso)');
  s.push('');
  s.push(tabla(
    ['Temporada', 'Noches', 'Ingreso', 'Ingreso por noche'],
    [...porTemporada.entries()].sort((a, b) => b[1].ingreso - a[1].ingreso).map(([t, v]) => [t, v.noches, fmtUsd(v.ingreso), v.noches ? fmtUsd(v.ingreso / v.noches) : 'n/d']),
  ));
  s.push('## Próximos feriados (para planear precios)');
  s.push('');
  const anioActual = hoy.getFullYear();
  for (const anio of [anioActual, anioActual + 1]) {
    s.push(`- ${anio}: ${feriadosDelAnio(anio).map((f) => `${f.fecha} ${f.nombre}`).join('; ')}`);
  }
  s.push('');
  s.push('## Gastos registrados');
  s.push('');
  s.push(tabla(['Fecha', 'Categoría', 'Descripción', 'Monto'], gastos.map((g) => [g.fecha, g.categoria, g.descripcion, fmtUsd(g.monto)])));
  s.push('## Mantenimiento registrado');
  s.push('');
  s.push(tabla(['Fecha', 'Área', 'Trabajo', 'Costo total'], mantenimientos.map((m) => [m.fecha, m.area, m.titulo, fmtUsd(m.costoMateriales + m.costoManoObra)])));
  return s.join('\n');
}
