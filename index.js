const http = require("./src/app.js");

// Iniciar servidor sin sincronizar la base de datos
// Las migraciones deben ejecutarse manualmente con el sistema de migraciones
http.listen(process.env.WSPORT || 3001, () => {
  console.log(`Server is listening at ${process.env.WSPORT || 3001}`);
});