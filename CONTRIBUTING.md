# Contributing to Skydra

This repository is for internal development of the Skydra product.

## Development setup

1. Install Node.js 20+ and Rust 1.85+.
2. Run `npm install`.
3. Start the web backend: `cd src-tauri && cargo run --no-default-features --features web`.
4. Start the Vite dev server: `VITE_BACKEND=web npm run dev`.

## License

All contributions are subject to the license in the [LICENSE](LICENSE) file.
