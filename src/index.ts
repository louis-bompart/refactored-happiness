import { ConfigFile } from "./Config";
import { Database } from "./Database";
import * as path from "path";
import * as os from "os";

(async function() {
  const config = await ConfigFile.getExistingConfig();
  await new Database(path.join(os.homedir(), "foobarbaz"), config.data.apiKey).get();
})();
