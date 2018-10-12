/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Jarid Margolin @jaridmargolin
*/
"use strict";

class WebpackError extends Error {
	/**
	 * Creates an instance of WebpackError.
	 * @param {string=} message error message
	 */
	constructor(message?: string) {
		super(message);

		this.details = undefined;
		this.missing = undefined;
		this.origin = undefined;
		this.dependencies = undefined;
		this.module = undefined;

		Error.captureStackTrace(this, this.constructor);
	}

	protected details: string;
	protected missing: string;
	protected origin: string;
	protected dependencies: string;
	protected module: string;

	inspect() {
		return this.stack + (this.details ? `\n${this.details}` : "");
	}
}

export default WebpackError;
