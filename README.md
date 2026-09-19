<p align="center">
    <img src="src-tauri/icons/icon.png" alt="Skydra" width="96" />
</p>

<h1 align="center">Skydra</h1>

<p align="center">A high-performance application for analyzing drone flight logs (DJI and Litchi CSV formats). Available as a Tauri v2 desktop app or a Docker-deployable web app. Built with DuckDB and React.</p>

> [!IMPORTANT]
> *DJI is a registered trademark of SZ DJI Technology Co., Ltd. DroneLogbook® is a registered trademark of DroneAnalytics Inc. Litchi is a trademark of VC Technology Ltd. Airdata or Airdata UAV is a trademark of Airdata UAV, Inc. This product is independent and is not affiliated with, sponsored by, authorized by, or endorsed by SZ DJI Technology Co., Ltd., DroneAnalytics Inc., VC Technology Ltd., Airdata UAV, Inc., or their affiliates.*

## Quick start (web mode)

Install dependencies and start the web stack:

```bash
npm install
cd src-tauri
cargo run --no-default-features --features web
# In another terminal, from the repo root:
VITE_BACKEND=web npm run dev
```

Open <http://localhost:1420> in your browser.

## Desktop build

```bash
npm run tauri build
```

## Docker deployment

Build and run the provided Docker image:

```bash
docker compose -f docker-compose-build.yml up --build
```

## Configuration

See `src-tauri/tauri.conf.json` and `vite.config.ts` for build settings. Runtime configuration is read from the `DATA_DIR` and `PORT` environment variables in web/Docker mode.

## License

See the [LICENSE](LICENSE) file for details.
