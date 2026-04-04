import { render } from "preact";
import { useState } from "preact/hooks";
import { GameClient } from "./GameClient.js";
import { MockGame } from "./dev/MockGame.js";

function Root() {
	const params = new URLSearchParams(window.location.search);
	const mode = params.get("mode");

	if (mode === "dev") {
		return <MockGame />;
	}

	return <GameClient />;
}

const app = document.getElementById("app");
if (app) {
	render(<Root />, app);
}
