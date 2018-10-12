/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

import { DependenciesBlock } from "./DependenciesBlock";
import { ChunkGroup } from "./ChunkGroup";

/** @typedef {import("./ChunkGroup")} ChunkGroup */
/** @typedef {import("./Module")} Module */
/** @typedef {import("./Dependency").DependencyLocation} DependencyLocation */
/** @typedef {import("./util/createHash").Hash} Hash */
/** @typedef {TODO} GroupOptions */

export class AsyncDependenciesBlock extends DependenciesBlock {
	/**
	 * @param {GroupOptions} groupOptions options for the group
	 * @param {Module} module the Module object
	 * @param {DependencyLocation=} loc the line of code
	 * @param {TODO=} request the request
	 */
	constructor(groupOptions, module, loc, request) {
		super();
		if (typeof groupOptions === "string") {
			groupOptions = { name: groupOptions };
		} else if (!groupOptions) {
			groupOptions = { name: undefined };
		}
		this.groupOptions = groupOptions;
		/** @type {ChunkGroup=} */
		this.chunkGroup = undefined;
		this.module = module;
		this.loc = loc;
		this.request = request;
		/** @type {DependenciesBlock} */
	}

	private groupOptions: {
		name: string;
	} = undefined;

	private chunkGroup: ChunkGroup = undefined;

	private module = undefined;

	private loc = undefined;

	private request = undefined;

	public parent = undefined;

	/**
	 * @returns {string} The name of the chunk
	 */
	get chunkName() {
		return this.groupOptions.name;
	}

	/**
	 * @param {string} value The new chunk name
	 * @returns {void}
	 */
	set chunkName(value) {
		this.groupOptions.name = value;
	}

	/**
	 * @returns {never} this throws and should never be called
	 */
	get chunks() {
		throw new Error("Moved to AsyncDependenciesBlock.chunkGroup");
	}

	/**
	 * @param {never} value setter value
	 * @returns {never} this is going to throw therefore we should throw type
	 * assertions by returning never
	 */
	set chunks(value) {
		throw new Error("Moved to AsyncDependenciesBlock.chunkGroup");
	}

	/**
	 * @param {Hash} hash the hash used to track block changes, from "crypto" module
	 * @returns {void}
	 */
	public updateHash(hash): void {
		hash.update(JSON.stringify(this.groupOptions));
		hash.update(
			(this.chunkGroup &&
				this.chunkGroup.chunks
					.map(chunk => {
						return chunk.id !== null ? chunk.id : "";
					})
					.join(",")) ||
				""
		);
		super.updateHash(hash);
	}

	/**
	 * @returns {void}
	 */
	public disconnect(): void {
		this.chunkGroup = undefined;
		super.disconnect();
	}

	/**
	 * @returns {void}
	 */
	public unseal(): void {
		this.chunkGroup = undefined;
		super.unseal();
	}

	/**
	 * @returns {void}
	 */
	public sortItems(): void {
		super.sortItems();
	}
}
