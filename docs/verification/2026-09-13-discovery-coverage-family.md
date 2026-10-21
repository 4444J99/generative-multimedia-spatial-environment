# Discovery coverage family: preserve the merged suite and recover unique cases

## Intention and verdict

Members: merged #102 (current default suite), closed #103 with living branch `limen/gen-organvm-a-mavs-olevm-test-coverage-0620-4c61` at `c4a2ca3dbf8b`, and open #104 on `limen/gen-organvm-a-mavs-olevm-test-coverage-0620-906d` at `b79eef6c53a5`. Both living branches are one commit ahead / sixteen behind the examined default `477d6230`; they compete for the same test path.

Intention: prove discovery controller behavior across initialization, searching, filters, result selection, navigation, rendering, and cleanup. Shared root cause: separately generated variants duplicated a suite while diverging in imports, JavaScript bindings, browser mocks, lifecycle setup, and expectations. Neither historical test count nor an existing branch proves its cases run.

Verdict: amalgamated into this successor candidate, with closure prohibited until verified on default. Preserve #103's branch and #104's open PR. Existing #102 assertions remain; six recovered cases extend them using the same actual-production-source loader. No copied controller implementation is introduced.

## Every unique intention has a destination

| Intention | Historical members | Successor proof |
| --- | --- | --- |
| Singleton, dependency initialization, repeated initialization | #102/#103/#104 | Existing three source-reading initialization cases retained |
| Empty/results rendering, cards, page count, pagination/ellipsis | #102/#103/#104 | Existing rendering and pagination cases retained |
| Text escaping, truncation and type icons | #102/#103 | Existing helper cases retained |
| Debounced search and result unwrapping | #102/#103/#104 | Existing search-input case retained |
| Cleared-query restore and minimum query length | #103/#104 | New case proves all filtered items return and short input causes no new search |
| Filter-only results and active search with filter state | #103/#104 | New case proves both modes, mapped results, and visible filter summary |
| Modal opening, focus, scroll lock, close and Escape | #102/#103/#104 | Existing modal case plus new subscribed keyboard-event case |
| Arrow navigation, Enter selection and selected index | #103/#104 | New subscribed-event case with scrollIntoView platform stub |
| Result navigation and persistent highlight marker | #103/#104 | Keyboard selection and fallback cases assert stable chamber ID and session marker |
| Shared URL navigation after initialization | #103 | New case waits the existing 500ms delayed navigation |
| Missing router fallback | #103 | New case supplies no router binding and checks location hash |
| Status and lifecycle disposal | #103/#104 | New case checks status, unregistering, reset state and inactive keyboard subscription |

## Review findings accounted for

All eleven recorded #103 findings and four #104 findings are addressed at the shared fixture/expectation boundary:

- Source path goes up three levels and is read from the repository; no nonexistent `tests/js` raw import.
- The evaluated production export is explicitly returned and assigned, avoiding an unbound class name.
- Initializers are `vi.fn` spies; assertions observe real calls.
- Only initialized controllers are disposed in teardown; singleton-only tests do not dereference an absent filter subsystem.
- Search assertions expect items after wrapper mapping and the actual one-argument call.
- Modal/filter/shared-navigation cases initialize before use.
- Navigation asserts stable lowercase chamber IDs, not uppercase display labels.
- `scrollIntoView` is stubbed on result elements because jsdom lacks that platform API; no spy is installed on a nonexistent prototype member.
- Cleared input expects the complete mocked filtered collection.
- The router is injected into the source-evaluation scope that actually resolves `showNewSection`; the fallback test explicitly omits it.
- Teardown removes subscriptions, clears session state, and restores clocks, preventing one case from silently affecting another.

## Validation and boundary

Focused suite: 17 passing cases, including the existing eleven and six recovered cases. Run `npm run test:unit -- tests/unit/discovery/DiscoveryController.test.js` and the complete `npm run test:unit` gate.

These are production-source unit tests with mocked subsystem/platform boundaries. They do not establish browser rendering or fix production routing. PR #138 separately repairs navigation and adds eight native browser regressions; its evidence must not be conflated with this test-only family. Legacy copied Page/main unit implementations and DOM-forced helpers outside this family's DiscoveryController scope remain a named verification debt; they are not deleted to inflate a cleanliness claim.

Do not close or delete a member until this successor is green on default, each member is linked, and independent review confirms no unique assertions or discussion intent remain unrepresented.
