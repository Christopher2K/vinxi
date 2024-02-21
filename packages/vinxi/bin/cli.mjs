#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";

import { log } from "../lib/logger.js";

const packageJson = JSON.parse(
	fs.readFileSync(
		fileURLToPath(new URL("../package.json", import.meta.url)),
		"utf-8",
	),
);

const command = defineCommand({
	meta: {
		name: "vinxi",
		version: packageJson.version,
		description: "Vinxi: The JavaScript/TypeScript Server SDK",
	},
	args: {
		config: {
			type: "string",
			description: "Path to config file (default: app.config.js)",
		},
	},
	subCommands: () => ({
		dev: {
			meta: {
				name: "dev",
				version: packageJson.version,
				description: "Start a Vinxi development server",
			},
			args: {
				config: {
					type: "string",
					description: "Path to config file (default: app.config.js)",
				},
				force: {
					type: "boolean",
					description: "Force optimize deps (default: false)",
				},
				devtools: {
					type: "boolean",
					description: "Enable devtools (default: false)",
				},
				port: {
					type: "number",
					description: "Port to listen on (default: 3000)",
				},
				host: {
					type: "boolean",
					description: "Expose to host (default: false)",
				},
				stack: {
					type: "string",
					description: "Stacks",
					alias: "s",
				},
			},
			async run({ args }) {
				const chokidar = await import("chokidar");
				const { loadApp } = await import("../lib/load-app.js");
				const { log, c } = await import("../lib/logger.js");
				log(c.dim(c.yellow(`Vinxi: ${packageJson.version}`)));
				
				let vite = await import("vite/package.json", { assert: { type: "json" }});
				log(c.dim(c.yellow(`Vite: ${vite.default.version}`)));

				
				const configFile = args.config;
				globalThis.MANIFEST = {};
				const app = await loadApp(configFile, args);

				log(c.dim(c.green("starting dev server")));
				let devServer;
				/** @type {import('@vinxi/listhen').Listener} */
				let listener;
				/** @type {import('chokidar').FSWatcher} */
				let watcher;

				function createWatcher() {
					watcher = chokidar.watch(
						["app.config.*", "vite.config.*", configFile].filter(Boolean),
						{
							ignoreInitial: true,
						},
					);
					watcher.on("all", async (ctx, path) => {
						log(c.dim(c.green("change detected in " + path)));
						log(c.dim(c.green("reloading app")));
						const newApp = await loadApp(configFile, args);
						if (!newApp) return;
						restartDevServer(newApp);
					});
				}
				async function createKeypressWatcher() {
					const { emitKeypressEvents } = await import("readline");
					emitKeypressEvents(process.stdin);
					process.stdin.on("keypress", async (_, key) => {
						switch (key.name) {
							case "r":
								restartDevServer(app);
								break;
							case "u":
								listener.showURL();
								break;
							case "q":
								process.exit(0);
							case "h":
								log("Shortcuts:\n");
								log("  r - Restart dev server");
								log("  u - Show server URL");
								log("  h - Show help");
						}
					});
				}
				async function restartDevServer(newApp) {
					const { createDevServer } = await import("../lib/dev-server.js");
					await devServer?.close();
					let preset =
						args.preset ??
						process.env.TARGET ??
						process.env.PRESET ??
						process.env.SERVER_PRESET ??
						process.env.SERVER_TARGET ??
						process.env.NITRO_PRESET ??
						process.env.NITRO_TARGET ??
						(process.versions.bun !== undefined ? "bun" : "node-server");

					devServer = await createDevServer(newApp, {
						force: args.force,
						devtools: args.devtools || Boolean(process.env.DEVTOOLS),
						port: Number(args.port ?? process.env.PORT ?? 3000),
						preset: preset,
					});
					log(c.dim(c.green("restarting dev server")));
					listener = await devServer.listen();
				}

				if (!app) {
					let fsWatcher = (watcher = chokidar.watch(
						["app.config.*", "vite.config.*", configFile].filter(Boolean),
						{
							ignoreInitial: true,
							persistent: true,
						},
					));
					fsWatcher.on("all", async (path) => {
						log(c.dim(c.green("change detected in " + path)));
						log(c.dim(c.green("reloading app")));
						const newApp = await loadApp(configFile, args);
						if (!newApp) return;

						fsWatcher.close();
						createWatcher();
						restartDevServer(newApp);
					});
					return;
				}
				createWatcher();
				await createKeypressWatcher();
				const { createDevServer } = await import("../lib/dev-server.js");
				let preset =
					args.preset ??
					process.env.TARGET ??
					process.env.PRESET ??
					process.env.SERVER_PRESET ??
					process.env.SERVER_TARGET ??
					process.env.NITRO_PRESET ??
					process.env.NITRO_TARGET ??
					(process.versions.bun !== undefined ? "bun" : "node-server");
				devServer = await createDevServer(app, {
					force: args.force,
					port: Number(args.port ?? process.env.PORT ?? 3000),
					devtools: args.devtools || Boolean(process.env.DEVTOOLS),
					preset: preset,
				});
				listener = await devServer.listen();
			},
		},
		build: {
			meta: {
				name: "build",
				version: packageJson.version,
				description: "Build your Vinxi app",
			},
			args: {
				config: {
					type: "string",
					description: "Path to config file (default: app.config.js)",
				},
				stack: {
					type: "string",
					description: "Stacks",
				},
				preset: {
					type: "string",
					description: "Server preset (default: node-server)",
				},
			},
			async run({ args }) {
				const configFile = args.config;
				globalThis.MANIFEST = {};
				const { log, c } = await import("../lib/logger.js");
				log(c.dim(c.yellow(`Vinxi: ${packageJson.version}`)));

				let vite = await import("vite/package.json", { assert: { type: "json" }});
				log(c.dim(c.yellow(`Vite: ${vite.default.version}`)));

				let nitro = await import("nitropack/package.json", { assert: { type: "json" }});
				log(c.dim(c.yellow(`Nitro: ${nitro.default.version}`)));

				const { loadApp } = await import("../lib/load-app.js");
				const app = await loadApp(configFile, args);
				process.env.NODE_ENV = "production";
				const { createBuild } = await import("../lib/build.js");
				await createBuild(app, { preset: args.preset });
			},
		},
		start: {
			meta: {
				name: "start",
				version: packageJson.version,
				description: "Start your built Vinxi app",
			},
			args: {
				config: {
					type: "string",
					description: "Path to config file (default: app.config.js)",
				},
				stack: {
					type: "string",
					description: "Stacks",
				},
				preset: {
					type: "string",
					description: "Server preset (default: node-server)",
				},
				port: {
					type: "number",
					description: "Port to listen on (default: 3000)",
				},
				host: {
					type: "boolean",
					description: "Expose to host (default: false)",
				},
			},
			async run({ args }) {
				process.env.PORT ??= args.port ?? 3000;
				process.env.HOST ??= args.host ?? "0.0.0.0";

				process.env.SERVER_PRESET ??=
					args.preset ??
					process.env.TARGET ??
					process.env.PRESET ??
					process.env.SERVER_PRESET ??
					process.env.SERVER_TARGET ??
					process.env.NITRO_PRESET ??
					process.env.NITRO_TARGET ??
					(process.versions.bun !== undefined ? "bun" : "node-server");

				switch (process.env.SERVER_PRESET) {
					case "node-server":
						await import(
							pathToFileURL(process.cwd() + "/.output/server/index.mjs").href
						);
						break;

					case "bun":
						if (process.versions.bun !== undefined) {
							await import(
								pathToFileURL(process.cwd() + "/.output/server/index.mjs").href
							);
						} else {
							const { $ } = await import("../runtime/sh.js");

							await $`bun run .output/server/index.mjs`;
						}
						break;
					default:
						log(
							"Couldn't run an app built with the ${} preset locally. Deploy the app to a provider that supports it.",
						);
				}
			},
		},
		deploy: {
			meta: {
				name: "deploy",
				version: packageJson.version,
				description: "Deploy your built Vinxi app to any provider",
			},
			args: {
				preset: {
					type: "string",
					description: "Server preset (default: node-server)",
				},
				port: {
					type: "number",
					description: "Port to listen on (default: 3000)",
				},
				host: {
					type: "boolean",
					description: "Expose to host (default: false)",
				},
			},
			async run({ args }) {
				process.env.PORT ??= args.port ?? 3000;
				process.env.HOST ??= args.host ?? "0.0.0.0";

				process.env.SERVER_PRESET ??=
					args.preset ??
					process.env.TARGET ??
					process.env.PRESET ??
					process.env.SERVER_PRESET ??
					process.env.SERVER_TARGET ??
					process.env.NITRO_PRESET ??
					process.env.NITRO_TARGET ??
					"node-server";

				switch (process.env.SERVER_PRESET) {
					case "node-server":
						await import(
							pathToFileURL(process.cwd() + "/.output/server/index.mjs").href
						);
						break;

					case "bun":
						const { $ } = await import("../runtime/sh.js");

						await $`bun run .output/server/index.mjs`;
						break;
					default:
						log(
							"Couldn't run an app built with the ${} preset locally. Deploy the app to a provider that supports it.",
						);
				}
			},
		},
		serve: {
			meta: {
				name: "serve",
				version: packageJson.version,
				description: "Serve a static directory",
			},
			args: {
				port: {
					type: "number",
					description: "Port to listen on (default: 3000)",
				},
				host: {
					type: "boolean",
					description: "Expose to host (default: false)",
				},
				dir: {
					type: "string",
					description: "Directory to serve (default: cwd)",
				},
				base: {
					type: "string",
					description: "Base path",
				},
			},
			async run(context) {
				const { createServer, fromNodeMiddleware, toNodeListener } =
					await import("../runtime/server.js");
				const { listen } = await import("../runtime/listen.js");
				const { isAbsolute, join } = await import("../lib/path.js");
				const { default: serveStatic } = await import("serve-static");

				const server = createServer();
				server.use(
					context.args.base ?? "/",
					fromNodeMiddleware(
						serveStatic(
							context.args.dir
								? isAbsolute(context.args.dir)
									? context.args.dir
									: join(process.cwd(), context.args.dir)
								: process.cwd(),
						),
					),
				);

				await listen(toNodeListener(server));
			},
		},
		run: {
			meta: {
				name: "run",
				version: packageJson.version,
				description: "Run a script in the Vinxi app",
			},

			args: {
				script: {
					type: "positional",
					description: "Script to run",
					required: true,
				},
				port: {
					type: "number",
					description: "Port to listen on (default: 3000)",
				},
			},
			async run(context) {
				const { log, c } = await import("../lib/logger.js");
				const { join } = await import("../lib/path.js");
				const { fetchModule, createServer } = await import("vite");
				const { ViteRuntime, ESModulesRunner } = await import("vite/runtime");
				const server = await createServer({
					resolve: {
						alias: {
							"vinxi/sh": fileURLToPath(
								new URL("../runtime/sh.js", import.meta.url).href,
							),
							"vinxi/http": fileURLToPath(
								new URL("../runtime/http.js", import.meta.url).href,
							),
							"vinxi/listen": fileURLToPath(
								new URL("../runtime/listen.js", import.meta.url).href,
							),
							"vinxi/storage": fileURLToPath(
								new URL("../runtime/storage.js", import.meta.url).href,
							),
							"vinxi/server": fileURLToPath(
								new URL("../runtime/server.js", import.meta.url).href,
							),
							vinxi: fileURLToPath(
								new URL("../lib/index.js", import.meta.url).href,
							),
						},
					},
				});
				const runtime = new ViteRuntime(
					{
						root: process.cwd(),
						fetchModule: (url, importer) => {
							return fetchModule(server, url, importer);
						},
					},
					new ESModulesRunner(),
				);

				const returnValue = await runtime.executeEntrypoint(
					join(process.cwd(), context.args.script),
				);

				let mod = returnValue?.default;

				if (mod?.__is_handler__) {
					const { createServer, toNodeListener } = await import(
						"../runtime/http.js"
					);
					const { listen } = await import("../runtime/listen.js");
					const app = createServer().use(mod);
					await listen(toNodeListener(app));
				} else if (mod && mod.use && mod.handler && mod.stack) {
					const { toNodeListener } = await import("../runtime/http.js");
					const { listen } = await import("../runtime/listen.js");
					await listen(toNodeListener(mod));
				} else if (mod && typeof mod === "function") {
					await mod();
				}
				// else if () {
				// if (typeof mod === "function") {
				// 	await returnValue()
				// 	process.exit(0)
				// } else
				// }

				server.close();

				// process.exit(0)
			},
		},
	}),
});

runMain(command);
