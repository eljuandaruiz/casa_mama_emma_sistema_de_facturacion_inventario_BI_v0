import { useLiveQuery } from 'dexie-react-hooks';
import { db, hoyISO } from '../lib/db';
import { fmtUsd } from '../lib/dinero';

export function Inicio() {
  const mesActual = hoyISO().slice(0, 7);
  const ingresos = useLiveQuery(() => db.ingresos.filter((i) => i.fecha.startsWith(mesActual)).toArray(), [mesActual]) ?? [];
  const gastos = useLiveQuery(() => db.gastos.filter((g) => g.fecha.startsWith(mesActual)).toArray(), [mesActual]) ?? [];
  const mantenimientos = useLiveQuery(() => db.mantenimientos.filter((m) => m.fecha.startsWith(mesActual)).toArray(), [mesActual]) ?? [];

  const totalIngresos = ingresos.reduce((a, i) => a + i.monto, 0);
  const totalGastos = gastos.reduce((a, g) => a + g.monto, 0) + mantenimientos.reduce((a, m) => a + m.costoMateriales + m.costoManoObra, 0);
  const resultado = totalIngresos - totalGastos;

  const movimientos = [
    ...ingresos.map((i) => ({ tipo: 'ingreso' as const, fecha: i.fecha, texto: `Ingreso · ${i.canal}`, monto: i.monto, creadoEn: i.creadoEn })),
    ...gastos.map((g) => ({ tipo: 'gasto' as const, fecha: g.fecha, texto: g.descripcion || g.categoria, monto: g.monto, creadoEn: g.creadoEn })),
  ]
    .sort((a, b) => b.creadoEn - a.creadoEn)
    .slice(0, 8);

  return (
    <div>
      <section className="tarjeta">
        <p className="etiqueta">Este mes</p>
        <div className="fila">
          <div>
            <p className="etiqueta">Ingresos</p>
            <p className="monto-ingreso" style={{ fontSize: 18 }}>{fmtUsd(totalIngresos)}</p>
          </div>
          <div>
            <p className="etiqueta">Gastos</p>
            <p className="monto-gasto" style={{ fontSize: 18 }}>{fmtUsd(totalGastos)}</p>
          </div>
          <div>
            <p className="etiqueta">Resultado</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: resultado >= 0 ? '#0f766e' : '#dc2626' }}>{fmtUsd(resultado)}</p>
          </div>
        </div>
      </section>

      <section className="tarjeta">
        <p className="etiqueta">Últimos movimientos</p>
        {movimientos.length === 0 && <p style={{ fontSize: 13, color: '#78716c' }}>Todavía no has registrado nada. Ve a la pestaña Gastos para empezar.</p>}
        <ul className="lista">
          {movimientos.map((m, idx) => (
            <li key={idx} className="item">
              <div>
                <p className="item-titulo">{m.texto}</p>
                <p className="item-detalle">{m.fecha}</p>
              </div>
              <span className={m.tipo === 'ingreso' ? 'monto-ingreso' : 'monto-gasto'}>
                {m.tipo === 'ingreso' ? '+' : '-'}{fmtUsd(m.monto)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
