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
