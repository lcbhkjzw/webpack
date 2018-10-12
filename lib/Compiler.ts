/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

import Stats from "./Stats";
import Compilation, { CompilationParams } from "./Compilation";
import Entrypoint from "./Entrypoint";
import { WatchOptions } from "./Watching";
import {
	Configuration,
	OutputFileSystem,
	InputFileSystem
} from "./declaration";
import {
	SyncBailHook,
	AsyncSeriesHook,
	SyncHook,
	AsyncParallelHook,
	Tapable
} from "tapable";
import ConcurrentCompilationError from "./ConcurrentCompilationError";
import WebpackError from "./WebpackError";
import ResolverFactory from "./ResolverFactory";
import RequestShortener from "./RequestShortener";

const parseJson = require("json-parse-better-errors");
const asyncLib = require("neo-async");
const path = require("path");
const util = require("util");

import Watching from "./Watching";
import NormalModuleFactory from "./NormalModuleFactory";
import ContextModuleFactory from "./ContextModuleFactory";

const { makePathsRelative } = require("./util/identifier");

/**
 * @typedef {Object} CompilationParams
 * @property {NormalModuleFactory} normalModuleFactory
 * @property {ContextModuleFactory} contextModuleFactory
 * @property {Set<string>} compilationDependencies
 */

/** @typedef {string|string[]} EntryValues */
/** @typedef {Record<string, EntryValues>} EntryOptionValues */

/**
 * @callback EntryOptionValuesFunction
 * @returns {EntryOptionValues | EntryValues} the computed value
 */

/** @typedef {EntryOptionValuesFunction | EntryOptionValues | EntryValues} EntryOptions */

export interface CompilerHooks {
	/** @type {SyncBailHook<Compilation>} */
	shouldEmit: SyncBailHook;
	/** @type {AsyncSeriesHook<Stats>} */
	done: AsyncSeriesHook;
	/** @type {AsyncSeriesHook<>} */
	additionalPass: AsyncSeriesHook;
	/** @type {AsyncSeriesHook<Compiler>} */
	beforeRun: AsyncSeriesHook;
	/** @type {AsyncSeriesHook<Compiler>} */
	run: AsyncSeriesHook;
	/** @type {AsyncSeriesHook<Compilation>} */
	emit: AsyncSeriesHook;
	/** @type {AsyncSeriesHook<Compilation>} */
	afterEmit: AsyncSeriesHook;

	/** @type {SyncHook<Compilation, CompilationParams>} */
	thisCompilation: SyncHook;
	/** @type {SyncHook<Compilation, CompilationParams>} */
	compilation: SyncHook;
	/** @type {SyncHook<NormalModuleFactory>} */
	normalModuleFactory: SyncHook;
	/** @type {SyncHook<ContextModuleFactory>}  */
	contextModuleFactory: SyncHook;

	/** @type {AsyncSeriesHook<CompilationParams>} */
	beforeCompile: AsyncSeriesHook;
	/** @type {SyncHook<CompilationParams>} */
	compile: SyncHook;
	/** @type {AsyncParallelHook<Compilation>} */
	make: AsyncParallelHook;
	/** @type {AsyncSeriesHook<Compilation>} */
	afterCompile: AsyncSeriesHook;

	/** @type {AsyncSeriesHook<Compiler>} */
	watchRun: AsyncSeriesHook;
	/** @type {SyncHook<Error>} */
	failed: SyncHook;
	/** @type {SyncHook<string, string>} */
	invalid: SyncHook;
	/** @type {SyncHook} */
	watchClose: SyncHook;

	// TODO the following hooks are weirdly located here
	// TODO move them for webpack 5
	/** @type {SyncHook} */
	environment: SyncHook;
	/** @type {SyncHook} */
	afterEnvironment: SyncHook;
	/** @type {SyncHook<Compiler>} */
	afterPlugins: SyncHook;
	/** @type {SyncHook<Compiler>} */
	afterResolvers: SyncHook;
	/** @type {SyncBailHook<string, EntryOptions>} */
	entryOption: SyncBailHook;
}

class Compiler extends Tapable {
	constructor(context?: Configuration["context"]) {
		super();

		this._pluginCompat.tap(
			"Compiler",
			(options: { name: string; async: boolean }) => {
				switch (options.name) {
					case "additional-pass":
					case "before-run":
					case "run":
					case "emit":
					case "after-emit":
					case "before-compile":
					case "make":
					case "after-compile":
					case "watch-run":
						options.async = true;
						break;
				}
			}
		);

		/** @type {string=} */
		this.name = undefined;
		/** @type {Compilation=} */
		this.parentCompilation = undefined;
		/** @type {string} */
		this.outputPath = "";

		this.outputFileSystem = null;
		this.inputFileSystem = null;

		/** @type {string|null} */
		this.recordsInputPath = null;
		/** @type {string|null} */
		this.recordsOutputPath = null;
		this.records = {};
		/** @type {Map<string, number>} */
		this.fileTimestamps = new Map();
		/** @type {Map<string, number>} */
		this.contextTimestamps = new Map();
		/** @type {ResolverFactory} */
		this.resolverFactory = new ResolverFactory();

		// // TODO remove in webpack 5
		// this.resolvers = {
		// 	normal: {
		// 		plugins: util.deprecate((hook, fn) => {
		// 			this.resolverFactory.plugin("resolver normal", resolver => {
		// 				resolver.plugin(hook, fn);
		// 			});
		// 		}, "webpack: Using compiler.resolvers.normal is deprecated.\n" + 'Use compiler.resolverFactory.plugin("resolver normal", resolver => {\n  resolver.plugin(/* … */);\n}); instead.'),
		// 		apply: util.deprecate((...args) => {
		// 			this.resolverFactory.plugin("resolver normal", resolver => {
		// 				resolver.apply(...args);
		// 			});
		// 		}, "webpack: Using compiler.resolvers.normal is deprecated.\n" + 'Use compiler.resolverFactory.plugin("resolver normal", resolver => {\n  resolver.apply(/* … */);\n}); instead.')
		// 	},
		// 	loader: {
		// 		plugins: util.deprecate((hook, fn) => {
		// 			this.resolverFactory.plugin("resolver loader", resolver => {
		// 				resolver.plugin(hook, fn);
		// 			});
		// 		}, "webpack: Using compiler.resolvers.loader is deprecated.\n" + 'Use compiler.resolverFactory.plugin("resolver loader", resolver => {\n  resolver.plugin(/* … */);\n}); instead.'),
		// 		apply: util.deprecate((...args) => {
		// 			this.resolverFactory.plugin("resolver loader", resolver => {
		// 				resolver.apply(...args);
		// 			});
		// 		}, "webpack: Using compiler.resolvers.loader is deprecated.\n" + 'Use compiler.resolverFactory.plugin("resolver loader", resolver => {\n  resolver.apply(/* … */);\n}); instead.')
		// 	},
		// 	context: {
		// 		plugins: util.deprecate((hook, fn) => {
		// 			this.resolverFactory.plugin("resolver context", resolver => {
		// 				resolver.plugin(hook, fn);
		// 			});
		// 		}, "webpack: Using compiler.resolvers.context is deprecated.\n" + 'Use compiler.resolverFactory.plugin("resolver context", resolver => {\n  resolver.plugin(/* … */);\n}); instead.'),
		// 		apply: util.deprecate((...args) => {
		// 			this.resolverFactory.plugin("resolver context", resolver => {
		// 				resolver.apply(...args);
		// 			});
		// 		}, "webpack: Using compiler.resolvers.context is deprecated.\n" + 'Use compiler.resolverFactory.plugin("resolver context", resolver => {\n  resolver.apply(/* … */);\n}); instead.')
		// 	}
		// };

		this.options = {};

		this.context = context;

		this.requestShortener = new RequestShortener(context);

		/** @type {boolean} */
		this.running = false;
	}

	public name: string;
	public parentCompilation: Compilation;
	public outputPath: string;
	public outputFileSystem: OutputFileSystem;
	public inputFileSystem: InputFileSystem;
	private recordsInputPath: string;
	private recordsOutputPath: string;
	private records: any;
	private fileTimestamps: Map<string, number>;
	private contextTimestamps: Map<string, number>;
	private resolverFactory: ResolverFactory;
	private options: Configuration;
	private context: string;
	private requestShortener: RequestShortener;
	private running: boolean;

	public hooks: CompilerHooks = {
		/** @type {SyncBailHook<Compilation>} */
		shouldEmit: new SyncBailHook(["compilation"]),
		/** @type {AsyncSeriesHook<Stats>} */
		done: new AsyncSeriesHook(["stats"]),
		/** @type {AsyncSeriesHook<>} */
		additionalPass: new AsyncSeriesHook([]),
		/** @type {AsyncSeriesHook<Compiler>} */
		beforeRun: new AsyncSeriesHook(["compiler"]),
		/** @type {AsyncSeriesHook<Compiler>} */
		run: new AsyncSeriesHook(["compiler"]),
		/** @type {AsyncSeriesHook<Compilation>} */
		emit: new AsyncSeriesHook(["compilation"]),
		/** @type {AsyncSeriesHook<Compilation>} */
		afterEmit: new AsyncSeriesHook(["compilation"]),

		/** @type {SyncHook<Compilation, CompilationParams>} */
		thisCompilation: new SyncHook(["compilation", "params"]),
		/** @type {SyncHook<Compilation, CompilationParams>} */
		compilation: new SyncHook(["compilation", "params"]),
		/** @type {SyncHook<NormalModuleFactory>} */
		normalModuleFactory: new SyncHook(["normalModuleFactory"]),
		/** @type {SyncHook<ContextModuleFactory>}  */
		contextModuleFactory: new SyncHook(["contextModulefactory"]),

		/** @type {AsyncSeriesHook<CompilationParams>} */
		beforeCompile: new AsyncSeriesHook(["params"]),
		/** @type {SyncHook<CompilationParams>} */
		compile: new SyncHook(["params"]),
		/** @type {AsyncParallelHook<Compilation>} */
		make: new AsyncParallelHook(["compilation"]),
		/** @type {AsyncSeriesHook<Compilation>} */
		afterCompile: new AsyncSeriesHook(["compilation"]),

		/** @type {AsyncSeriesHook<Compiler>} */
		watchRun: new AsyncSeriesHook(["compiler"]),
		/** @type {SyncHook<Error>} */
		failed: new SyncHook(["error"]),
		/** @type {SyncHook<string, string>} */
		invalid: new SyncHook(["filename", "changeTime"]),
		/** @type {SyncHook} */
		watchClose: new SyncHook([]),

		// TODO the following hooks are weirdly located here
		// TODO move them for webpack 5
		/** @type {SyncHook} */
		environment: new SyncHook([]),
		/** @type {SyncHook} */
		afterEnvironment: new SyncHook([]),
		/** @type {SyncHook<Compiler>} */
		afterPlugins: new SyncHook(["compiler"]),
		/** @type {SyncHook<Compiler>} */
		afterResolvers: new SyncHook(["compiler"]),
		/** @type {SyncBailHook<string, EntryOptions>} */
		entryOption: new SyncBailHook(["context", "entry"])
	};

	watch(
		watchOptions: WatchOptions,
		handler: (s: ConcurrentCompilationError) => void
	) {
		if (this.running) return handler(new ConcurrentCompilationError());

		this.running = true;
		this.fileTimestamps = new Map();
		this.contextTimestamps = new Map();
		return new Watching(this, watchOptions, handler);
	}

	run(callback: (err: Error, stats?: Stats) => void) {
		if (this.running) return callback(new ConcurrentCompilationError());

		const finalCallback = (err: Error | null, stats?: Stats) => {
			this.running = false;

			if (callback !== undefined) return callback(err, stats);
		};

		const startTime = Date.now();

		this.running = true;

		const onCompiled = (err: Error, compilation: Compilation) => {
			if (err) return finalCallback(err);

			if (this.hooks.shouldEmit.call(compilation) === false) {
				const stats = new Stats(compilation);
				stats.startTime = startTime;
				stats.endTime = Date.now();
				this.hooks.done.callAsync(stats, (err: Error) => {
					if (err) return finalCallback(err);
					return finalCallback(null, stats);
				});
				return;
			}

			this.emitAssets(compilation, (err: Error) => {
				if (err) return finalCallback(err);

				if (compilation.hooks.needAdditionalPass.call()) {
					compilation.needAdditionalPass = true;

					const stats = new Stats(compilation);
					stats.startTime = startTime;
					stats.endTime = Date.now();
					this.hooks.done.callAsync(stats, (err: Error) => {
						if (err) return finalCallback(err);

						this.hooks.additionalPass.callAsync((err: Error) => {
							if (err) return finalCallback(err);
							this.compile(onCompiled);
						});
					});
					return;
				}

				this.emitRecords((err: Error) => {
					if (err) return finalCallback(err);

					const stats = new Stats(compilation);
					stats.startTime = startTime;
					stats.endTime = Date.now();
					this.hooks.done.callAsync(stats, (err: Error) => {
						if (err) return finalCallback(err);
						return finalCallback(null, stats);
					});
				});
			});
		};

		this.hooks.beforeRun.callAsync(this, (err: Error) => {
			if (err) return finalCallback(err);

			this.hooks.run.callAsync(this, (err: Error) => {
				if (err) return finalCallback(err);

				this.readRecords((err: Error) => {
					if (err) return finalCallback(err);

					this.compile(onCompiled);
				});
			});
		});
	}

	runAsChild(
		callback: (err: Error, entries?: [], compilation?: Compilation) => void
	) {
		this.compile((err: Error, compilation: Compilation) => {
			if (err) return callback(err);

			this.parentCompilation.children.push(compilation);
			for (const name of Object.keys(compilation.assets)) {
				this.parentCompilation.assets[name] = compilation.assets[name];
			}

			const entries = Array.from(
				compilation.entrypoints.values(),
				(ep: Entrypoint) => ep.chunks
			).reduce((array, chunks) => {
				return array.concat(chunks);
			}, []);

			return callback(null, entries, compilation);
		});
	}

	purgeInputFileSystem() {
		if (this.inputFileSystem && this.inputFileSystem.purge) {
			this.inputFileSystem.purge();
		}
	}

	emitAssets(compilation: Compilation, callback: (err?: Error) => void) {
		let outputPath: string;

		const emitFiles = (err: Error) => {
			if (err) return callback(err);

			asyncLib.forEach(
				compilation.assets,
				(source: any, file: string, callback: (err?: Error) => void) => {
					let targetFile = file;
					const queryStringIdx = targetFile.indexOf("?");
					if (queryStringIdx >= 0) {
						targetFile = targetFile.substr(0, queryStringIdx);
					}

					const writeOut = (err?: Error) => {
						if (err) return callback(err);
						const targetPath = this.outputFileSystem.join(
							outputPath,
							targetFile
						);
						if (source.existsAt === targetPath) {
							source.emitted = false;
							return callback();
						}
						let content = source.source();

						if (!Buffer.isBuffer(content)) {
							content = Buffer.from(content, "utf8");
						}

						source.existsAt = targetPath;
						source.emitted = true;
						this.outputFileSystem.writeFile(targetPath, content, callback);
					};

					if (targetFile.match(/\/|\\/)) {
						const dir = path.dirname(targetFile);
						this.outputFileSystem.mkdirp(
							this.outputFileSystem.join(outputPath, dir),
							writeOut
						);
					} else {
						writeOut();
					}
				},
				(err: Error) => {
					if (err) return callback(err);

					this.hooks.afterEmit.callAsync(compilation, (err: Error) => {
						if (err) return callback(err);

						return callback();
					});
				}
			);
		};

		this.hooks.emit.callAsync(compilation, (err: Error) => {
			if (err) return callback(err);
			outputPath = compilation.getPath(this.outputPath);
			this.outputFileSystem.mkdirp(outputPath, emitFiles);
		});
	}

	emitRecords(callback: (err?: Error) => void) {
		if (!this.recordsOutputPath) return callback();
		const idx1 = this.recordsOutputPath.lastIndexOf("/");
		const idx2 = this.recordsOutputPath.lastIndexOf("\\");
		let recordsOutputPathDirectory = null;
		if (idx1 > idx2) {
			recordsOutputPathDirectory = this.recordsOutputPath.substr(0, idx1);
		} else if (idx1 < idx2) {
			recordsOutputPathDirectory = this.recordsOutputPath.substr(0, idx2);
		}

		const writeFile = () => {
			this.outputFileSystem.writeFile(
				this.recordsOutputPath,
				JSON.stringify(this.records, undefined, 2),
				callback
			);
		};

		if (!recordsOutputPathDirectory) {
			return writeFile();
		}
		this.outputFileSystem.mkdirp(
			recordsOutputPathDirectory,
			(err: WebpackError) => {
				if (err) return callback(err);
				writeFile();
			}
		);
	}

	readRecords(callback: (err?: Error) => void) {
		if (!this.recordsInputPath) {
			this.records = {};
			return callback();
		}
		this.inputFileSystem.stat(this.recordsInputPath, (err: Error) => {
			// It doesn't exist
			// We can ignore this.
			if (err) return callback();

			this.inputFileSystem.readFile(
				this.recordsInputPath,
				(err: Error, content: Buffer) => {
					if (err) return callback(err);

					try {
						this.records = parseJson(content.toString("utf-8"));
					} catch (e) {
						e.message = "Cannot parse records: " + e.message;
						return callback(e);
					}

					return callback();
				}
			);
		});
	}

	createChildCompiler(
		compilation: Compilation,
		compilerName: string,
		compilerIndex: number,
		outputOptions: Configuration["outputOptions"],
		plugins: Tapable.Plugin
	) {
		const childCompiler = new Compiler(this.context);
		if (Array.isArray(plugins)) {
			for (const plugin of plugins) {
				plugin.apply(childCompiler);
			}
		}
		for (const name in this.hooks) {
			if (
				![
					"make",
					"compile",
					"emit",
					"afterEmit",
					"invalid",
					"done",
					"thisCompilation"
				].includes(name)
			) {
				if (childCompiler.hooks[name as keyof CompilerHooks]) {
					childCompiler.hooks[name as keyof CompilerHooks].taps = this.hooks[
						name as keyof CompilerHooks
					].taps.slice();
				}
			}
		}
		childCompiler.name = compilerName;
		childCompiler.outputPath = this.outputPath;
		childCompiler.inputFileSystem = this.inputFileSystem;
		childCompiler.outputFileSystem = null;
		childCompiler.resolverFactory = this.resolverFactory;
		childCompiler.fileTimestamps = this.fileTimestamps;
		childCompiler.contextTimestamps = this.contextTimestamps;

		const relativeCompilerName = makePathsRelative(this.context, compilerName);
		if (!this.records[relativeCompilerName]) {
			this.records[relativeCompilerName] = [];
		}
		if (this.records[relativeCompilerName][compilerIndex]) {
			childCompiler.records = this.records[relativeCompilerName][compilerIndex];
		} else {
			this.records[relativeCompilerName].push((childCompiler.records = {}));
		}

		childCompiler.options = Object.create(this.options);
		childCompiler.options.output = Object.create(childCompiler.options.output);
		for (const name in outputOptions) {
			childCompiler.options.output[name] = outputOptions[name];
		}
		childCompiler.parentCompilation = compilation;

		compilation.hooks.childCompiler.call(
			childCompiler,
			compilerName,
			compilerIndex
		);

		return childCompiler;
	}

	isChild() {
		return !!this.parentCompilation;
	}

	createCompilation() {
		return new Compilation(this);
	}

	newCompilation(params: CompilationParams) {
		const compilation = this.createCompilation();
		compilation.fileTimestamps = this.fileTimestamps;
		compilation.contextTimestamps = this.contextTimestamps;
		compilation.name = this.name;
		compilation.records = this.records;
		compilation.compilationDependencies = params.compilationDependencies;
		this.hooks.thisCompilation.call(compilation, params);
		this.hooks.compilation.call(compilation, params);
		return compilation;
	}

	createNormalModuleFactory() {
		const normalModuleFactory = new NormalModuleFactory(
			this.options.context,
			this.resolverFactory,
			this.options.module || {}
		);
		this.hooks.normalModuleFactory.call(normalModuleFactory);
		return normalModuleFactory;
	}

	createContextModuleFactory() {
		const contextModuleFactory = new ContextModuleFactory(this.resolverFactory);
		this.hooks.contextModuleFactory.call(contextModuleFactory);
		return contextModuleFactory;
	}

	newCompilationParams() {
		const params = {
			normalModuleFactory: this.createNormalModuleFactory(),
			contextModuleFactory: this.createContextModuleFactory(),
			compilationDependencies: new Set()
		};
		return params;
	}

	compile(callback: (err: Error, compilation?: Compilation) => void) {
		const params = this.newCompilationParams();
		this.hooks.beforeCompile.callAsync(params, (err: Error) => {
			if (err) return callback(err);

			this.hooks.compile.call(params);

			const compilation = this.newCompilation(params);

			this.hooks.make.callAsync(compilation, (err: Error) => {
				if (err) return callback(err);

				compilation.finish();

				compilation.seal((err: Error) => {
					if (err) return callback(err);

					this.hooks.afterCompile.callAsync(compilation, (err: Error) => {
						if (err) return callback(err);

						return callback(null, compilation);
					});
				});
			});
		});
	}
}

export default Compiler;
