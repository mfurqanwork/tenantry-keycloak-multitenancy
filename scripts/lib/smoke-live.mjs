// Runs each check, retrying while the site comes up. A check returns true, or a reason it failed.
export async function checkAll(checks, { attempts = 12, waitMs = 15000, log = console.log } = {}) {
  let failed = 0;
  for (const [name, check] of checks) {
    let result;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        result = await check();
      } catch (err) {
        result = err.message;
      }
      if (result === true) break;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    if (result === true) log(`PASS ${name}`);
    else {
      failed++;
      log(`FAIL ${name}: ${result}`);
    }
  }
  return failed;
}
