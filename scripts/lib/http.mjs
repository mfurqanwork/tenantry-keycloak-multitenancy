import http from 'node:http';

// Windows does not resolve *.localhost for Node, so talk to 127.0.0.1 and name the site in the Host header.
export function getVia(hostHeader, path, port = Number(process.env.TENANTRY_HTTP_PORT ?? 80)) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'GET', headers: { Host: hostHeader }, timeout: 10_000 },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('timeout', () => req.destroy(new Error(`timeout: ${hostHeader}${path}`)));
    req.on('error', reject);
    req.end();
  });
}
