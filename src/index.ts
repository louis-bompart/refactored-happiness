/* istanbul ignore file: only a basic runner for now, it'll be scrapped */
import { ConfigFile } from "./Config";
import { Database } from "./Database";
import * as path from "path";
import * as os from "os";

(async function() {
  const config = await ConfigFile.getExistingConfig();
  await new Database(path.join(os.homedir(), "foobarbaz"), config.data.apiKey).get();
})();
