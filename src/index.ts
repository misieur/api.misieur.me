export interface Env {
	BUCKET: R2Bucket;
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
			const today = now.toISOString().split("T")[0];

			await env.BUCKET.put(id, bodyText, {
				httpMetadata: { contentType },
				customMetadata: {
					created: now.toISOString(),
					last_accessed_date: today
				}
			});

			return new Response(JSON.stringify({ id }), { headers: { "content-type": "application/json" } });
		}

		if (request.method === "GET" && url.pathname.startsWith("/download/")) {
			const id = url.pathname.split("/").pop()!;
			const obj = await env.BUCKET.get(id, {});
			if (!obj) {
				return new Response("Not found", { status: 404 });
			}

			const resp = new Response(obj.body, {
				headers: {
					"content-type": obj.httpMetadata?.contentType ?? "application/octet-stream"
				}
			});

			const metadata = obj.customMetadata;
			const now = new Date();
			const today = day(now);

			const lastAccessed = metadata?.last_accessed_date;
			if (lastAccessed !== today) {
				const data = await obj.arrayBuffer();
				await env.BUCKET.put(id, data, {
					httpMetadata: {
						contentType: obj.httpMetadata?.contentType
					},
					customMetadata: {
						created: metadata?.created ?? new Date().toISOString(),
						last_accessed_date: today
					}
				});
			}

			return resp;
		}

		return new Response("https://github.com/misieur/api.misieur.me", { status: 404 });
	},

	async scheduled(_controller: unknown, env: Env): Promise<void> {
		const list = await env.BUCKET.list({ include: ["customMetadata"] });
		const now = Date.now();
		const threshold = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

		for await (const item of list.objects) {
			const meta = item.customMetadata;
			let dateToCheck: number | null = null;

			if (meta?.last_accessed_date) {
				dateToCheck = Date.parse(meta.last_accessed_date + "T00:00:00.000Z");
			} else if (meta?.created) {
				dateToCheck = Date.parse(meta.created);
			}

			if (dateToCheck !== null) {
				if (now - dateToCheck > threshold) {
					await env.BUCKET.delete(item.key);
				}
			} else {
				await env.BUCKET.delete(item.key); // Delete it if no date is found
			}
		}
	}
} satisfies ExportedHandler<Env>;
