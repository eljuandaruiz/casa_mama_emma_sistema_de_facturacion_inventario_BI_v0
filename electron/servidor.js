// El server.js "standalone" de Next hace process.chdir(__dirname); lo anulamos para
// que cwd siga siendo la carpeta de datos, donde la app resuelve certificados/ y uploads/.
const path = require('node:path');
process.chdir = () => {};
require(path.join(process.env.DIR_APP, 'server.js'));
