/**
 * Server-Sent Events helpers for dashboard (PRD §16).
 */

export function formatSseDataFrame(payload) {
	return `data: ${JSON.stringify(payload)}\n\n`;
}

export function writeSseHeaders(res) {
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
	});
}
