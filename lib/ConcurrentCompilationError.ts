/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Maksim Nazarjev @acupofspirt
*/
"use strict";

import WebpackError from "./WebpackError";

export default class ConcurrentCompilationError extends WebpackError {
	constructor() {
		super();

		Error.captureStackTrace(this, this.constructor);
	}

	public name = "ConcurrentCompilationError";

	public message =
		"You ran Webpack twice. Each instance only supports a single concurrent compilation at a time.";
}
