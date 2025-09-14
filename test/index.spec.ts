import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

describe('Test', () => {
	it('404 responds with the github repo', async () => {
		const response = await SELF.fetch('https://api.misieur.me/');
		expect(await response.text()).toMatchInlineSnapshot(`"https://github.com/misieur/api.misieur.me"`);
	});
});
