Release Instructions
--------------------

Pre-Commit
----------
1. fix-n-fmt
1. yarn test

Release
-------
1. `git checkout main; git pull origin main`
1. `git checkout -b <username>/<version>`
1. Bump version number in `version` in `Cargo.toml`
1. `npm version minor --no-commit-hooks --no-git-tag-version`
    - Can be 'patch' or 'major' instead of 'minor'
1. Verify version numbers all match in `git diff --cached`
1. Update CHANGELOG.md
1. yarn build && yarn docs
1. `git add .`
1. `git commit -m '<version>'`
1. `git push origin <username>/<version>`
    - Or with graphite: `gt track` and `gt submit`
1. Create a pull request off this branch
    - Make sure the name of the pull request is also just the `<version>` so the workflow will know to do a release
1. Merge the pull request
1. Verify release appears on [NPM](https://www.npmjs.com/package/@ngrok/ngrok?activeTab=versions)
