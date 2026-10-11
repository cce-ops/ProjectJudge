import type { JsonClient } from './gemini';

/**
 * Encadena varios clientes (uno por modelo) con memoria del último que funcionó.
 *
 * Cada llamada empieza en el modelo que funcionó la última vez; si falla de forma
 * persistente (el cliente interno ya reintentó con espera creciente), avanza al
 * siguiente modelo de la cadena. Así un modelo saturado no bloquea la evaluación
 * y no se machaca al modelo caído en cada llamada.
 */
export function createFallbackJsonClient(clients: JsonClient[]): JsonClient {
  if (clients.length === 0) {
    throw new Error('La cadena de modelos no puede estar vacía.');
  }
  let index = 0;
  return {
    generateJson: async <T,>(request: Parameters<JsonClient['generateJson']>[0]): Promise<T> => {
      let lastError: unknown = null;
      for (let i = index; i < clients.length; i++) {
        try {
          const result = await clients[i].generateJson<T>(request);
          index = i;
          return result;
        } catch (e) {
          lastError = e;
        }
      }
      throw lastError instanceof Error ? lastError : new Error('Todos los modelos fallaron.');
    },
  };
}
