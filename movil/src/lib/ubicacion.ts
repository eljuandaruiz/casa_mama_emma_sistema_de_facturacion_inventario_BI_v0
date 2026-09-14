import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface Coordenadas {
  lat: number;
  lng: number;
}

/** Ubicación actual del teléfono (pide permiso de ubicación la primera vez). */
export async function ubicacionActual(): Promise<Coordenadas> {
  if (Capacitor.isNativePlatform()) {
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  }
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), reject, { enableHighAccuracy: true, timeout: 15000 }),
  );
}

export const enlaceMapa = (c: Coordenadas) => `https://maps.google.com/?q=${c.lat.toFixed(6)},${c.lng.toFixed(6)}`;

/** Normaliza un teléfono ecuatoriano a formato internacional para WhatsApp. */
export function telefonoInternacional(tel: string): string {
  const digitos = tel.replace(/\D/g, '');
  if (digitos.startsWith('593')) return digitos;
  if (digitos.startsWith('0')) return `593${digitos.slice(1)}`;
  return digitos;
}
