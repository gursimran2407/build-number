# build-number

Generates a build number of the format YYYY.MM.v.0, where:

- YYYY.MM. is year.month, e.g. 2019.01.
- v is the auto-incrementing version number. It will increment for every build in a given month, and then reset
  after the month ends (so, 19.01.0.0, 19.01.1.0, 19.01.2.0, february starts, 19.02.0.0, 19.02.1.0, ...)
- 0 is the patch number, which should be manually incremented as necessary

This should be used for live applications, or in other instances where tags are needed but semver isn't the best solution

Concept and large chunks of code from https://github.com/einaregilsson/build-number

Use in your workflow like so:

first: create a folder under `.github` called `actions` and then copy/paste main.js and action.yml to it (this is due to the fact that GHA doesn't currently support using private actions))

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Generate build number
      uses: ./.github/actions/build-number
      with:
        token: ${{secrets.github_token}}        
    - name: Print new build number
      run: echo "Build number is $BUILD_NUMBER"
      # Or, if you're on Windows: echo "Build number is ${env:BUILD_NUMBER}"
```

After that runs the subsequent steps in your job will have the environment variable `BUILD_NUMBER` available. If you prefer to be more explicit you can use the output of the step, like so:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Generate build number
      id: buildnumber
      uses: ./.github/actions/build-number
      with:
        token: ${{secrets.github_token}}        
    
    # Now you can pass ${{ steps.buildnumber.outputs.build_number }} to the next steps.
    - name: Another step as an example
      uses: actions/hello-world-docker-action@v1
      with:
        who-to-greet: ${{ steps.buildnumber.outputs.build_number }}
```
The `GITHUB_TOKEN` environment variable is defined by GitHub already for you. See [virtual environments for GitHub actions](https://help.github.com/en/articles/virtual-environments-for-github-actions#github_token-secret) for more information.

## Getting the build number in other jobs

For other steps in the same job you can use the methods above,
to actually get the build number in other jobs you need to use [job outputs](https://help.github.com/en/actions/reference/workflow-syntax-for-github-actions#jobsjobs_idoutputs) mechanism:

```yaml
jobs:
  job1:
    runs-on: ubuntu-latest
    outputs:
      build_number: ${{ steps.buildnumber.outputs.build_number }}
    steps:
    - uses: actions/checkout@v2
    - name: Generate build number
      id: buildnumber
      uses: ./.github/actions/build-number
      with:
        token: ${{secrets.github_token}}
          
  job2:
    needs: job1
    runs-on: ubuntu-latest
    steps:
    - name: Another step as an example
      uses: actions/hello-world-docker-action@v1
      with:
        who-to-greet: ${{needs.job1.outputs.build_number}}
```

## Setting the initial build number.

If you're moving from another build system, you might want to start from some specific number. To do so, simply push a tag with the format expected by the
action (YYYY.MM.v.p)

```
git tag 2020.10.5.0
git push origin 2020.10.5.0
```

and then your next build number will be 2020.10.6.0.