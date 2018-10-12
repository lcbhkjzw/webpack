import { Dependency } from "./Dependency";
import { Hash } from "crypto";

/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const { RawSource, ReplaceSource } = require("webpack-sources");

/** @typedef {import("./Dependency")} Dependency */
/** @typedef {import("./Dependency").DependencyTemplate} DependencyTemplate */
/** @typedef {import("./RuntimeTemplate")} RuntimeTemplate */
/** @typedef {import("./util/createHash").Hash} Hash */
/** @typedef {(d: Dependency) => boolean} DependencyFilterFunction */
/** @typedef {Map<Function, DependencyTemplate>} DependencyTemplates */

class DependenciesBlockVariable {
	/**
	 * Creates an instance of DependenciesBlockVariable.
	 * @param {string} name name of DependenciesBlockVariable
	 * @param {string} expression expression string
	 * @param {Dependency[]=} dependencies dependencies tied to this varaiable
	 */
	constructor(name: string, expression:string, dependencies: Dependency[]) {
		this.name = name;
		this.expression = expression;
		this.dependencies = dependencies || [];
	}

	public name: string = "";

	public expression: string = "";

	public dependencies: Dependency[] = [];

	/**
	 * @param {Hash} hash hash for instance to update
	 * @returns {void}
	 */
	updateHash(hash: Hash) {
		hash.update(this.name);
		hash.update(this.expression);
		for (const d of this.dependencies) {
			d.updateHash(hash);
		}
	}

	/**
	 * @param {DependencyTemplates} dependencyTemplates Dependency constructors and templates Map.
	 * @param {RuntimeTemplate} runtimeTemplate runtimeTemplate to generate expression souce
	 * @returns {ReplaceSource} returns constructed source for expression via templates
	 */
	expressionSource(dependencyTemplates, runtimeTemplate) {
		const source = new ReplaceSource(new RawSource(this.expression));
		for (const dep of this.dependencies) {
			const template = dependencyTemplates.get(dep.constructor);
			if (!template) {
				throw new Error(`No template for dependency: ${dep.constructor.name}`);
			}
			template.apply(dep, source, runtimeTemplate, dependencyTemplates);
		}
		return source;
	}

	disconnect() {
		for (const d of this.dependencies) {
			d.disconnect();
		}
	}

	hasDependencies(filter: () => boolean) {
		if (filter) {
			return this.dependencies.some(filter);
		}
		return this.dependencies.length > 0;
	}
}

export { DependenciesBlockVariable };
