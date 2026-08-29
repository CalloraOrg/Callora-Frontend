function toBase64(obj: object): string {
  const json = JSON.stringify(obj);
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(json)));
  }
  return Buffer.from(json).toString("base64");
}

function parseHost(baseUrl: string): string[] {
  return baseUrl
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(".");
}

function parseProtocol(baseUrl: string): string {
  return baseUrl.startsWith("https") ? "https" : "http";
}

/**
 * Build a Postman Collection v2.1 JSON object for a single endpoint.
 */
export function buildPostmanCollection(
  method: string,
  path: string,
  name: string,
  baseUrl: string,
): object {
  const fullUrl = `${baseUrl}${path}`;
  return {
    info: {
      name,
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: [
      {
        name,
        request: {
          method: method.toUpperCase(),
          header: [],
          url: {
            raw: fullUrl,
            protocol: parseProtocol(baseUrl),
            host: parseHost(baseUrl),
            path: path.split("/").filter(Boolean),
          },
        },
      },
    ],
  };
}

/**
 * Generate a Postman import URL that can be pasted into a browser to
 * open the endpoint in the Postman desktop app.
 *
 * The returned URL is a "Run in Postman" button link.
 */
export function getPostmanImportUrl(
  method: string,
  path: string,
  name: string,
  baseUrl: string,
): string {
  const collection = buildPostmanCollection(method, path, name, baseUrl);
  const encoded = toBase64(collection);
  return `https://www.postman.com/collection/import?collection=${encoded}`;
}

/**
 * Build an Insomnia Request resource JSON for a single endpoint.
 */
export function buildInsomniaRequest(
  method: string,
  path: string,
  name: string,
  baseUrl: string,
): object {
  return {
    _type: "request",
    _id: `__REQ_${name.replace(/\s+/g, "_")}__`,
    parentId: "__WORKSPACE_ID__",
    name,
    method: method.toUpperCase(),
    url: `${baseUrl}${path}`,
    parameters: [],
    headers: [],
    authentication: {},
    body: {},
  };
}

/**
 * Generate an Insomnia import URL that can be pasted into a browser to
 * open the endpoint in the Insomnia desktop app.
 *
 * The returned URL uses the `insomnia://` scheme.
 */
export function getInsomniaImportUrl(
  method: string,
  path: string,
  name: string,
  baseUrl: string,
): string {
  const resource = buildInsomniaRequest(method, path, name, baseUrl);
  const encoded = toBase64(resource);
  return `insomnia://import/data?data=${encoded}`;
}

/**
 * Copy a string to the system clipboard.
 * Returns true if the copy succeeded, false otherwise.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
    return true;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
