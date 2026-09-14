/** Obligaciones tributarias: días restantes, alertas y recurrencia (misma lógica que el PC). */
export type Recurrencia = 'MENSUAL' | 'SEMESTRAL' | 'ANUAL' | 'UNICA';
export type Nivel = 'vencido' | 'urgente' | 'proximo' | 'ok';

export interface ObligacionBase {
  nombre: string;
  tipo: string;
  entidad: string;
  recurrencia: Recurrencia;
  proximoVencimiento: string; // YYYY-MM-DD
  notas: string;
  activa: boolean;
  ultimoPago: string | null;
}

const RUC = '1805034426001';
// Tabla SRI: día de vencimiento mensual según el noveno dígito del RUC.
const DIA_POR_NOVENO_DIGITO: Record<string, number> = { '1': 10, '2': 12, '3': 14, '4': 16, '5': 18, '6': 20, '7': 22, '8': 24, '9': 26, '0': 28 };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const deIso = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));

export function diasRestantes(fecha: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((deIso(fecha).getTime() - hoy.getTime()) / 86_400_000);
}

export function nivelAlerta(dias: number): Nivel {
  if (dias < 0) return 'vencido';
  if (dias <= 7) return 'urgente';
  if (dias <= 30) return 'proximo';
  return 'ok';
}

export function siguienteVencimiento(fecha: string, recurrencia: Recurrencia): string {
  const f = deIso(fecha);
  if (recurrencia === 'MENSUAL') f.setMonth(f.getMonth() + 1);
  else if (recurrencia === 'SEMESTRAL') f.setMonth(f.getMonth() + 6);
  else if (recurrencia === 'ANUAL') f.setFullYear(f.getFullYear() + 1);
  return iso(f);
}

/** Próxima fecha futura (o de hoy) a partir de un mes/día y una recurrencia. */
function proxima(mes: number, dia: number, recurrencia: Recurrencia): string {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let f = new Date(hoy.getFullYear(), mes - 1, dia);
  while (f < hoy) f = deIso(siguienteVencimiento(iso(f), recurrencia));
  return iso(f);
}

export function textoDias(dias: number): string {
  if (dias < 0) return `Vencida hace ${Math.abs(dias)} día(s)`;
  if (dias === 0) return 'Vence HOY';
  return `Faltan ${dias} día(s)`;
}

export function obligacionesIniciales(): ObligacionBase[] {
  const dia = DIA_POR_NOVENO_DIGITO[RUC.charAt(8)] ?? 12;
  const hoy = new Date();
  return [
    { nombre: 'Declaración IVA (Formulario 104)', tipo: 'IMPUESTO', entidad: 'SRI', recurrencia: 'MENSUAL', proximoVencimiento: proxima(hoy.getMonth() + 1, dia, 'MENSUAL'), notas: `Vence el día ${dia} (noveno dígito del RUC = ${RUC.charAt(8)}).`, activa: true, ultimoPago: null },
    { nombre: 'Patente municipal', tipo: 'MUNICIPAL', entidad: 'GAD Municipal Baños de Agua Santa', recurrencia: 'ANUAL', proximoVencimiento: proxima(3, 31, 'ANUAL'), notas: 'Pago anual de la patente en el municipio de Baños.', activa: true, ultimoPago: null },
    { nombre: 'Permiso de funcionamiento (Bomberos)', tipo: 'PERMISO', entidad: 'Cuerpo de Bomberos Baños', recurrencia: 'ANUAL', proximoVencimiento: proxima(12, 31, 'ANUAL'), notas: '', activa: true, ultimoPago: null },
    { nombre: 'Impuesto a la Renta (Formulario 102A)', tipo: 'IMPUESTO', entidad: 'SRI', recurrencia: 'ANUAL', proximoVencimiento: proxima(3, 28, 'ANUAL'), notas: '', activa: true, ultimoPago: null },
    { nombre: 'Tasa de turismo / LUAF', tipo: 'MUNICIPAL', entidad: 'GAD Municipal Baños de Agua Santa', recurrencia: 'ANUAL', proximoVencimiento: proxima(6, 30, 'ANUAL'), notas: 'Licencia Única Anual de Funcionamiento para alojamiento turístico.', activa: true, ultimoPago: null },
  ];
}
