export interface ConcurrencyLimiter {
  run<T>(task: () => Promise<T>): Promise<T>;
}

export function createConcurrencyLimiter(max: number): ConcurrencyLimiter {
  let active = 0;
  const queue: (() => void)[] = [];

  return {
    run: <T,>(task: () => Promise<T>): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const tryRun = () => {
          if (active < max) {
            active++;
            task()
              .then((val) => { active--; resolve(val); processQueue(); })
              .catch((err) => { active--; reject(err); processQueue(); });
          } else {
            queue.push(tryRun);
          }
        };
        const processQueue = () => {
          if (queue.length > 0 && active < max) {
            const next = queue.shift();
            next?.();
          }
        };
        tryRun();
      });
    },
  };
}
