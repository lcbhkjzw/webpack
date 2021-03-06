"use strict";

const compareLocations = require("../lib/compareLocations");
const createPosition = overrides => {
	return Object.assign(
		{
			line: 10,
			column: 5
		},
		overrides
	);
};

const createLocation = (start, end, index) => {
	return {
		start: createPosition(start),
		end: createPosition(end),
		index: index || 3
	};
};

describe("compareLocations", () => {
	describe("string location comparison", () => {
		it("returns -1 when the first string comes before the second string", () => {
			expect(compareLocations("alpha", "beta")).toBe(-1);
		});

		it("returns 1 when the first string comes after the second string", () => {
			expect(compareLocations("beta", "alpha")).toBe(1);
		});

		it("returns 0 when the first string is the same as the second string", () => {
			expect(compareLocations("charlie", "charlie")).toBe(0);
		});
	});

	describe("object location comparison", () => {
		let a, b;

		describe("location line number", () => {
			beforeEach(() => {
				a = createLocation({
					line: 10
				});
				b = createLocation({
					line: 20
				});
			});

			it("returns -1 when the first location line number comes before the second location line number", () => {
				expect(compareLocations(a, b)).toBe(-1);
			});

			it("returns 1 when the first location line number comes after the second location line number", () => {
				expect(compareLocations(b, a)).toBe(1);
			});
		});

		describe("location column number", () => {
			beforeEach(() => {
				a = createLocation({
					column: 10
				});
				b = createLocation({
					column: 20
				});
			});

			it("returns -1 when the first location column number comes before the second location column number", () => {
				expect(compareLocations(a, b)).toBe(-1);
			});

			it("returns 1 when the first location column number comes after the second location column number", () => {
				expect(compareLocations(b, a)).toBe(1);
			});
		});

		describe("location index number", () => {
			beforeEach(() => {
				a = createLocation(null, null, 10);
				b = createLocation(null, null, 20);
			});

			it("returns -1 when the first location index number comes before the second location index number", () => {
				expect(compareLocations(a, b)).toBe(-1);
			});

			it("returns 1 when the first location index number comes after the second location index number", () => {
				expect(compareLocations(b, a)).toBe(1);
			});
		});

		describe("same location", () => {
			beforeEach(() => {
				a = createLocation();
				b = createLocation();
			});

			it("returns 0", () => {
				expect(compareLocations(a, b)).toBe(0);
			});
		});
	});

	describe("string and object location comparison", () => {
		it("returns 1 when the first parameter is a string and the second parameter is an object", () => {
			expect(compareLocations("alpha", createLocation())).toBe(1);
		});

		it("returns -1 when the first parameter is an object and the second parameter is a string", () => {
			expect(compareLocations(createLocation(), "alpha")).toBe(-1);
		});
	});

	describe("unknown location type comparison", () => {
		it("returns 0 when the first parameter is an object and the second parameter is a number", () => {
			expect(compareLocations(createLocation(), 123)).toBe(0);
		});

		it("returns undefined when the first parameter is a number and the second parameter is an object", () => {
			expect(compareLocations(123, createLocation())).toBe(undefined);
		});

		it("returns 0 when the first parameter is a string and the second parameter is a number", () => {
			expect(compareLocations("alpha", 123)).toBe(0);
		});

		it("returns undefined when the first parameter is a number and the second parameter is a string", () => {
			expect(compareLocations(123, "alpha")).toBe(undefined);
		});

		it("returns undefined when both the first parameter and the second parameter is a number", () => {
			expect(compareLocations(123, 456)).toBe(undefined);
		});
	});
});
