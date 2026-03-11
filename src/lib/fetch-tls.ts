import https from "https";
import fs from "fs";

// Custom fetch wrapper that adds macOS system root certificates.
// Solves UNABLE_TO_GET_ISSUER_CERT_LOCALLY on macOS Node.js.

let cachedAgent: https.Agent | null = null;

function getAgent(): https.Agent {
  if (cachedAgent) return cachedAgent;
  const caPath = "/tmp/ca-certs.pem";
  const options: https.AgentOptions = { keepAlive: true };
  try {
    if (fs.existsSync(caPath)) {
      options.ca = fs.readFileSync(caPath);
    }
  } catch {}
  cachedAgent = new https.Agent(options);
  return cachedAgent;
}

/**
 * HTTPS request using Node.js https module with custom CA certificates.
 * Use this instead of global `fetch` when you hit UNABLE_TO_GET_ISSUER_CERT_LOCALLY.
 */
export function tlsFetch(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
  } = {},
): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<unknown>; arrayBuffer: () => Promise<ArrayBuffer>; headers: Map<string, string> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOpts: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: options.method || "GET",
      headers: options.headers || {},
      agent: getAgent(),
    };

    if (options.body) {
      const bodyBuffer = Buffer.from(options.body, "utf-8");
      (reqOpts.headers as Record<string, string>)["Content-Length"] = String(bodyBuffer.byteLength);
    }

    const req = https.request(reqOpts, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const status = res.statusCode || 0;
        const responseHeaders = new Map<string, string>();
        for (const [key, val] of Object.entries(res.headers)) {
          if (val) responseHeaders.set(key, Array.isArray(val) ? val[0] : val);
        }
        resolve({
          ok: status >= 200 && status < 300,
          status,
          text: async () => buffer.toString("utf-8"),
          json: async () => JSON.parse(buffer.toString("utf-8")),
          arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
          headers: responseHeaders,
        });
      });
    });

    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
    req.setTimeout(options.timeout || 300000);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}
