/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

import fs from "fs";
const path = require("path");
const mkdirp = require("mkdirp");

class NodeOutputFileSystem {
	constructor() {
		this.mkdirp = mkdirp;
		this.mkdir = fs.mkdir.bind(fs);
		this.rmdir = fs.rmdir.bind(fs);
		this.unlink = fs.unlink.bind(fs);
		this.writeFile = fs.writeFile.bind(fs);
		this.join = path.join.bind(path);
	}

	private mkdirp: any;
}

export default NodeOutputFileSystem;
