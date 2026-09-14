import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, hoyISO } from '../lib/db';
import { fmtUsd } from '../lib/dinero';
import { generarPdfReporte } from '../lib/pdfReporte';
import { generarExportacionIA } from '../lib/exportarIA';
import { compartirArchivo } from '../lib/compartir';
import { montoRegistro } from '../lib/modulos';

const inicioDeMes = () => hoyISO().slice(0, 8) + '01';

export function Reportes() {
  const [desde, setDesde] = useState(inicioDeMes());
  const [hasta, setHasta] = useState(hoyISO());
  const [ocupado, setOcupado] = useState(false);

  const ingresos = useLiveQuery(() => db.ingresos.filter((i) => i.fecha >= desde && i.fecha <= hasta).toArray(), [desde, hasta]) ?? [];
  const gastos = useLiveQuery(() => db.gastos.filter((g) => g.fecha >= desde && g.fecha <= hasta).toArray(), [desde, hasta]) ?? [];
  const mantenimientos = useLiveQuery(() => db.mantenimientos.filter((m) => m.fecha >= desde && m.fecha <= hasta).toArray(), [desde, hasta]) ?? [];

  const registros = useLiveQuery(() => db.registros.toArray()) ?? [];
  const enRango = (modulo: string) => registros.filter((r) => r.modulo === modulo && String(r.datos.fecha ?? '') >= desde && String(r.datos.fecha ?? '') <= hasta);
  const totalCompras = enRango('compras').reduce((a, r) => a + montoRegistro('compras', r.datos), 0);
  const totalMejoras = enRango('mejoras').reduce((a, r) => a + montoRegistro('mejoras', r.datos), 0);

  const totalIngresos = ingresos.reduce((a, i) => a + i.monto, 0);
  const totalGastos = gastos.reduce((a, g) => a + g.monto, 0);
  const totalMantenimiento = mantenimientos.reduce((a, m) => a + m.costoMateriales + m.costoManoObra, 0);
  const totalEgresos = totalGastos + totalMantenimiento + totalCompras;
  const resultado = totalIngresos - totalEgresos;
  const maxBarra = Math.max(totalIngresos, totalEgresos, 1);

  const descargarPdf = async () => {
    setOcupado(true);
    try {
      const blob = await generarPdfReporte(desde, hasta, gastos, ingresos, mantenimientos, { compras: totalCompras, mejoras: totalMejoras });
      await compartirArchivo(`reporte-${desde}-a-${hasta}.pdf`, blob, 'Reporte financiero');
    } finally {
      setOcupado(false);
    }
  };

  const exportarIA = async () => {
    setOcupado(true);
    try {
      const md = await generarExportacionIA();
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      await compartirArchivo(`analisis-ia-${hoyISO()}.md`, blob, 'Análisis financiero para IA');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div>
      <section className="tarjeta">
        <p className="etiqueta">Rango</p>
        <div className="fila">
          <div>
            <label className="etiqueta">Desde</label>
            <input type="date" className="campo" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <label className="etiqueta">Hasta</label>
            <input type="date" className="campo" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="tarjeta">
        <p className="etiqueta">Resumen del rango</p>
        <div className="fila" style={{ marginBottom: 10 }}>
          <div>
            <p className="etiqueta">Ingresos</p>
            <p className="monto-ingreso" style={{ fontSize: 17 }}>{fmtUsd(totalIngresos)}</p>
            <div className="barra" style={{ width: `${(totalIngresos / maxBarra) * 100}%`, background: '#0f766e' }} />
          </div>
          <div>
            <p className="etiqueta">Egresos</p>
            <p className="monto-gasto" style={{ fontSize: 17 }}>{fmtUsd(totalEgresos)}</p>
            <div className="barra" style={{ width: `${(totalEgresos / maxBarra) * 100}%`, background: '#dc2626' }} />
          </div>
        </div>
        <p className="etiqueta">Resultado</p>
        <p style={{ fontSize: 20, fontWeight: 700, color: resultado >= 0 ? '#0f766e' : '#dc2626' }}>{fmtUsd(resultado)}</p>
        <p className="item-detalle">Gastos: {fmtUsd(totalGastos)} · Mantenimiento: {fmtUsd(totalMantenimiento)} · Compras: {fmtUsd(totalCompras)} · {ingresos.length} ingreso(s)</p>
        <p className="item-detalle">Mejoras (inversión, no entra en el resultado): {fmtUsd(totalMejoras)}</p>
      </section>

      <section className="tarjeta">
        <p className="etiqueta">Compartir</p>
        <div className="fila">
          <button className="btn btn-secundario btn-bloque" disabled={ocupado} onClick={descargarPdf}>PDF del reporte</button>
          <button className="btn btn-primario btn-bloque" disabled={ocupado} onClick={exportarIA}>Exportar para IA</button>
        </div>
        <p className="item-detalle" style={{ marginTop: 8 }}>
          "Exportar para IA" genera un archivo de texto que puedes pegar en ChatGPT, Claude o Gemini para que te dé un análisis del negocio.
        </p>
      </section>
    </div>
  );
}
