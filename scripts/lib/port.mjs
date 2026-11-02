import net from 'node:net';

// Only "address in use" means busy. Linux refuses unprivileged binds below 1024 (EACCES),
// yet Docker can still publish those ports, so any other error counts as free.
export function isPortFree(port, createServer = () => net.createServer()) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', (err) => resolve(err.code !== 'EADDRINUSE'));
    server.listen(port, '0.0.0.0', () => server.close(() => resolve(true)));
  });
}

// The ports the stack publishes, by the variable that sets each one, filtered to those in use.
export async function busyPorts(ports, isFree = isPortFree) {
  const busy = [];
  for (const [name, port] of Object.entries(ports)) {
    if (!(await isFree(port))) busy.push({ name, port });
  }
  return busy;
}
