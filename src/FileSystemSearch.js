import fastglob from "fast-glob";
import { TemplatePath } from "@11ty/eleventy-utils";
import debugUtil from "debug";

import { isGlobMatch } from "./Util/GlobMatcher.js";

const debug = debugUtil("Eleventy:FastGlobManager");

class FileSystemSearch {
	constructor() {
		this.inputs = {};
		this.outputs = {};
		this.promises = {};
		this.count = 0;
	}

	getCacheKey(key, globs, options) {
		if (Array.isArray(globs)) {
			globs = globs.sort();
		}
		return key + JSON.stringify(globs) + JSON.stringify(options);
	}

	// returns a promise
	search(key, globs, options = {}) {
		debug("Glob search (%o) searching for: %o", key, globs);

		if (!Array.isArray(globs)) {
			globs = [globs];
		}

		// Strip leading slashes from everything!
		globs = globs.map((entry) => TemplatePath.stripLeadingDotSlash(entry));

		if (options.ignore && Array.isArray(options.ignore)) {
			options.ignore = options.ignore.map((entry) => TemplatePath.stripLeadingDotSlash(entry));
			debug("Glob search (%o) ignoring: %o", key, options.ignore);
		}

		let cacheKey = this.getCacheKey(key, globs, options);

		// Only after the promise has resolved
		if (this.outputs[cacheKey]) {
			return Array.from(this.outputs[cacheKey]);
		}

		if (!this.promises[cacheKey]) {
			this.inputs[cacheKey] = {
				input: globs,
				options,
			};

			this.count++;

			this.promises[cacheKey] = fastglob(
				globs,
				Object.assign(
					{
						caseSensitiveMatch: false, // insensitive
						dot: true,
					},
					options,
				),
			).then((results) => {
				this.outputs[cacheKey] = new Set(
					results.map((entry) => TemplatePath.standardizeFilePath(entry)),
				);
				return Array.from(this.outputs[cacheKey]);
			});
		}

		// may be an unresolved promise
		return this.promises[cacheKey];
	}

	_modify(path, setOperation) {
		path = TemplatePath.stripLeadingDotSlash(path);

		let normalized = TemplatePath.standardizeFilePath(path);

		for (let key in this.inputs) {
			let { input, options } = this.inputs[key];
			if (
				isGlobMatch(path, input, {
					ignore: options.ignore,
				})
			) {
				this.outputs[key][setOperation](normalized);
			}
		}
	}

	add(path) {
		this._modify(path, "add");
	}

	delete(path) {
		this._modify(path, "delete");
	}
}

export default FileSystemSearch;
