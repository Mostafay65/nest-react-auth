/**
 * React and React Router report mistakes as console warnings, which are easy
 * to miss in the output of passing tests. Any console warning or error
 * therefore fails the test that caused it, unless the test declared it.
 */
let logged: string[] = [];
let expected: RegExp[] = [];

/** Starts recording console warnings and errors for one test. */
export function watchConsole(): void {
  logged = [];
  expected = [];
  for (const level of ['warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(`console.${level}: ${args.map(String).join(' ')}`);
    });
  }
}

/** Declares a console error the test causes on purpose. The test then fails if it is missing. */
export function expectConsoleError(pattern: RegExp): void {
  expected.push(pattern);
}

/** Every declared error was logged, and nothing else was. */
export function checkConsole(): void {
  const isError = (line: string) => line.startsWith('console.error: ');
  const isDeclared = (line: string) => isError(line) && expected.some((p) => p.test(line));

  for (const pattern of expected) {
    const found = logged.some((line) => isError(line) && pattern.test(line));
    expect(found, `a console error matching ${pattern}`).toBe(true);
  }
  expect(logged.filter((line) => !isDeclared(line))).toEqual([]);
}
