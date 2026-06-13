# Contributing to VECTOPLAN

Contributions are welcome.

VECTOPLAN is built step by step as a set of Python/Flask services that grow into one larger application. Contributions should follow the existing project structure and should keep the codebase understandable, testable and consistent.

## License of contributions

By submitting a contribution, you agree that your contribution may be used, modified and distributed as part of this repository under the Elastic License 2.0.

You also agree that VECTOPLAN may use your contribution in official VECTOPLAN builds, desktop releases, cloud services and related products.

Depending on the repository, contributions may require either:

* a Contributor License Agreement (CLA), or
* a Developer Certificate of Origin (DCO) sign-off.

If this repository contains a `CLA.md`, contributions are accepted under that CLA.

If this repository uses DCO, every commit must include a sign-off line:

```text
Signed-off-by: Your Name <your.email@example.com>
```

You can add it with:

```bash
git commit -s
```

## Project structure

Please keep the standard VECTOPLAN service structure:

```text
app.py
wsgi.py
config.py
extensions.py
routes/
src/
models/
bootstrap/
tests/
Dockerfile
entrypoint.sh
requirements.txt
```

HTTP adapter logic belongs in `routes/`.

Service logic belongs in `src/`.

Database models belong in `models/`.

Configuration belongs in `config.py`.

## Pull requests

Before opening a pull request:

* keep changes focused
* explain what changed
* explain why it changed
* include tests where possible
* avoid mixing unrelated refactors and features
* do not remove license, copyright or attribution notices
