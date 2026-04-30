import * as matchers from "@testing-library/jest-dom/matchers";
import { afterEach, beforeEach, expect } from "vitest";

import { setCachedConfigForTests } from "@/lib/config";

expect.extend(matchers);

beforeEach(() => {
	setCachedConfigForTests({
		url: "http://127.0.0.1:3001",
		token: "test-token",
		mode: "local",
	});
});

afterEach(() => {
	setCachedConfigForTests(null);
});
