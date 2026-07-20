import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { round2 } from '@/lib/money';
import {
  GENEROS,
  ESTADOS_RELACION,
  SEGMENTOS_VIAJERO,
  rangoEdad,
  etiquetaDe,
} from '@/lib/bi/catalogos';

export const dynamic = 'force-dynamic';

interface Grupo {
  clave: string;
  etiqueta: string;
  perfiles: number; // nº de facturas con ese atributo
  ingresos: number; // subtotal sin impuestos acumulado
  noches: number;
}

function acumular(
  mapa: Map<string, Grupo>,
  clave: string,
  etiqueta: string,
  ingresos: number,
  noches: number,
) {
  const g = mapa.get(clave) ?? { clave, etiqueta, perfiles: 0, ingresos: 0, noches: 0 };
  g.perfiles += 1;
  g.ingresos += ingresos;
  g.noches += noches;
  mapa.set(clave, g);
}

const ordenar = (m: Map<string, Grupo>) =>
  [...m.values()].map((g) => ({ ...g, ingresos: round2(g.ingresos) })).sort((a, b) => b.ingresos - a.ingresos);

/**
 * GET /api/bi/analitica?anio=2026 — distribuciones demográficas cruzadas
 * con ingresos y noches. Solo facturas no anuladas con perfil registrado.
 */
export async function GET(req: Request) {
  const anio = Number(new URL(req.url).searchParams.get('anio') ?? new Date().getFullYear());
  const desde = new Date(anio, 0, 1);
  const hasta = new Date(anio + 1, 0, 1);

  const facturas = await prisma.factura.findMany({
    where: { fechaEmision: { gte: desde, lt: hasta }, anulada: false, perfil: { isNot: null } },
    include: { perfil: true },
  });

  const porGenero = new Map<string, Grupo>();
  const porEdad = new Map<string, Grupo>();
  const porSegmento = new Map<string, Grupo>();
  const porNacionalidad = new Map<string, Grupo>();
  const porRelacion = new Map<string, Grupo>();

  let ingresosConPerfil = 0;

  for (const f of facturas) {
    const p = f.perfil!;
    const ing = f.subtotalSinImpuestos;
    ingresosConPerfil += ing;

    acumular(porGenero, p.genero ?? 'SIN_DATO', etiquetaDe(GENEROS, p.genero), ing, f.noches);
    acumular(porEdad, rangoEdad(p.edad), rangoEdad(p.edad), ing, f.noches);
    acumular(
      porSegmento,
      p.segmentoViajero ?? 'SIN_DATO',
      etiquetaDe(SEGMENTOS_VIAJERO, p.segmentoViajero),
      ing,
      f.noches,
    );
    acumular(
      porNacionalidad,
      (p.nacionalidad ?? 'Sin dato').trim() || 'Sin dato',
      (p.nacionalidad ?? 'Sin dato').trim() || 'Sin dato',
      ing,
      f.noches,
    );
    acumular(
      porRelacion,
      p.estadoRelacion ?? 'SIN_DATO',
      etiquetaDe(ESTADOS_RELACION, p.estadoRelacion),
      ing,
      f.noches,
    );
  }

  // Cobertura: cuántas facturas del año tienen perfil demográfico.
  const totalFacturas = await prisma.factura.count({
    where: { fechaEmision: { gte: desde, lt: hasta }, anulada: false },
  });

  return NextResponse.json({
    anio,
    resumen: {
      perfilesRegistrados: facturas.length,
      totalFacturas,
      cobertura: totalFacturas > 0 ? Math.round((facturas.length / totalFacturas) * 100) : 0,
      ingresosConPerfil: round2(ingresosConPerfil),
    },
    porGenero: ordenar(porGenero),
    porEdad: [...porEdad.values()].map((g) => ({ ...g, ingresos: round2(g.ingresos) })),
    porSegmento: ordenar(porSegmento),
    porNacionalidad: ordenar(porNacionalidad).slice(0, 12),
    porRelacion: ordenar(porRelacion),
  });
}
