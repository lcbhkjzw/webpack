/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
"use strict";

import { DependenciesBlockVariable } from "./DependenciesBlockVariable";
import { AsyncDependenciesBlock } from "./AsyncDependenciesBlock";
import { Dependency } from "./Dependency";

class DependenciesBlock {
	constructor() {}

	private dependencies: Dependency[] = [];
	private blocks: DependenciesBlock[] = [];
	private variables: DependenciesBlockVariable[] = [];

	public addBlock(block: AsyncDependenciesBlock): void {
		this.blocks.push(block);
		block.parent = this;
	}

	/**
	 * @param {string} name name of dependency
	 * @param {string} expression expression string for variable
	 * @param {Dependency[]} dependencies dependency instances tied to variable
	 * @returns {void}
	 */
	public addVariable(
		name: string,
		expression: string,
		dependencies: Dependency[]
	): void {
		for (let v of this.variables) {
			if (v.name === name && v.expression === expression) {
				return;
			}
		}
		this.variables.push(
			new DependenciesBlockVariable(name, expression, dependencies)
		);
	}

	/**
	 * @param {Dependency} dependency dependency being tied to block.
	 * This is an "edge" pointing to another "node" on module graph.
	 * @returns {void}
	 */
	public addDependency(dependency: Dependency): void {
		this.dependencies.push(dependency);
	}

	/**
	 * @param {Dependency} dependency dependency being removed
	 * @returns {void}
	 */
	public removeDependency(dependency: Dependency) {
		const idx = this.dependencies.indexOf(dependency);
		if (idx >= 0) {
			this.dependencies.splice(idx, 1);
		}
	}

	/**
	 * @param {Hash} hash the hash used to track dependencies
	 * @returns {void}
	 */
	public updateHash(hash): void {
		for (const dep of this.dependencies) dep.updateHash(hash);
		for (const block of this.blocks) block.updateHash(hash);
		for (const variable of this.variables) variable.updateHash(hash);
	}

	public disconnect() {
		for (const dep of this.dependencies) dep.disconnect();
		for (const block of this.blocks) block.disconnect();
		for (const variable of this.variables) variable.disconnect();
	}

	public unseal() {
		for (const block of this.blocks) block.unseal();
	}

	/**
	 * @param {DependencyFilterFunction} filter filter function for dependencies, gets passed all dependency ties from current instance
	 * @returns {boolean} returns boolean for filter
	 */
	public hasDependencies(filter) {
		if (filter) {
			for (const dep of this.dependencies) {
				if (filter(dep)) return true;
			}
		} else {
			if (this.dependencies.length > 0) {
				return true;
			}
		}

		for (const block of this.blocks) {
			if (block.hasDependencies(filter)) return true;
		}
		for (const variable of this.variables) {
			if (variable.hasDependencies(filter)) return true;
		}
		return false;
	}

	public sortItems() {
		for (const block of this.blocks) block.sortItems();
	}
}

export { DependenciesBlock };
