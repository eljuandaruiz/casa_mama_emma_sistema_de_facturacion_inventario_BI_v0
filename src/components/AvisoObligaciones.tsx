import Link from 'next/link';
import { prisma } from '@/lib/db';
import { diasRestantes, nivelAlerta } from '@/lib/obligaciones';

/**
 * Widget del dashboard: muestra las obligaciones tributarias que vencen dentro
 * de un mes (o ya vencidas) con la cuenta regresiva. Server Component.
 */
export async function AvisoObligaciones() {
  const obligaciones = await prisma.obligacion.findMany({
    where: { activa: true },
    orderBy: { proximoVencimiento: 'asc' },
  });

  // Regla: el aviso aparece SOLO desde 30 días antes del vencimiento (e incluye
  // las ya vencidas y aún no pagadas). Al marcar "pagado", el endpoint avanza
  // proximoVencimiento al próximo ciclo (mensual/anual) => dias vuelve a ser >30
  // y el aviso desaparece automáticamente hasta 30 días antes del siguiente.
  const conAlerta = obligaciones
    .map((o) => ({ ...o, dias: diasRestantes(o.proximoVencimiento) }))
    .filter((o) => o.dias <= 30)
    .sort((a, b) => a.dias - b.dias);

  if (conAlerta.length === 0) return null;

  const estilo = (n: ReturnType<typeof nivelAlerta>) =>
    n === 'vencido'
      ? 'border-coral-500 bg-coral-50 text-coral-700'
      : n === 'urgente'
        ? 'border-amber-500 bg-amber-50 text-amber-700'
        : 'border-sri-blue/40 bg-sri-light/50 text-sri-blue';

  return (
    <section className="space-y-2">
      {conAlerta.map((o) => {
        const nivel = nivelAlerta(o.dias);
        const texto =
          o.dias < 0
            ? `Vencida hace ${Math.abs(o.dias)} día(s)`
            : o.dias === 0
              ? 'Vence HOY'
              : `Faltan ${o.dias} día(s)`;
        return (
          <Link
            key={o.id}
            href="/obligaciones"
            className={`tarjeta flex items-center justify-between border-l-4 p-3 ${estilo(nivel)}`}
          >
            <div>
              <p className="text-sm font-semibold">📌 {o.nombre}</p>
              <p className="text-xs opacity-80">
                {o.entidad ? `${o.entidad} · ` : ''}
                Vence el {new Date(o.proximoVencimiento).toLocaleDateString('es-EC')}
              </p>
            </div>
            <span className="shrink-0 text-sm font-bold">{texto}</span>
          </Link>
        );
      })}
    </section>
  );
}
