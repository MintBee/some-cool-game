import { createServer } from "node:http";
import { SignalingServer } from "./SignalingServer.js";

const PORT = Number(process.env.PORT) || 3001;

const httpServer = createServer((req, res) => {
	if (req.url === "/health") {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ status: "ok" }));
		return;
	}
	res.writeHead(404);
	res.end();
});

const _signaling = new SignalingServer(httpServer);

httpServer.listen(PORT, () => {
	console.log(`Signaling server listening on :${PORT}`);
});
