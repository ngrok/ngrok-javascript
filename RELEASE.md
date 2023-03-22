Release Instructions
--------------------

Pre-Commit
----------
1. fix-n-fmt
1. yarn test
1. yarn docs

Release
-------
1. `git checkout main; git pull origin main`
1. `git checkout -b <username>/<version>`
1. Bump patch number in `version` in `Cargo.toml`
1. `npm version patch --no-commit-hooks --no-git-tag-version`
1. Verify version numbers all match in `git diff --cached`
1. `git commit -m '<version>'`
1. `git push origin <username>/<version>`
1. Create a pull request off this branch
    - Make sure the name of the pull request is also just the `<version>` so the workflow will know to do a release
1. Merge the pull request
1. Verify release appears on [NPM](https://www.npmjs.com/package/@ngrok/ngrok?activeTab=versions)
