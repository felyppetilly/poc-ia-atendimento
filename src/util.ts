/** Utilidades compartilhadas. */

/** Mantém só dígitos de um telefone (remove +, espaços, @s.whatsapp.net, etc.). */
export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Mascara o telefone para logs — mostra DDI/DDD e os 2 últimos dígitos, oculta o miolo (evita PII). */
export function maskPhone(phone: string): string {
  const d = digitsOnly(phone);
  if (d.length <= 6) return '***';
  return `${d.slice(0, 4)}***${d.slice(-2)}`;
}

/**
 * Lista de permitidos (teste/demo). Se `allowed` está vazia → libera todos (comportamento padrão).
 * Caso contrário, só libera se o telefone bater com algum permitido. Compara os ÚLTIMOS 11 dígitos
 * (DDD + número) para ignorar diferença de DDI 55 (ex.: "5511936187567" casa com "11936187567").
 */
export function phoneAllowed(phone: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const tail = (s: string) => digitsOnly(s).slice(-11);
  const t = tail(phone);
  return allowed.some((a) => tail(a) === t);
}
