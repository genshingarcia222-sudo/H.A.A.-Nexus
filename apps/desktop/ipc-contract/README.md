# IPC data contract fixtures

These JSON files are the shared definition of what crosses the Tauri IPC
boundary between the React frontend and the Rust backend. Both sides test
against the same files:

- **Rust** (`src-tauri/src/db/contract_tests.rs`): each fixture deserializes
  into its DTO and serializes back to *exactly* the same JSON, including
  after a round trip through real SQLite.
- **TypeScript** (`src/persistence/ipcContract.test.ts`): each fixture has
  exactly the keys of its `nexus-core` type, as a compiler-checked key list.

If a field is added, renamed, or removed on either side, update the fixture
and both tests fail until the other side matches. Every `f64` field uses a
non-integer value so the round trip is exact (`serde_json` distinguishes
`70` from `70.0`).
