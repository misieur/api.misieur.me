export interface Env {
	KV: KVNamespace; // binding KV
}

function day(date: Date): string {
	return date.toISOString().split('T')[0];
}

function generateId(length = 12) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const array = new Uint8Array(length);
	crypto.getRandomValues(array);
	return Array.from(array).map(i => chars[i % chars.length]).join('');
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "POST" && url.pathname === "/upload") {
			const maxSize = 5 * 1024 * 1024; // 5 MB
			const contentType = request.headers.get("content-type");

			if (contentType !== "application/json") {
				return new Response("Only JSON allowed", { status: 400 });
			}

			const bodyText = await request.text();

			if (bodyText.length > maxSize) {
				return new Response(`Payload too large (max ${maxSize} bytes)`, { status: 413 });
			}

			try {
				JSON.parse(bodyText);
			} catch {
				return new Response("Invalid JSON", { status: 400 });
			}

			const id = generateId();
			const now = new Date();
			const today = day(now);

			await env.KV.put(id, JSON.stringify({
				content: bodyText,
				created: now.toISOString(),
				last_accessed_date: today
			}), { expirationTtl: 30 * 24 * 60 * 60 });

			return new Response(JSON.stringify({ id }), { headers: { "content-type": "application/json" } });
		}

		if (request.method === "GET" && url.pathname.startsWith("/download/")) {
			const id = url.pathname.split("/").pop()!;
			const dataRaw = await env.KV.get(id);
			if (!dataRaw) return new Response("Not found", { status: 404 });

			const dataObj = JSON.parse(dataRaw);
			const now = new Date();
			const today = day(now);

			if (dataObj.last_accessed_date !== today) {
				dataObj.last_accessed_date = today;
				await env.KV.put(id, JSON.stringify(dataObj), { expirationTtl: 30 * 24 * 60 * 60 });
			}

			return new Response(dataObj.content, { headers: { "content-type": "application/json" } });
		}

		return new Response("https://github.com/misieur/api.misieur.me", { status: 404 });
	},

} satisfies ExportedHandler<Env>;
