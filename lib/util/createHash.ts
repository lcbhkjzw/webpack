import {
	Hash,
	Utf8AsciiLatin1Encoding,
	HexBase64Latin1Encoding,
	HexBase64BinaryEncoding
} from "crypto";

/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

/** @typedef {{new(): Hash}} HashConstructor */
/**
 * @typedef {Object} Hash
 * @property {function(string|Buffer, string=): Hash} update
 * @property {function(string): string} digest
 */

const BULK_SIZE = 1000;

/**
 * @implements {Hash}
 */
class BulkUpdateDecorator {
	constructor(hash: Hash) {
		this.hash = hash;
		this.buffer = "";
	}

	private hash: Hash;

	private buffer: string;

	update(data: string | Buffer, inputEncoding: Utf8AsciiLatin1Encoding) {
		if (
			inputEncoding !== undefined ||
			typeof data !== "string" ||
			data.length > BULK_SIZE
		) {
			if (this.buffer.length > 0) {
				this.hash.update(this.buffer);
				this.buffer = "";
			}
			this.hash.update(data, inputEncoding);
		} else {
			this.buffer += data;
			if (this.buffer.length > BULK_SIZE) {
				this.hash.update(this.buffer);
				this.buffer = "";
			}
		}
		return this;
	}

	digest(encoding: HexBase64Latin1Encoding | undefined) {
		if (this.buffer.length > 0) {
			this.hash.update(this.buffer);
		}
		var digestResult =
			encoding == undefined ? this.hash.digest() : this.hash.digest(encoding);
		return typeof digestResult === "string"
			? digestResult
			: digestResult.toString();
	}
}

/* istanbul ignore next */
class DebugHash {
	constructor() {
		this.string = "";
	}

	private string: string;

	update(data: string | Buffer, inputEncoding: Utf8AsciiLatin1Encoding) {
		if (typeof data !== "string") data = data.toString("utf-8");
		this.string += data;
		return this;
	}

	digest(encoding: HexBase64Latin1Encoding) {
		return this.string.replace(/[^a-z0-9]+/gi, m =>
			Buffer.from(m).toString("hex")
		);
	}
}

/**
 * Creates a hash by name or function
 * @param {string | HashConstructor} algorithm the algorithm name or a constructor creating a hash
 * @returns {Hash} the hash
 */
export default (algorithm: any) => {
	if (typeof algorithm === "function") {
		return new BulkUpdateDecorator(new algorithm());
	}
	switch (algorithm) {
		// TODO add non-cryptographic algorithm here
		case "debug":
			return new DebugHash();
		default:
			return new BulkUpdateDecorator(require("crypto").createHash(algorithm));
	}
};
