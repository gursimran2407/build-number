//Trying to avoid any npm installs or anything that takes extra time...
const   https = require('https'),
        zlib = require('zlib'),
        fs = require('fs'),
        env = process.env;

function fail(message, exitCode=1) {
    console.log(`::error::${message}`);
    process.exit(1);
}

function request(method, path, data, callback) {
    
    try {
        if (data) {
            data = JSON.stringify(data);
        }  
        const options = {
            hostname: 'api.github.com',
            port: 443,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data ? data.length : 0,
                'Accept-Encoding' : 'gzip',
                'Authorization' : `token ${env.INPUT_TOKEN}`,
                'User-Agent' : 'GitHub Action - development'
            }
        }
        const req = https.request(options, res => {
    
            let chunks = [];
            res.on('data', d => chunks.push(d));
            res.on('end', () => {
                let buffer = Buffer.concat(chunks);
                if (res.headers['content-encoding'] === 'gzip') {
                    zlib.gunzip(buffer, (err, decoded) => {
                        if (err) {
                            callback(err);
                        } else {
                            callback(null, res.statusCode, decoded && JSON.parse(decoded));
                        }
                    });
                } else {
                    callback(null, res.statusCode, buffer.length > 0 ? JSON.parse(buffer) : null);
                }
            });
    
            req.on('error', err => callback(err));
        });
    
        if (data) {
            req.write(data);
        }
        req.end();
    } catch(err) {
        callback(err);
    }
}

/**
 * Requires a git repository to have already been checked out
 * Generates a build number of the format YYYY.MM.v.0, where:
 * - YY.MM. is year.month, e.g. 2019.01.
 * - v is the auto-incrementing version number. It will increment for every build in a given month, and then reset
 *   after the month ends (so, 19.01.0.0, 19.01.1.0, 19.01.2.0, february starts, 19.02.0.0, 19.02.1.0, ...)
 * - 0 is the patch number, which should be manually incremented as necessary
 *
 * This should be used for live applications, or in other instances where tags are needed but semver isn't
 * the best solution
 *
 * @return the next build number for the checked out repository
 */
function generateBuildNumber(latestVersion) {
    const [year, month, major, patch] = latestVersion.split('.').map(n => parseInt(n));
    const currentDate = generateBuildDate();
    const lastTaggedDate = `${year}.${month}`
    return lastTaggedDate === currentDate ? `${currentDate}.${major + 1}.0` : `${currentDate}.0.0`
}


function generateBuildDate() {
    const o_date = new Intl.DateTimeFormat('en-us');
    const f_date = (m_ca, m_it) => Object({...m_ca, [m_it.type]: m_it.value});
    const m_date = o_date.formatToParts().reduce(f_date, {});
    return `${m_date.year}.${m_date.month}`; 
}


function main() {

    const path = 'BUILD_NUMBER/BUILD_NUMBER';
    const prefix = env.INPUT_PREFIX ? `${env.INPUT_PREFIX}-` : '';
    const date = generateBuildDate();

    //See if we've already generated the build number and are in later steps...
    if (fs.existsSync(path)) {
        let buildNumber = fs.readFileSync(path);
        console.log(`Build number already generated in earlier jobs, using build number ${buildNumber}...`);
        //Setting the output and a environment variable to new build number...
        console.log(`::set-env name=BUILD_NUMBER::${buildNumber}`);
        console.log(`::set-output name=build_number::${buildNumber}`);
        return;
    }
    
    //Some sanity checking:
    for (let varName of ['INPUT_TOKEN', 'GITHUB_REPOSITORY', 'GITHUB_SHA']) {
        if (!env[varName]) {
            fail(`ERROR: Environment variable ${varName} is not defined.`);
        }
    }

    request('GET', `/repos/${env.GITHUB_REPOSITORY}/git/refs/tags/${date}`, null, (err, status, result) => {
    
        let nextBuildNumber, nrTags;
    
        if (status === 404) {
            console.log('No existing tags for this month, starting at 0.');
            nextBuildNumber = `${date}.0.0`;
            nrTags = [];
        } else if (status === 200) {
            const regexString = `/${date}(\\d+)-(\\d+)$`;
            const regex = new RegExp(regexString);
            nrTags = result.filter(d => d.ref.match(regex));
            
            //Existing build numbers:
            let nrs = nrTags.map(t => parseInt(t.ref.match(/-(\d+)$/)[1]));
    
            let currentBuildNumber = Math.max(...nrs);
            console.log(`Last build nr was ${currentBuildNumber}.`);
    
            nextBuildNumber = `${date}.${currentBuildNumber + 1}.0`;
            console.log(`Updating build counter to ${nextBuildNumber}...`);
        } else {
            if (err) {
                fail(`Failed to get refs. Error: ${err}, status: ${status}`);
            } else {
                fail(`Getting build-number refs failed with http status ${status}, error: ${JSON.stringify(result)}`);
            } 
        }

        let newRefData = {
            ref:`refs/tags/${nextBuildNumber}`, 
            sha: env.GITHUB_SHA
        };
        console.log(`would have tagged ${newRefData.sha} as ${newRefData.ref}`)
        console.log(`::set-env name=BUILD_NUMBER::${buildNumber}`);
        console.log(`::set-output name=build_number::${nextBuildNumber}`);
    
    //     request('POST', `/repos/${env.GITHUB_REPOSITORY}/git/refs`, newRefData, (err, status, result) => {
    //         if (status !== 201 || err) {
    //             fail(`Failed to create new build-number ref. Status: ${status}, err: ${err}, result: ${JSON.stringify(result)}`);
    //         }

    //         console.log(`Successfully updated build number to ${nextBuildNumber}`);
            
    //         //Setting the output and a environment variable to new build number...
    //         console.log(`::set-env name=BUILD_NUMBER::${nextBuildNumber}`);
    //         console.log(`::set-output name=build_number::${nextBuildNumber}`);
    //         //Save to file so it can be used for next jobs...
    //         fs.writeFileSync('BUILD_NUMBER', nextBuildNumber.toString());
            
    //         //Cleanup
    //         if (nrTags) {
    //             console.log(`Deleting ${nrTags.length} older build counters...`);
            
    //             for (let nrTag of nrTags) {
    //                 request('DELETE', `/repos/${env.GITHUB_REPOSITORY}/git/${nrTag.ref}`, null, (err, status, result) => {
    //                     if (status !== 204 || err) {
    //                         console.warn(`Failed to delete ref ${nrTag.ref}, status: ${status}, err: ${err}, result: ${JSON.stringify(result)}`);
    //                     } else {
    //                         console.log(`Deleted ${nrTag.ref}`);
    //                     }
    //                 });
    //             }
    //         }

    //     });
    });
}

main();