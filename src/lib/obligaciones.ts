/** Utilidades de obligaciones tributarias (días restantes, alertas, recurrencia). */

/** Días entre hoy (00:00) y una fecha (positivo = futuro, negativo = vencido). */
export function diasRestantes(fecha: Date): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha);
  f.setHours(0, 0, 0, 0);
  return Math.round((f.getTime() - hoy.getTime()) / 86_400_000);
}

/** Nivel de alerta: se avisa desde 1 mes (30 días) antes. */
export function nivelAlerta(dias: number): 'vencido' | 'urgente' | 'proximo' | 'ok' {
  if (dias < 0) return 'vencido';
  if (dias <= 7) return 'urgente';
  if (dias <= 30) return 'proximo'; // aviso desde un mes antes
  return 'ok';
}

/** Avanza una fecha de vencimiento según la recurrencia (al marcar cumplida). */
export function siguienteVencimiento(fecha: Date, recurrencia: string): Date {
  const f = new Date(fecha);
  switch (recurrencia) {
    case 'MENSUAL':
      f.setMonth(f.getMonth() + 1);
      break;
    case 'SEMESTRAL':
      f.setMonth(f.getMonth() + 6);
      break;
    case 'ANUAL':
      f.setFullYear(f.getFullYear() + 1);
      break;
    default: // UNICA: no se repite
      break;
  }
  return f;
}
