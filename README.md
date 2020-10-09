# build-number

Generates a build number of the format YYYY.MM.v.0, where:

- YYYY.MM. is year.month, e.g. 2019.01.
- v is the auto-incrementing version number. It will increment for every build in a given month, and then reset
  after the month ends (so, 19.01.0.0, 19.01.1.0, 19.01.2.0, february starts, 19.02.0.0, 19.02.1.0, ...)
- 0 is the patch number, which should be manually incremented as necessary

This should be used for live applications, or in other instances where tags are needed but semver isn't the best solution

Concept and large chunks of code from https://github.com/einaregilsson/build-number