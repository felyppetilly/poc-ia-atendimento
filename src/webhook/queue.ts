import { maskPhone } from '../util.js';

/**
 * Fila/lock em memória por telefone (instância única na POC — sem Redis).
 * Mensagens do MESMO phone são processadas em série (encadeamento de promises);
 * phones diferentes correm em paralelo. Evita corrida de estado da conversa.
 */
const chains = new Map<string, Promise<void>>();

export function enqueue(phone: string, task: () => Promise<void>): void {
  const prev = chains.get(phone) ?? Promise.resolve();
  const next = prev.then(task).catch((err) => {
    console.error(`[queue] erro processando ${maskPhone(phone)}:`, err);
  });
  chains.set(phone, next);
  // Limpa a entrada quando esta task termina e ainda é a mais recente da cadeia.
  next.finally(() => {
    if (chains.get(phone) === next) chains.delete(phone);
  });
}
